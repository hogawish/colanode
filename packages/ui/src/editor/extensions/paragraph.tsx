// Modified: support optional external-reference previews on paragraphs.
import { Paragraph } from '@tiptap/extension-paragraph';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { ReplaceStep } from '@tiptap/pm/transform';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

import { defaultClasses } from '@colanode/ui/editor/classes';
import {
  createExternalReferenceWidget,
  destroyExternalReferenceWidget,
} from '@colanode/ui/editor/views/external-reference';
import { readExternalReference } from '@colanode/ui/lib/external-reference';

export const ParagraphNode = Paragraph.extend({
  addAttributes() {
    return { ...this.parent?.(), externalRef: { default: null, rendered: false, keepOnSplit: false } };
  },
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      ...(this.parent?.() ?? []),
      new Plugin({
        key: new PluginKey('external-reference-previews'),
        appendTransaction(transactions, _oldState, state) {
          const tr = state.tr;
          transactions.forEach((transaction, transactionIndex) => {
            transaction.steps.forEach((step, stepIndex) => {
              // Tiptap's middle split inherits attrs despite keepOnSplit:false.
              // Match the native split's open/close insertion, not pasted blocks.
              if (!(step instanceof ReplaceStep) || step.from !== step.to ||
                  step.slice.openStart !== 1 || step.slice.openEnd !== 1 ||
                  step.slice.content.childCount !== 2) return;
              const left = step.slice.content.firstChild;
              const right = step.slice.content.lastChild;
              if (left?.type.name !== 'paragraph' || right?.type.name !== 'paragraph' ||
                  left.content.size !== 0 || right.content.size !== 0 ||
                  !readExternalReference(right.attrs.externalRef) ||
                  JSON.stringify(left.attrs.externalRef) !== JSON.stringify(right.attrs.externalRef)) return;
              let position = step.from + 1;
              const mappings = [transaction.mapping.slice(stepIndex + 1),
                ...transactions.slice(transactionIndex + 1).map((later) => later.mapping)];
              for (const mapping of mappings) {
                // Follow an interior point too: a deleted split must not target
                // the next existing paragraph now occupying the same position.
                if (mapping.mapResult(position + 1).deletedAcross) return;
                position = mapping.map(position);
              }
              const current = tr.doc.nodeAt(position);
              if (current?.type.name === 'paragraph' &&
                  JSON.stringify(current.attrs.externalRef) === JSON.stringify(right.attrs.externalRef)) {
                tr.setNodeMarkup(position, undefined, { ...current.attrs, externalRef: null });
              }
            });
          });
          return tr.docChanged ? tr : null;
        },
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
