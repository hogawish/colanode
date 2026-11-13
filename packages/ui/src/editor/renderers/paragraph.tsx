// Modified: render external-reference previews while retaining source links.
import { JSONContent } from '@tiptap/core';

import { defaultClasses } from '@colanode/ui/editor/classes';
import { NodeChildrenRenderer } from '@colanode/ui/editor/renderers/node-children';
import { ExternalReferencePreview } from '@colanode/ui/editor/views/external-reference';
import { blockBackgroundClass } from '@colanode/ui/lib/block-formatting';
import { readExternalReference } from '@colanode/ui/lib/external-reference';
import { cn } from '@colanode/ui/lib/utils';

interface ParagraphRendererProps {
  node: JSONContent;
  keyPrefix: string | null;
}

export const ParagraphRenderer = ({
  node,
  keyPrefix,
}: ParagraphRendererProps) => {
  if (readExternalReference(node.attrs?.externalRef)) {
    return <div><ExternalReferencePreview value={node.attrs?.externalRef} /><p className={cn(defaultClasses.paragraph, 'py-0.5', blockBackgroundClass(node.attrs?.blockBackground))}><NodeChildrenRenderer node={node} keyPrefix={keyPrefix} /></p></div>;
  }
  return (
    <p className={cn(defaultClasses.paragraph, 'py-0.5', blockBackgroundClass(node.attrs?.blockBackground))}>
      <NodeChildrenRenderer node={node} keyPrefix={keyPrefix} />
    </p>
  );
};
