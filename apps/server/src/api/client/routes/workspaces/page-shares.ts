import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

import {
  ApiErrorCode,
  extractNodeRole,
  FileStatus,
  hasNodeRole,
  hasWorkspaceRole,
  richTextContentSchema,
  UserStatus,
} from '@colanode/core';
import { database } from '@colanode/server/data/database';
import { updateDocument } from '@colanode/server/lib/documents';
import { fetchNodeTree, mapNode } from '@colanode/server/lib/nodes';
import { inviteToPage } from '@colanode/server/lib/page-invitations';
import {
  getSharedPageRole,
  isInSharedPageBody,
  mergeSharedPageBody,
  sharedPageBody,
} from '@colanode/server/lib/page-shares';

const params = z.object({ workspaceId: z.string(), pageId: z.string() });

const getPageTree = async (workspaceId: string, pageId: string) => {
  const rows = await fetchNodeTree(pageId);
  const page = rows.at(-1);
  if (
    page?.id !== pageId ||
    page.workspace_id !== workspaceId ||
    page.type !== 'page'
  ) {
    return [];
  }
  return rows.map(mapNode);
};

export const pageSharesRoutes: FastifyPluginCallbackZod = (
  instance,
  _,
  done
) => {
  instance.get('/mine', async (request, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    const { id: workspaceId, user } = request.workspace;
    const grants = await database
      .selectFrom('page_shares')
      .innerJoin('nodes', 'nodes.id', 'page_shares.page_id')
      .select(['nodes.id', 'nodes.attributes'])
      .where('page_shares.viewer_id', '=', user.id)
      .where('nodes.workspace_id', '=', workspaceId)
      .where('nodes.type', '=', 'page')
      .execute();

    const pages = grants.flatMap(({ id, attributes }) =>
      attributes.type === 'page' ? [{ id, name: attributes.name }] : []
    );
    pages.sort(
      (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
    );
    return { pages };
  });

  instance.get('/:pageId', { schema: { params } }, async (request, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    const { pageId } = request.params;
    const { id: workspaceId, user } = request.workspace;
    const tree = await getPageTree(workspaceId, pageId);
    const page = tree.at(-1);
    const role = extractNodeRole(tree, user.id);
    const shareRole = await getSharedPageRole(tree, user.id);
    if (page?.type !== 'page' || (!role && !shareRole)) {
      return reply
        .code(404)
        .send({ code: ApiErrorCode.NotFound, message: 'Page is unavailable.' });
    }

    const [document, children] = await Promise.all([
      database
        .selectFrom('documents')
        .select(['content', 'revision'])
        .where('id', '=', pageId)
        .where('workspace_id', '=', workspaceId)
        .executeTakeFirst(),
      database
        .selectFrom('nodes')
        .select(['id', 'attributes'])
        .where('workspace_id', '=', workspaceId)
        .where('parent_id', '=', pageId)
        .where('type', 'in', ['page', 'file'])
        .orderBy('created_at', 'asc')
        .execute(),
    ]);

    const pages: { id: string; name: string; avatar?: string }[] = [];
    const files: { id: string; name: string }[] = [];
    for (const { id, attributes } of children) {
      if (attributes.type === 'page') {
        const { name, avatar } = attributes;
        pages.push({ id, name, ...(avatar ? { avatar } : {}) });
      }
      if (
        attributes.type === 'file' &&
        attributes.status === FileStatus.Ready
      ) {
        files.push({ id, name: attributes.name });
      }
    }
    const content = richTextContentSchema.safeParse(document?.content);
    const body = content.data ? sharedPageBody(content.data) : null;
    const pagePlacements = pages.flatMap(({ id }) => {
      const block = content.data?.blocks[id];
      if (
        !body ||
        block?.type !== 'page' ||
        block.id !== id ||
        !isInSharedPageBody(pageId, block.parentId, body)
      )
        return [];
      return [{ id, parentId: block.parentId, index: block.index }];
    });
    return {
      name: page.name,
      content: body,
      revision: document?.revision ?? null,
      canEdit:
        shareRole === 'editor' || Boolean(role && hasNodeRole(role, 'editor')),
      pages,
      pagePlacements,
      files,
    };
  });

  instance.get(
    '/:pageId/viewers',
    { schema: { params } },
    async (request, reply) => {
      reply.header('Cache-Control', 'private, no-store');
      const { pageId } = request.params;
      const { id: workspaceId, user } = request.workspace;
      const role = extractNodeRole(
        await getPageTree(workspaceId, pageId),
        user.id
      );
      if (!role || !hasNodeRole(role, 'admin')) {
        return reply.code(404).send({
          code: ApiErrorCode.NotFound,
          message: 'Page sharing is unavailable.',
        });
      }
      const viewers = await database
        .selectFrom('page_shares')
        .innerJoin('users', 'users.id', 'page_shares.viewer_id')
        .select(['users.id', 'users.name', 'users.email', 'page_shares.role'])
        .where('page_shares.page_id', '=', pageId)
        .where('users.workspace_id', '=', workspaceId)
        .orderBy('users.name')
        .execute();
      const invitations = await database
        .selectFrom('page_invitations')
        .select(['email', 'role'])
        .where('page_id', '=', pageId)
        .where('expires_at', '>', new Date())
        .orderBy('email')
        .execute();
      return { viewers, invitations };
    }
  );

  instance.put(
    '/:pageId/viewers',
    {
      schema: {
        params,
        body: z.object({ viewerId: z.string(), enabled: z.boolean() }),
      },
    },
    async (request, reply) => {
      const { pageId } = request.params;
      const { viewerId, enabled } = request.body;
      const { id: workspaceId, user } = request.workspace;
      const role = extractNodeRole(
        await getPageTree(workspaceId, pageId),
        user.id
      );
      if (!role || !hasNodeRole(role, 'admin')) {
        return reply.code(404).send({
          code: ApiErrorCode.NotFound,
          message: 'Page sharing is unavailable.',
        });
      }

      if (enabled) {
        const viewer = await database
          .selectFrom('users')
          .select('id')
          .where('id', '=', viewerId)
          .where('workspace_id', '=', workspaceId)
          .where('status', '=', UserStatus.Active)
          .where('role', '!=', 'none')
          .executeTakeFirst();
        if (!viewer) {
          return reply.code(404).send({
            code: ApiErrorCode.NotFound,
            message: 'Choose an active workspace member.',
          });
        }
        await database
          .insertInto('page_shares')
          .values({ page_id: pageId, viewer_id: viewer.id })
          .onConflict((conflict) =>
            conflict.columns(['page_id', 'viewer_id']).doNothing()
          )
          .execute();
      } else {
        await database
          .deleteFrom('page_shares')
          .where('page_id', '=', pageId)
          .where('viewer_id', '=', viewerId)
          .execute();
      }
      return {};
    }
  );

  instance.post(
    '/:pageId/invitations',
    {
      schema: {
        params,
        body: z.object({
          email: z.string().trim().max(256).pipe(z.email()),
          role: z.enum(['viewer', 'editor']),
        }),
      },
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'private, no-store');
      const { id: workspaceId, user } = request.workspace;
      const { pageId } = request.params;
      const role = extractNodeRole(
        await getPageTree(workspaceId, pageId),
        user.id
      );
      if (role !== 'admin')
        return reply.code(404).send({
          code: ApiErrorCode.NotFound,
          message: 'Page sharing is unavailable.',
        });

      const result = await inviteToPage({
        pageId,
        workspaceId,
        inviterId: user.id,
        canInviteNewMember: hasWorkspaceRole(user.role, 'admin'),
        ...request.body,
      });
      if (!result)
        return reply.code(403).send({
          code: ApiErrorCode.UserInviteNoAccess,
          message:
            'An active member is required. Workspace administrators can invite new guests.',
        });
      return result;
    }
  );

  instance.delete(
    '/:pageId/invitations',
    {
      schema: { params, body: z.object({ email: z.email() }) },
    },
    async (request, reply) => {
      const { id: workspaceId, user } = request.workspace;
      const { pageId } = request.params;
      const role = extractNodeRole(
        await getPageTree(workspaceId, pageId),
        user.id
      );
      if (role !== 'admin')
        return reply.code(404).send({
          code: ApiErrorCode.NotFound,
          message: 'Page sharing is unavailable.',
        });
      await database
        .deleteFrom('page_invitations')
        .where('page_id', '=', pageId)
        .where('email', '=', request.body.email.toLowerCase())
        .execute();
      return {};
    }
  );

  instance.put(
    '/:pageId',
    {
      schema: {
        params,
        body: z.object({
          revision: z.string().nullable(),
          content: richTextContentSchema,
        }),
      },
    },
    async (request, reply) => {
      const { id: workspaceId, user } = request.workspace;
      const { pageId } = request.params;
      const tree = await getPageTree(workspaceId, pageId);
      const role = extractNodeRole(tree, user.id);
      const shareRole = await getSharedPageRole(tree, user.id);
      if (shareRole !== 'editor' && !(role && hasNodeRole(role, 'editor'))) {
        return reply.code(403).send({
          code: ApiErrorCode.Forbidden,
          message: 'You cannot edit this page.',
        });
      }
      const { revision, content } = request.body;
      const updated = await updateDocument({
        documentId: pageId,
        userId: user.id,
        workspaceId,
        expectedRevision: revision,
        updater: (current) => mergeSharedPageBody(pageId, current, content),
      });
      if (!updated)
        return reply.code(409).send({
          code: ApiErrorCode.BadRequest,
          message:
            'Could not save this version. Copy your changes and reload the page.',
        });
      return {};
    }
  );

  done();
};
