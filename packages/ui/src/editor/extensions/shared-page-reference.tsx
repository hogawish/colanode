import { Node } from '@tiptap/core';
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type NodeViewProps,
} from '@tiptap/react';

import { SharedDatabaseBlock } from '@colanode/ui/components/pages/shared-database';
import { FileRenderer } from '@colanode/ui/editor/renderers/file';
import { SharedPageLink } from '@colanode/ui/editor/renderers/shared-page-link';

const ReferenceView = ({ node }: NodeViewProps) => {
  const { id, inline, linked } = node.attrs;
  return (
    <NodeViewWrapper data-id={id} contentEditable={false}>
      {node.type.name === 'page' && <SharedPageLink id={id} />}
      {node.type.name === 'database' && (
        <SharedDatabaseBlock id={id} inline={inline} linked={linked} />
      )}
      {node.type.name === 'file' && (
        <FileRenderer node={{ type: 'file', attrs: { id } }} keyPrefix={null} />
      )}
    </NodeViewWrapper>
  );
};

export const sharedPageReferenceNodes = ['page', 'database', 'file'].map(
  (name) =>
    Node.create({
      name,
      group: 'block',
      atom: true,
      addAttributes: () => ({
        id: { default: null },
        inline: { default: false },
        linked: { default: false },
      }),
      renderHTML: () => ['div'],
      addNodeView: () => ReactNodeViewRenderer(ReferenceView),
    })
);
