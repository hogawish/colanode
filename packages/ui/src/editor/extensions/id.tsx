import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Extension } from '@tiptap/react';
import { Plugin, PluginKey } from 'prosemirror-state';

import { EditorNodeTypes, generateId, IdType } from '@colanode/core';
import { blockBackgroundClass } from '@colanode/ui/lib/block-formatting';

const types = [
  EditorNodeTypes.Paragraph,
  EditorNodeTypes.Heading1,
  EditorNodeTypes.Heading2,
  EditorNodeTypes.Heading3,
  EditorNodeTypes.Blockquote,
  EditorNodeTypes.BulletList,
  EditorNodeTypes.ListItem,
  EditorNodeTypes.OrderedList,
  EditorNodeTypes.TaskList,
  EditorNodeTypes.TaskItem,
  EditorNodeTypes.CodeBlock,
  EditorNodeTypes.HorizontalRule,
  EditorNodeTypes.Table,
  EditorNodeTypes.TableHeader,
  EditorNodeTypes.TableCell,
  EditorNodeTypes.TableRow,
];

export const IdExtension = Extension.create({
  name: 'id',
  priority: 10000,
  addGlobalAttributes() {
    return [
      {
        types: ['heading1', 'heading2', 'heading3'],
        attributes: {
          // Retain an existing link preview when a paragraph becomes a heading;
          // converting back to text restores the paragraph's preview.
          externalRef: { default: null, rendered: false, keepOnSplit: false },
        },
      },
      {
        types,
        attributes: {
          blockBackground: {
            default: null,
            parseHTML: (element) =>
              element.getAttribute('data-block-background'),
            renderHTML: (attrs) =>
              attrs.blockBackground
                ? {
                    'data-block-background': attrs.blockBackground,
                    class: blockBackgroundClass(attrs.blockBackground),
                  }
                : {},
          },
          id: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-id'),
            renderHTML: (attrs) => {
              if (!attrs.id) {
                return {};
              }

              return {
                'data-id': attrs.id,
              };
            },
            rendered: true,
            keepOnSplit: false,
          },
        },
      },
    ];
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('id'),
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              const background = blockBackgroundClass(
                node.attrs.blockBackground
              );
              if (node.isBlock && background)
                decorations.push(
                  Decoration.node(pos, pos + node.nodeSize, {
                    class: background,
                  })
                );
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
        appendTransaction(_, __, state) {
          const { tr } = state;
          const ids = new Set<string>();
          state.doc.descendants((node, pos) => {
            if (node.isText) {
              return; // Text nodes don't need IDs
            }

            if (!node.attrs.id || typeof node.attrs.id !== 'string') {
              const id = generateId(IdType.Block);
              ids.add(id);
              tr.setNodeMarkup(pos, null, {
                ...node.attrs,
                id,
              });
            } else {
              let id = node.attrs.id;
              if (ids.has(id)) {
                id = generateId(IdType.Block);
                ids.add(id);
                tr.setNodeMarkup(pos, null, {
                  ...node.attrs,
                  id,
                });
              } else {
                ids.add(id);
              }
            }
          });
          return tr;
        },
      }),
    ];
  },
});
