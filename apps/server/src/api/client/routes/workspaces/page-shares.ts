import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

import {
  ApiErrorCode,
  extractNodeRole,
  FileStatus,
  hasNodeRole,
  richTextContentSchema,
  UserStatus,
} from '@colanode/core';
import { database } from '@colanode/server/data/database';
import { fetchNodeTree, mapNode } from '@colanode/server/lib/nodes';
import { canViewSharedPage } from '@colanode/server/lib/page-shares';

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
  instance.get('/:pageId', { schema: { params } }, async (request, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    const { pageId } = request.params;
    const { id: workspaceId, user } = request.workspace;
    const tree = await getPageTree(workspaceId, pageId);
    const page = tree.at(-1);
    const role = extractNodeRole(tree, user.id);
    if (
      page?.type !== 'page' ||
      (!(role && hasNodeRole(role, 'viewer')) &&
        !(await canViewSharedPage(tree, user.id)))
    ) {
      return reply
        .code(404)
        .send({ code: ApiErrorCode.NotFound, message: 'Page is unavailable.' });
    }

    const [document, children] = await Promise.all([
      database
        .selectFrom('documents')
        .select('content')
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

    const pages: { id: string; name: string }[] = [];
    const files: { id: string; name: string }[] = [];
    for (const { id, attributes } of children) {
      if (attributes.type === 'page') pages.push({ id, name: attributes.name });
      if (
        attributes.type === 'file' &&
        attributes.status === FileStatus.Ready
      ) {
        files.push({ id, name: attributes.name });
      }
    }
    const content = richTextContentSchema.safeParse(document?.content);
    // Child pages and files have their own checked entries above. Do not send embedded DB or folder references.
    const body = content.data;
    if (body) {
      const separateBlockTypes = new Set([
        'page',
        'file',
        'folder',
        'database',
      ]);
      body.blocks = Object.fromEntries(
        Object.entries(body.blocks).filter(
          ([, block]) => !separateBlockTypes.has(block.type)
        )
      );
    }
    return { name: page.name, content: body ?? null, pages, files };
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
        return reply
          .code(404)
          .send({
            code: ApiErrorCode.NotFound,
            message: 'Page sharing is unavailable.',
          });
      }
      const viewers = await database
        .selectFrom('page_shares')
        .innerJoin('users', 'users.id', 'page_shares.viewer_id')
        .select(['users.id', 'users.name', 'users.email'])
        .where('page_shares.page_id', '=', pageId)
        .where('users.workspace_id', '=', workspaceId)
        .orderBy('users.name')
        .execute();
      return { viewers };
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
        return reply
          .code(404)
          .send({
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
          return reply
            .code(404)
            .send({
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

  done();
};
