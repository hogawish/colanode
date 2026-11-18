import { Pilcrow } from 'lucide-react';

import { EditorCommand } from '@colanode/client/types';

const LIST_ITEM_TYPES = ['listItem', 'taskItem'];

export const ParagraphCommand: EditorCommand = {
  key: 'paragraph',
  name: 'Text',
  description: 'Insert a text paragraph.tsx',
  keywords: ['paragraph', 'text'],
  icon: Pilcrow,
  disabled: false,
  handler: ({ editor, range }) => {
    editor.chain().focus().deleteRange(range).run();

    // Leave list items one level at a time, so that the block stays inside any
    // other container (e.g. a toggle). The stock `toggleNode('paragraph',
    // 'paragraph')` falls back to `clearNodes()` when the block is already a
    // paragraph, which lifts it out of *every* wrapper (lists AND toggles).
    for (let guard = 0; guard < 20; guard++) {
      const { $from } = editor.state.selection;
      const parentOfBlock =
        $from.depth >= 1 ? $from.node($from.depth - 1) : null;
      if (
        $from.parent.type.name !== 'paragraph' ||
        !parentOfBlock ||
        !LIST_ITEM_TYPES.includes(parentOfBlock.type.name)
      ) {
        break;
      }

      if (!editor.commands.liftListItem(parentOfBlock.type.name)) {
        break;
      }
    }

    // Headings etc. become a paragraph; an existing paragraph is left as is.
    if (!editor.isActive('paragraph')) {
      editor.chain().focus().setNode('paragraph').run();
    }
  },
};
