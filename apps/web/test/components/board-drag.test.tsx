import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { Editor } from '@tiptap/core';
import TiptapDocument from '@tiptap/extension-document';
import TiptapText from '@tiptap/extension-text';
import { EditorContent } from '@tiptap/react';
import { type ReactNode } from 'react';
import { DndProvider } from 'react-dnd';
import { afterEach, expect, it, vi } from 'vitest';

import { BoardViewColumn } from '@colanode/ui/components/databases/boards/board-view-column';
import { BoardViewRecordCard } from '@colanode/ui/components/databases/boards/board-view-record-card';
import { BoardViewContext } from '@colanode/ui/contexts/board-view';
import {
  DatabaseViewContext,
  useDatabaseView,
} from '@colanode/ui/contexts/database-view';
import { DatabaseNode } from '@colanode/ui/editor/extensions/database';
import {
  boardRecordDragMime,
  getBoardMoveValue,
} from '@colanode/ui/lib/board-drag';
import { HTML5Backend } from '@colanode/ui/lib/dnd-backend';

const state = vi.hoisted(() => ({
  execute: vi.fn(),
  record: {
    id: 'record',
    type: 'record',
    databaseId: 'database',
    name: 'Task',
    fields: { status: { type: 'string', value: 'todo' } },
  },
}));

vi.mock('@colanode/ui/contexts/workspace', () => ({
  useWorkspace: () => ({
    userId: 'member',
    collections: { nodes: new Map([['record', state.record]]) },
  }),
}));
vi.mock('@colanode/ui/contexts/database', () => ({
  useDatabase: () => ({ id: 'database' }),
}));
vi.mock('@colanode/ui/contexts/record', () => ({
  useRecord: () => ({ ...state.record, canEdit: true }),
}));
vi.mock('@colanode/ui/contexts/node', () => ({
  useNode: () => ({ node: { id: 'database', name: 'Tasks' }, role: 'editor' }),
}));
vi.mock('@colanode/ui/components/nodes/node-provider', () => ({
  NodeProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@colanode/ui/components/databases/database', () => ({
  Database: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@colanode/ui/components/databases/database-views', () => ({
  DatabaseViews: () => <TestBoard />,
}));
vi.mock('@colanode/ui/editor/views', async () => ({
  DatabaseNodeView: (await import('@colanode/ui/editor/views/database'))
    .DatabaseNodeView,
}));
vi.mock('@colanode/ui/components/ui/link', () => ({
  Link: ({
    children,
    draggable,
  }: {
    children: ReactNode;
    draggable?: boolean;
  }) => (
    <a href="#record" draggable={draggable}>
      {children}
    </a>
  ),
}));
vi.mock(
  '@colanode/ui/components/databases/boards/board-view-column-records',
  () => ({
    BoardViewColumnRecords: () => null,
  })
);
vi.mock('@colanode/ui/components/records/record-field-value', () => ({
  RecordFieldValue: () => null,
}));

const field = {
  id: 'status',
  name: 'Status',
  type: 'select',
  index: 'a0',
  options: {},
} as const;
const viewValue = (id: string) =>
  ({ id, fields: [] }) as ReturnType<typeof useDatabaseView>;
const TestBoard = () => (
  <>
    <DatabaseViewContext.Provider value={viewValue('view')}>
      <BoardViewContext.Provider
        value={{
          field,
          filter: {
            id: 'todo',
            type: 'field',
            fieldId: field.id,
            operator: 'is_in',
            value: ['todo'],
          },
          columnValue: 'todo',
          header: null,
        }}
      >
        <BoardViewRecordCard />
      </BoardViewContext.Provider>
      <BoardViewContext.Provider
        value={{
          field,
          filter: {
            id: 'done',
            type: 'field',
            fieldId: field.id,
            operator: 'is_in',
            value: ['done'],
          },
          columnValue: 'done',
          header: <span>Done</span>,
        }}
      >
        <BoardViewColumn />
      </BoardViewContext.Provider>
    </DatabaseViewContext.Provider>
    <DatabaseViewContext.Provider value={viewValue('other')}>
      <BoardViewContext.Provider
        value={{
          field,
          filter: {
            id: 'done',
            type: 'field',
            fieldId: field.id,
            operator: 'is_in',
            value: ['done'],
          },
          columnValue: 'done',
          header: <span>Other board</span>,
        }}
      >
        <BoardViewColumn />
      </BoardViewContext.Provider>
    </DatabaseViewContext.Provider>
  </>
);

const transfer = () => {
  const types: string[] = [];
  return {
    types,
    setData: (type: string) => {
      if (!types.includes(type)) types.push(type);
    },
    setDragImage: vi.fn(),
    effectAllowed: 'all',
    dropEffect: 'none',
  };
};

let editor: Editor | undefined;
afterEach(() => {
  editor?.destroy();
  editor = undefined;
  state.execute.mockReset();
});

it('moves a card inside an embedded database and ignores cancelled and cross-view drags', async () => {
  state.execute.mockResolvedValue({ success: true, output: { success: true } });
  Object.assign(window, { colanode: { executeMutation: state.execute } });
  editor = new Editor({
    extensions: [TiptapDocument, TiptapText, DatabaseNode],
    content: {
      type: 'doc',
      content: [{ type: 'database', attrs: { id: 'database', inline: true } }],
    },
  });
  const content = editor.getJSON();
  render(
    <DndProvider backend={HTML5Backend}>
      <EditorContent editor={editor} />
    </DndProvider>
  );
  const link = await screen.findByRole('link', { name: 'Task' });
  const card = link.parentElement!;
  await waitFor(() => expect(card).toHaveAttribute('draggable', 'true'));
  const done = screen.getByText('Done');
  const other = screen.getByText('Other board');

  const drag = async () => {
    const dataTransfer = transfer();
    expect(fireEvent.dragStart(card, { dataTransfer })).toBe(true);
    expect(dataTransfer.types).toContain(boardRecordDragMime);
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    return dataTransfer;
  };

  fireEvent.dragEnd(card, { dataTransfer: await drag() });
  expect(state.execute).not.toHaveBeenCalled();
  const foreign = await drag();
  fireEvent.dragOver(other, { dataTransfer: foreign });
  fireEvent.drop(other, { dataTransfer: foreign });
  expect(state.execute).not.toHaveBeenCalled();

  const dataTransfer = await drag();
  fireEvent.dragOver(done, { dataTransfer });
  fireEvent.drop(done, { dataTransfer });
  expect(state.execute).toHaveBeenCalledExactlyOnceWith({
    type: 'record.field.set',
    userId: 'member',
    recordId: 'record',
    databaseId: 'database',
    fieldId: 'status',
    value: { type: 'string', value: 'done' },
  });
  expect(editor.getJSON()).toEqual(content);
});

it('moves the source tag while retaining other tags and ignores a stale source', () => {
  const current = {
    type: 'string_array',
    value: ['todo', 'other', 'done'],
  } as const;
  expect(
    getBoardMoveValue(
      'multi_select',
      { ...current, value: [...current.value] },
      'todo',
      'done'
    )
  ).toEqual({ type: 'string_array', value: ['other', 'done'] });
  expect(
    getBoardMoveValue('select', { type: 'string', value: 'done' }, 'todo', null)
  ).toBeUndefined();
});
