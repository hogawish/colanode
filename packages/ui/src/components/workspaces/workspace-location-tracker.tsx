import { and, eq, useLiveQuery } from '@tanstack/react-db';
import { useRouter, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';

import { collections } from '@colanode/ui/collections';
import { buildMetadataKey } from '@colanode/ui/collections/metadata';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { recordSpaceVisit } from '@colanode/ui/lib/space-visits';

const upsertMetadata = (namespace: string, key: string, value: unknown) => {
  const metadataKey = buildMetadataKey(namespace, key);
  const currentMetadata = collections.metadata.get(metadataKey);
  if (currentMetadata) {
    collections.metadata.update(metadataKey, (metadata) => {
      metadata.value = JSON.stringify(value);
    });
  } else {
    collections.metadata.insert({
      namespace,
      key,
      value: JSON.stringify(value),
      createdAt: new Date().toISOString(),
      updatedAt: null,
    });
  }
};

export const WorkspaceLocationTracker = () => {
  const router = useRouter();
  const workspace = useWorkspace();
  const nodeId = useRouterState({
    select: ({ matches }) => {
      for (const match of matches) {
        if (match.routeId === '/workspace/$userId/$nodeId') {
          return match.params.nodeId;
        }
      }
    },
  });
  const node = useLiveQuery(
    (q) =>
      q
        .from({ nodes: workspace.collections.nodes })
        .where(({ nodes }) => eq(nodes.id, nodeId))
        .select(({ nodes }) => ({ rootId: nodes.rootId }))
        .findOne(),
    [workspace.userId, nodeId]
  ).data;
  const rootId = node?.rootId;
  const space = useLiveQuery(
    (q) =>
      q
        .from({ nodes: workspace.collections.nodes })
        .where(({ nodes }) =>
          and(eq(nodes.id, rootId), eq(nodes.type, 'space'))
        )
        .select(({ nodes }) => ({ id: nodes.id }))
        .findOne(),
    [workspace.userId, rootId]
  ).data;
  const spaceId = nodeId && space?.id === rootId ? space?.id : undefined;

  useEffect(() => {
    if (spaceId) {
      recordSpaceVisit(workspace.userId, spaceId);
    }
  }, [workspace.userId, spaceId]);

  useEffect(() => {
    router.subscribe('onLoad', (event) => {
      if (!event.hrefChanged) {
        return;
      }

      const location = event.toLocation.href;
      if (!location.includes(`/workspace/${workspace.userId}/`)) {
        return;
      }

      upsertMetadata(workspace.userId, 'location', location);
    });
  }, [workspace.userId, router]);

  useEffect(() => {
    upsertMetadata('app', 'workspace', workspace.userId);
    upsertMetadata(workspace.accountId, 'workspace', workspace.userId);
  }, [workspace.userId, workspace.accountId]);

  return null;
};
