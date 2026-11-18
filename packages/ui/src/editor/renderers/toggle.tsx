import { JSONContent } from '@tiptap/core';

import { defaultClasses } from '@colanode/ui/editor/classes';
import { NodeChildrenRenderer } from '@colanode/ui/editor/renderers/node-children';
import { blockBackgroundClass } from '@colanode/ui/lib/block-formatting';
import { cn } from '@colanode/ui/lib/utils';

interface ToggleRendererProps {
  node: JSONContent;
  keyPrefix: string | null;
}

// Read-only rendering (previews etc.): a native <details> element.
export const ToggleRenderer = ({ node, keyPrefix }: ToggleRendererProps) => {
  const [summary, ...children] = node.content ?? [];
  return (
    <details
      open
      data-document-block={node.attrs?.id}
      className={cn(
        defaultClasses.toggle,
        blockBackgroundClass(node.attrs?.blockBackground)
      )}
    >
      <summary
        data-document-block={summary?.attrs?.id}
        className="cursor-pointer"
      >
        {summary?.content?.length ? (
          <NodeChildrenRenderer
            node={summary}
            keyPrefix={`${keyPrefix}-summary`}
          />
        ) : (
          'Details'
        )}
      </summary>
      <div className="pl-4">
        <NodeChildrenRenderer
          node={{ ...node, content: children }}
          keyPrefix={keyPrefix}
        />
      </div>
    </details>
  );
};
