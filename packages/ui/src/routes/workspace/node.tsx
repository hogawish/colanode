import { eq, useLiveQuery } from '@tanstack/react-db';
import { createRoute, redirect, useRouterState } from '@tanstack/react-router';

import { IdType, isIdOfType } from '@colanode/core';
import { NodeContainer } from '@colanode/ui/components/nodes/node-container';
import { NodeErrorContainer } from '@colanode/ui/components/nodes/node-error-container';
import { NodeTab } from '@colanode/ui/components/nodes/node-tab';
import { SharedPageView } from '@colanode/ui/components/pages/shared-page';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { readBlockHash } from '@colanode/ui/lib/block-links';
import { getWorkspaceUserId } from '@colanode/ui/routes/utils';
import {
  workspaceRoute,
  workspaceMaskRoute,
} from '@colanode/ui/routes/workspace';

const PageBlockRoute = ({ pageId }: { pageId: string }) => {
  const { collections, userId } = useWorkspace();
  const node = useLiveQuery(
    (q) =>
      q
        .from({ nodes: collections.nodes })
        .where(({ nodes }) => eq(nodes.id, pageId))
        .findOne(),
    [userId, pageId]
  );

  if (node.isLoading) return null;
  return node.data ? (
    <NodeContainer type="full" nodeId={pageId} />
  ) : (
    <SharedPageView key={`${userId}/${pageId}`} pageId={pageId} />
  );
};

export const nodeRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/$nodeId',
  component: () => {
    const { nodeId } = nodeRoute.useParams();
    const hash = useRouterState({
      select: (state) =>
        state.location.maskedLocation?.hash || state.location.hash,
    });
    return isIdOfType(nodeId, IdType.Page) && readBlockHash(hash) ? (
      <PageBlockRoute pageId={nodeId} />
    ) : (
      <NodeContainer type="full" nodeId={nodeId} />
    );
  },
  errorComponent: NodeErrorContainer,
  context: (ctx) => {
    return {
      tab: <NodeTab userId={ctx.params.userId} nodeId={ctx.params.nodeId} />,
    };
  },
});

export const nodeMaskRoute = createRoute({
  getParentRoute: () => workspaceMaskRoute,
  path: '/$nodeId',
  beforeLoad: (ctx) => {
    const userId = getWorkspaceUserId(ctx.params.workspaceId);
    if (userId) {
      throw redirect({
        to: '/workspace/$userId/$nodeId',
        params: {
          userId,
          nodeId: ctx.params.nodeId,
        },
        replace: true,
        hash: ctx.location.hash,
        mask: {
          to: '/$workspaceId/$nodeId',
          params: {
            workspaceId: ctx.params.workspaceId,
            nodeId: ctx.params.nodeId,
          },
          hash: ctx.location.hash,
        },
      });
    }
  },
});
