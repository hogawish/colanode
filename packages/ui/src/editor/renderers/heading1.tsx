import { JSONContent } from '@tiptap/core';

import { defaultClasses } from '@colanode/ui/editor/classes';
import { NodeChildrenRenderer } from '@colanode/ui/editor/renderers/node-children';
import { blockBackgroundClass } from '@colanode/ui/lib/block-formatting';

interface Heading1RendererProps {
  node: JSONContent;
  keyPrefix: string | null;
}

export const Heading1Renderer = ({
  node,
  keyPrefix,
}: Heading1RendererProps) => {
  return (
    <h1 className={[defaultClasses.heading1, blockBackgroundClass(node.attrs?.blockBackground)].join(' ')}>
      <NodeChildrenRenderer node={node} keyPrefix={keyPrefix} />
    </h1>
  );
};
