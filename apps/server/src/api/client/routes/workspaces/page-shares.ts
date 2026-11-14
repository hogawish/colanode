import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

import {
  ApiErrorCode,
  type Block,
  extractNodeRole,
  FileStatus,
  type FileSubtype,
  hasNodeRole,
  hasWorkspaceRole,
  richTextContentSchema,
  UserStatus,
} from '@colanode/core';
import { database } from '@colanode/server/data/database';
import type { SelectNode } from '@colanode/server/data/schema';
import { updateDocument } from '@colanode/server/lib/documents';
import { fetchNodeTree, mapNode } from '@colanode/server/lib/nodes';
import { inviteToPage } from '@colanode/server/lib/page-invitations';
import {
  getSharedPageRole,
  isInSharedPageBody,
  isSharedFileBlock,
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

const linkedDatabaseId = (block?: Block) =>
  block?.type === 'database' &&
  typeof block.attrs?.sourceDatabaseId === 'string'
    ? block.attrs.sourceDatabaseId
    : null;

const readDatabase = async (db: SelectNode) => {
  const children = await database
    .selectFrom('nodes')
    .selectAll()
    .where('workspace_id', '=', db.workspace_id)
    .where('parent_id', '=', db.id)
    .where('type', 'in', ['database_view', 'record'])
    .execute();
  const nodes = children
    .filter(
      ({ attributes }) =>
        attributes.type === 'database_view' ||
        (attributes.type === 'record' && attributes.databaseId === db.id)
    )
    .map(mapNode);
  return { database: mapNode(db), nodes };
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

  instance.get(
    '/by-user/:viewerId',
    {
      schema: {
        params: z.object({ workspaceId: z.string(), viewerId: z.string() }),
      },
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'private, no-store');
      const { id: workspaceId, user } = request.workspace;
      if (!hasWorkspaceRole(user.role, 'admin')) {
        return reply.code(404).send({
          code: ApiErrorCode.NotFound,
          message: 'Page sharing is unavailable.',
        });
      }
      const grants = await database
        .selectFrom('page_shares')
        .innerJoin('nodes', 'nodes.id', 'page_shares.page_id')
        .innerJoin('users', 'users.id', 'page_shares.viewer_id')
        .select(['nodes.id', 'page_shares.role'])
        .where('users.id', '=', request.params.viewerId)
        .where('users.workspace_id', '=', workspaceId)
        .where('nodes.workspace_id', '=', workspaceId)
        .where('nodes.type', '=', 'page')
        .execute();

      const pages = [];
      for (const grant of grants) {
        const tree = await getPageTree(workspaceId, grant.id);
        const page = tree.at(-1);
        if (
          page?.type !== 'page' ||
          extractNodeRole(tree, user.id) !== 'admin'
        ) {
          continue;
        }
        pages.push({ id: page.id, name: page.name, role: grant.role });
      }
      pages.sort(
        (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
      );
      return { pages };
    }
  );

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
        .where('type', 'in', ['page', 'file', 'database'])
        .orderBy('created_at', 'asc')
        .execute(),
    ]);

    const pages: { id: string; name: string; avatar?: string }[] = [];
    const databases: typeof pages = [];
    const files: {
      id: string;
      name: string;
      mimeType: string;
      subtype: FileSubtype;
    }[] = [];
    const content = richTextContentSchema.safeParse(document?.content);
    for (const { id, attributes } of children) {
      if (attributes.type === 'page') {
        const { name, avatar } = attributes;
        pages.push({ id, name, ...(avatar ? { avatar } : {}) });
      }
      if (attributes.type === 'database') {
        const { name, avatar } = attributes;
        databases.push({ id, name, ...(avatar ? { avatar } : {}) });
      }
      if (
        attributes.type === 'file' &&
        attributes.status === FileStatus.Ready &&
        content.data &&
        isSharedFileBlock(content.data, pageId, id)
      ) {
        const { name, mimeType, subtype } = attributes;
        files.push({ id, name, mimeType, subtype });
      }
    }
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
    const databasePlacements = databases.flatMap(({ id }) => {
      const block = content.data?.blocks[id];
      if (
        !body ||
        block?.type !== 'database' ||
        block.id !== id ||
        linkedDatabaseId(block) ||
        !isInSharedPageBody(pageId, block.parentId, body)
      )
        return [];
      return [
        {
          id,
          parentId: block.parentId,
          index: block.index,
          inline: block.attrs?.inline === true,
        },
      ];
    });
    const filePlacements = files.flatMap(({ id }) => {
      const block = content.data?.blocks[id];
      return block
        ? [{ id, parentId: block.parentId, index: block.index }]
        : [];
    });
    const linkedDatabasePlacements =
      body && content.data
        ? Object.entries(content.data.blocks).flatMap(([id, block]) =>
            id === block.id &&
            linkedDatabaseId(block) &&
            isInSharedPageBody(pageId, block.parentId, body)
              ? [{ id, parentId: block.parentId, index: block.index }]
              : []
          )
        : [];
    return {
      name: page.name,
      content: body,
      revision: document?.revision ?? null,
      canEdit:
        shareRole === 'editor' || Boolean(role && hasNodeRole(role, 'editor')),
      pages,
      pagePlacements,
      databases,
      databasePlacements,
      linkedDatabasePlacements,
      filePlacements,
      files,
    };
  });

  instance.get(
    '/:pageId/databases/:databaseId',
    { schema: { params: params.extend({ databaseId: z.string() }) } },
    async (request, reply) => {
      reply.header('Cache-Control', 'private, no-store');
      const { pageId, databaseId } = request.params;
      const { id: workspaceId, user } = request.workspace;
      const tree = await getPageTree(workspaceId, pageId);
      const role = extractNodeRole(tree, user.id);
      const shareRole = await getSharedPageRole(tree, user.id);
      const unavailable = () =>
        reply.code(404).send({
          code: ApiErrorCode.NotFound,
          message: 'Database is unavailable.',
        });
      if (!role && !shareRole) return unavailable();

      const ownedNodes = database
        .selectFrom('nodes')
        .selectAll()
        .where('workspace_id', '=', workspaceId);
      const db = await ownedNodes
        .where('id', '=', databaseId)
        .where('parent_id', '=', pageId)
        .where('type', '=', 'database')
        .executeTakeFirst();
      if (!db || db.attributes.type !== 'database') return unavailable();

      return readDatabase(db);
    }
  );

  instance.get(
    '/:pageId/linked-databases/:blockId',
    { schema: { params: params.extend({ blockId: z.string() }) } },
    async (request, reply) => {
      reply.header('Cache-Control', 'private, no-store');
      const { pageId, blockId } = request.params;
      const { id: workspaceId, user } = request.workspace;
      const unavailable = () =>
        reply.code(404).send({
          code: ApiErrorCode.NotFound,
          message: 'Database is unavailable.',
        });
      const destination = await getPageTree(workspaceId, pageId);
      if (
        !extractNodeRole(destination, user.id) &&
        !(await getSharedPageRole(destination, user.id))
      ) {
        return unavailable();
      }
      const document = await database
        .selectFrom('documents')
        .select('content')
        .where('id', '=', pageId)
        .where('workspace_id', '=', workspaceId)
        .executeTakeFirst();
      const { data: content } = richTextContentSchema.safeParse(
        document?.content
      );
      const block = content?.blocks[blockId];
      const sourceId = linkedDatabaseId(block);
      if (
        !sourceId ||
        !content ||
        !block ||
        block.id !== blockId ||
        !isInSharedPageBody(pageId, block.parentId, content)
      ) {
        return unavailable();
      }

      const source = await fetchNodeTree(sourceId);
      const db = source.at(-1);
      if (
        db?.id !== sourceId ||
        db.workspace_id !== workspaceId ||
        db.type !== 'database'
      )
        return unavailable();
      const nodes = source.map(mapNode);
      const canReadSource =
        extractNodeRole(nodes, user.id) ||
        (nodes.at(-2)?.type === 'page' &&
          (await getSharedPageRole(nodes.slice(0, -1), user.id)));
      if (!canReadSource) return unavailable();

      const initialViewId = block.attrs?.sourceViewId;
      return {
        ...(await readDatabase(db)),
        ...(typeof initialViewId === 'string' && { initialViewId }),
      };
    }
  );

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
        body: z.object({
          viewerId: z.string(),
          enabled: z.boolean(),
          role: z.enum(['viewer', 'editor']).optional(),
        }),
      },
    },
    async (request, reply) => {
      const { pageId } = request.params;
      const { viewerId, enabled, role: pageRole } = request.body;
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
        if (pageRole) {
          const updated = await database
            .updateTable('page_shares')
            .set({ role: pageRole })
            .where('page_id', '=', pageId)
            .where('viewer_id', '=', viewer.id)
            .returning('viewer_id')
            .executeTakeFirst();
          if (!updated) {
            return reply.code(404).send({
              code: ApiErrorCode.NotFound,
              message: 'This direct page share no longer exists.',
            });
          }
        } else {
          await database
            .insertInto('page_shares')
            .values({ page_id: pageId, viewer_id: viewer.id })
            .onConflict((conflict) =>
              conflict.columns(['page_id', 'viewer_id']).doNothing()
            )
            .execute();
        }
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
