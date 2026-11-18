import { ChevronRight } from 'lucide-react';

import { EditorCommand } from '@colanode/client/types';

export const ToggleCommand: EditorCommand = {
  key: 'toggle',
  name: 'Toggle',
  description: 'Insert a collapsible toggle block',
  keywords: ['toggle', 'collapse', 'collapsible', 'fold', 'details'],
  icon: ChevronRight,
  disabled: false,
  handler: ({ editor, range }) => {
    editor
      .chain()
      .focus()
      .deleteRange(range)
      .toggleNode('paragraph', 'paragraph')
      .setToggle()
      .run();
  },
};
