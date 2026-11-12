import { fireEvent, render, screen } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import { expect, it, vi } from 'vitest';

import { LinkedDatabaseDialog } from '@colanode/ui/editor/commands/linked-database';

const fixture = vi.hoisted(() => ({ insertNode: vi.fn() }));
vi.mock('@tanstack/react-db', () => ({
  useLiveQuery: () => ({
    data: [{ id: 'boarddv', type: 'database_view', name: 'Board' }],
  }),
}));
vi.mock('@colanode/ui/contexts/workspace', () => ({
  useWorkspace: () => ({
    collections: { nodes: { insert: fixture.insertNode } },
  }),
}));
vi.mock('@colanode/ui/components/databases/database-select', () => ({
  DatabaseSelect: ({ onChange }: { onChange: (id: string) => void }) => (
    <button type="button" onClick={() => onChange('sourcedb')}>
      Pick source
    </button>
  ),
}));

it('embeds a chosen existing view with a separate block ID and no new database', () => {
  const run = vi.fn();
  const insertContent = vi.fn(() => ({ run }));
  const editor = {
    isDestroyed: false,
    isEditable: true,
    chain: () => ({ focus: () => ({ insertContent }) }),
  } as unknown as Editor;
  const onClose = vi.fn();

  render(<LinkedDatabaseDialog editor={editor} onClose={onClose} />);
  fireEvent.click(screen.getByRole('button', { name: 'Pick source' }));
  fireEvent.change(screen.getByLabelText('Initial view'), {
    target: { value: 'boarddv' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Insert view' }));

  expect(insertContent).toHaveBeenCalledWith({
    type: 'database',
    attrs: {
      id: expect.stringMatching(/bl$/),
      inline: true,
      sourceDatabaseId: 'sourcedb',
      sourceViewId: 'boarddv',
    },
  });
  expect(run).toHaveBeenCalledOnce();
  expect(onClose).toHaveBeenCalledOnce();
  expect(fixture.insertNode).not.toHaveBeenCalled();
});
