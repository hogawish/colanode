import { JSONContent } from '@tiptap/core';

import { defaultClasses } from '@colanode/ui/editor/classes';
import { NodeChildrenRenderer } from '@colanode/ui/editor/renderers/node-children';

interface TableRendererProps {
  node: JSONContent;
  keyPrefix: string | null;
}

export const TableRenderer = ({ node, keyPrefix }: TableRendererProps) => {
  return (
    <table
      data-document-block={node.attrs?.id}
      className={defaultClasses.table}
    >
      <tbody>
        <NodeChildrenRenderer node={node} keyPrefix={keyPrefix} />
      </tbody>
    </table>
  );
};
