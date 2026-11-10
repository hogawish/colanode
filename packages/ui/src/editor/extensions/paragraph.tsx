// Modified: support optional external-reference previews on paragraphs.
import { Paragraph } from '@tiptap/extension-paragraph';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

import { defaultClasses } from '@colanode/ui/editor/classes';
import {
  createExternalReferenceWidget,
  destroyExternalReferenceWidget,
} from '@colanode/ui/editor/views/external-reference';
import { readExternalReference } from '@colanode/ui/lib/external-reference';

export const ParagraphNode = Paragraph.extend({
  addAttributes() {
    return { ...this.parent?.(), externalRef: { default: null, rendered: false } };
  },
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      ...(this.parent?.() ?? []),
      new Plugin({
        key: new PluginKey('external-reference-previews'),
        props: {
          decorations(state) {
            const widgets: Decoration[] = [];
            state.doc.descendants((node, position) => {
              if (node.type.name !== 'paragraph') return;
              const reference = readExternalReference(node.attrs.externalRef);
              if (!reference) return;
              const id = node.attrs.id;
              widgets.push(Decoration.widget(position, (view, getPos) => {
                const onRemove = editor.isEditable ? () => {
                  const currentPosition = getPos();
                  if (view.isDestroyed || currentPosition === undefined) return;
                  const current = view.state.doc.nodeAt(currentPosition);
                  if (current?.type.name !== 'paragraph' || current.attrs.id !== id) return;
                  view.dispatch(view.state.tr.setNodeMarkup(currentPosition, undefined, {
                    ...current.attrs,
                    externalRef: null,
                  }));
                } : undefined;
                return createExternalReferenceWidget(reference, onRemove);
              }, {
                key: `external-reference:${id}:${JSON.stringify(reference)}:${editor.isEditable}`,
                side: -1,
                stopEvent: () => true,
                ignoreSelection: true,
                destroy: destroyExternalReferenceWidget,
              }));
            });
            return DecorationSet.create(state.doc, widgets);
          },
        },
      }),
    ];
  },
}).configure({
  HTMLAttributes: {
    class: defaultClasses.paragraph,
  },
});
