import { JSONContent } from '@tiptap/core';

import { defaultClasses } from '@colanode/ui/editor/classes';
import { NodeChildrenRenderer } from '@colanode/ui/editor/renderers/node-children';
import { blockBackgroundClass } from '@colanode/ui/lib/block-formatting';

interface TaskItemRendererProps {
  node: JSONContent;
  keyPrefix: string | null;
}

export const TaskItemRenderer = ({
  node,
  keyPrefix,
}: TaskItemRendererProps) => {
  return (
    <li
      data-document-block={node.attrs?.id}
      data-checked={node.attrs?.checked === true}
      className={[
        defaultClasses.taskItem,
        blockBackgroundClass(node.attrs?.blockBackground),
      ].join(' ')}
    >
      <label>
        <input
          type="checkbox"
          checked={node.attrs?.checked === true}
          disabled
          aria-label="Task completion"
        />
      </label>
      <div>
        <NodeChildrenRenderer node={node} keyPrefix={keyPrefix} />
      </div>
    </li>
  );
};
