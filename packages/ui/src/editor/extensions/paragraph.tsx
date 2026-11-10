// Modified: support optional external-reference previews on paragraphs.
import { Paragraph } from '@tiptap/extension-paragraph';
import { ReactNodeViewRenderer } from '@tiptap/react';

import { defaultClasses } from '@colanode/ui/editor/classes';
import { ReferenceParagraphView } from '@colanode/ui/editor/views/external-reference';

export const ParagraphNode = Paragraph.extend({
  addAttributes() {
    return { ...this.parent?.(), externalRef: { default: null, rendered: false } };
  },
  addNodeView() { return ReactNodeViewRenderer(ReferenceParagraphView); },
}).configure({
  HTMLAttributes: {
    class: defaultClasses.paragraph,
  },
});
