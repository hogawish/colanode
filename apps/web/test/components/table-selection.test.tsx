import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { DndProvider } from 'react-dnd';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LocalRecordNode } from '@colanode/client/types';
import { ViewSortButton } from '@colanode/ui/components/databases/search/view-sort-button';
import { TableViewBody } from '@colanode/ui/components/databases/tables/table-view-body';
import { HTML5Backend } from '@colanode/ui/lib/dnd-backend';

const state = vi.hoisted(() => ({
  filters: [] as unknown[],
  execute: vi.fn(),
  manualSort: false,
  order: [] as string[],
}));
vi.mock('@colanode/ui/contexts/workspace', () => ({
  useWorkspace: () => ({ userId: 'human' }),
}));
vi.mock('@colanode/ui/contexts/database', () => ({
  useDatabase: () => ({ id: 'db', role: 'admin', fields: [], canEdit: true }),
}));
vi.mock('@colanode/ui/contexts/database-view', () => ({
  useDatabaseView: () => ({
    id: 'view',
    layout: 'table',
    manualSort: state.manualSort,
    manualRowOrder: state.order,
    filters: state.filters,
    sorts: [],
    fields: [],
    nameWidth: 300,
  }),
}));
vi.mock('@colanode/ui/hooks/use-records-query', () => ({
  useRecordsQuery: (
    _filters: unknown,
    _sorts: unknown,
    _count?: number,
    ids?: { mode: 'include' | 'exclude'; values: string[] }
  ) => ({
    data: ['Alpha', 'Beta', 'Gamma']
      .map((name, index) => ({
        type: 'record',
        id: `${index}`,
        name,
        createdBy: 'human',
        fields: {},
      }))
      .filter(
        (record) =>
          !ids || ids.values.includes(record.id) === (ids.mode === 'include')
      ),
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
  }),
}));
vi.mock(
  '@colanode/ui/components/databases/tables/table-view-name-cell',
  () => ({
    TableViewNameCell: ({ record }: { record: LocalRecordNode }) => (
      <span>{record.name}</span>
    ),
  })
);
vi.mock('@colanode/ui/components/databases/tables/table-view-header', () => ({
  TableViewHeader: ({ selection }: { selection?: ReactNode }) => (
    <div>{selection}</div>
  ),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
beforeEach(() => {
  state.filters = [];
  state.manualSort = false;
  state.order = [];
  state.execute.mockReset().mockResolvedValue({ success: true });
  Object.assign(window, { colanode: { executeMutation: state.execute } });
});

it('only enables row drag in Manual order and restores the saved order after switching back', async () => {
  state.execute.mockImplementation(async (input) => {
    if (input.action === 'set-mode') state.manualSort = input.manual;
    if (input.action === 'reorder') state.order = ['2', '0', '1'];
    return { success: true, output: { success: true } };
  });
  const table = () => (
    <DndProvider backend={HTML5Backend}>
      <ViewSortButton />
      <TableViewBody />
    </DndProvider>
  );
  const view = render(table());
  const rowNames = () =>
    screen.getAllByText(/^(Alpha|Beta|Gamma)$/).map((row) => row.textContent);
  expect(rowNames()).toEqual(['Alpha', 'Beta', 'Gamma']);
  expect(screen.queryByRole('button', { name: 'Reorder Gamma' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Sort' }));
  fireEvent.click(screen.getByRole('button', { name: 'Manual order' }));
  await waitFor(() => expect(state.manualSort).toBe(true));
  view.rerender(table());

  const grip = screen.getByRole('button', { name: 'Reorder Gamma' });
  const anchor = screen.getByText('Alpha').closest('[data-selected]')!;
  const types: string[] = [];
  const dataTransfer = {
    types,
    setData: (type: string) => {
      if (!types.includes(type)) types.push(type);
    },
    setDragImage: vi.fn(),
    dropEffect: 'none',
    effectAllowed: 'all',
  };
  expect(fireEvent.dragStart(grip, { dataTransfer })).toBe(true);
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  const drop = createEvent.drop(anchor, { dataTransfer });
  Object.defineProperties(drop, {
    clientX: { value: 0 },
    clientY: { value: 0 },
  });
  fireEvent(anchor, drop);
  expect(state.execute).toHaveBeenLastCalledWith({
    type: 'table.order.update',
    action: 'reorder',
    userId: 'human',
    databaseId: 'db',
    viewId: 'view',
    visibleIds: ['0', '1', '2'],
    recordId: '2',
    anchorId: '0',
    side: 'before',
  });
  view.rerender(table());
  expect(rowNames()).toEqual(['Gamma', 'Alpha', 'Beta']);

  fireEvent.click(screen.getByRole('button', { name: 'Sort by property' }));
  await waitFor(() => expect(state.manualSort).toBe(false));
  view.rerender(table());
  expect(rowNames()).toEqual(['Alpha', 'Beta', 'Gamma']);
  expect(screen.queryByRole('button', { name: 'Reorder Gamma' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Manual order' }));
  await waitFor(() => expect(state.manualSort).toBe(true));
  view.rerender(table());
  expect(rowNames()).toEqual(['Gamma', 'Alpha', 'Beta']);
});
describe('table row selection', () => {
  it('supports range selection, select-loaded and clearing selection on filter change', () => {
    const view = render(<TableViewBody />);
    fireEvent.click(screen.getByLabelText('Select Alpha'));
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Select Gamma'), { shiftKey: true });
    expect(screen.getByText('3 selected')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Select loaded rows'));
    expect(screen.queryByText('3 selected')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Select loaded rows'));
    expect(screen.getByText('3 selected')).toBeInTheDocument();
    state.filters = [{ id: 'changed' }];
    view.rerender(<TableViewBody />);
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
  });
  it('right-clicking an unselected row targets only that row after confirmation', async () => {
    render(<TableViewBody />);
    fireEvent.click(screen.getByLabelText('Select Alpha'));
    fireEvent.contextMenu(screen.getByText('Beta'));
    fireEvent.click(await screen.findByText('Delete this row'));
    expect(screen.getByLabelText('Rows to change')).toHaveTextContent('Beta');
    expect(screen.getByLabelText('Rows to change')).not.toHaveTextContent(
      'Alpha'
    );
    expect(state.execute).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Delete 1 rows'));
    await waitFor(() => expect(state.execute).toHaveBeenCalledTimes(1));
    expect(state.execute).toHaveBeenCalledWith({
      type: 'node.delete',
      userId: 'human',
      nodeId: '1',
    });
  });
});
