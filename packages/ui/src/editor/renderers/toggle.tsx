import type { JSONContent } from '@tiptap/core';

import { NodeRenderer } from '@colanode/ui/editor/renderers/node';
import { blockBackgroundClass } from '@colanode/ui/lib/block-formatting';

export const ToggleRenderer = ({
  node,
  keyPrefix,
}: {
  node: JSONContent;
  keyPrefix: string | null;
}) => {
  const [summary, ...children] = node.content ?? [];
  return (
    <details
      data-document-block={node.attrs?.id}
      className={blockBackgroundClass(node.attrs?.blockBackground)}
    >
      <summary
        data-document-block={summary?.attrs?.id}
        className="cursor-pointer"
      >
        {summary?.content?.map((child, index) => (
          <NodeRenderer key={index} node={child} keyPrefix={keyPrefix} />
        )) ?? 'Details'}
      </summary>
      <div className="pl-4">
        {children.map((child, index) => (
          <NodeRenderer
            key={child.attrs?.id ?? index}
            node={child}
            keyPrefix={keyPrefix}
          />
        ))}
      </div>
    </details>
  );
};
