import { eq, useLiveQuery } from '@tanstack/react-db';
import { ReactNode } from 'react';

import { LocalNode } from '@colanode/client/types';
import { extractNodeRole } from '@colanode/core';
import { NodeContext, NodeContextValue } from '@colanode/ui/contexts/node';
import { useWorkspace } from '@colanode/ui/contexts/workspace';

const buildContextValue = (
  node: LocalNode,
  parentContext: NodeContextValue | null,
  userId: string
): NodeContextValue | null => {
  const breadcrumb = parentContext
    ? [...parentContext.breadcrumb, node]
    : [node];
  const root = parentContext ? parentContext.root : node;
  const role = extractNodeRole(root, userId);

  if (!role) return null;

  return {
    node,
    breadcrumb,
    root,
    role,
  };
};

type NodeProviderProps = {
  nodeId: string;
  children: ReactNode;
  fallback?: ReactNode;
};

export const NodeProvider = ({
  nodeId,
  children,
  fallback,
}: NodeProviderProps) => {
  const workspace = useWorkspace();

  const nodeQuery = useLiveQuery(
    (q) =>
      q
        .from({ nodes: workspace.collections.nodes })
        .where(({ nodes }) => eq(nodes.id, nodeId))
        .findOne(),
    [workspace.userId, nodeId]
  );

  if (nodeQuery.isLoading) {
    return null;
  }

  const node = nodeQuery.data;
  if (!node) {
    return fallback ?? null;
  }

  const renderNode = (parentContext: NodeContextValue | null) => {
    const value = buildContextValue(node, parentContext, workspace.userId);
    if (!value) {
      if (fallback !== undefined) return fallback;
      throw new Error('Node role not found');
    }
    return (
      <NodeContext.Provider value={value}>{children}</NodeContext.Provider>
    );
  };

  if (node.parentId) {
    return (
      <NodeProvider nodeId={node.parentId} fallback={fallback}>
        <NodeContext.Consumer>{renderNode}</NodeContext.Consumer>
      </NodeProvider>
    );
  }

  return renderNode(null);
};
