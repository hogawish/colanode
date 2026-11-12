import { mergeAttributes, Node } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { ReactNodeViewRenderer } from '@tiptap/react';

import { DatabaseNodeView } from '@colanode/ui/editor/views';
import { isBoardRecordDrag } from '@colanode/ui/lib/board-drag';

export const DatabaseNode = Node.create({
  name: 'database',
  group: 'block',
  atom: true,
  defining: true,
  draggable: true,
  addAttributes() {
    return {
      id: {
        default: null,
      },
      inline: {
        default: false,
      },
    };
  },
  renderHTML({ HTMLAttributes }) {
    return ['page', mergeAttributes(HTMLAttributes)];
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleDOMEvents: {
            dragover: (_, event) => isBoardRecordDrag(event),
            drop: (_, event) => {
              if (!isBoardRecordDrag(event)) return false;
              event.preventDefault();
              return true;
            },
          },
        },
      }),
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(DatabaseNodeView, {
      as: 'database',
    });
  },
});
