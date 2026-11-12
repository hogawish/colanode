import { eq, useLiveQuery } from '@tanstack/react-db';
import { type NodeViewProps } from '@tiptap/core';
import { NodeViewWrapper } from '@tiptap/react';

import { LocalPageNode } from '@colanode/client/types';
import { PageLinkContent } from '@colanode/ui/components/pages/page-link-content';
import { Link } from '@colanode/ui/components/ui/link';
import { useWorkspace } from '@colanode/ui/contexts/workspace';

export const PageNodeView = ({ node }: NodeViewProps) => {
  const workspace = useWorkspace();

  const id = node.attrs.id;

  if (!id) {
    return null;
  }

  const pageGetQuery = useLiveQuery(
    (q) =>
      q
        .from({ nodes: workspace.collections.nodes })
        .where(({ nodes }) => eq(nodes.id, id))
        .findOne(),
    [workspace.userId, id]
  );

  if (
    pageGetQuery.isLoading ||
    !pageGetQuery.data ||
    pageGetQuery.data.type !== 'page'
  ) {
    return null;
  }

  const page = pageGetQuery.data as LocalPageNode | undefined;
  if (!page) {
    return null;
  }

  const name = page.name ?? 'Unnamed';
  const avatar = page.avatar;

  return (
    <NodeViewWrapper data-id={node.attrs.id}>
      <Link from="/workspace/$userId" to="$nodeId" params={{ nodeId: id }}>
        <PageLinkContent id={id} name={name} avatar={avatar} />
      </Link>
    </NodeViewWrapper>
  );
};
