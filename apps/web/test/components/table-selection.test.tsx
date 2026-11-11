import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LocalRecordNode } from '@colanode/client/types';
import { TableViewBody } from '@colanode/ui/components/databases/tables/table-view-body';

const state = vi.hoisted(() => ({
  filters: [] as unknown[],
  execute: vi.fn(),
}));
vi.mock('@colanode/ui/contexts/workspace', () => ({
  useWorkspace: () => ({ userId: 'human' }),
}));
vi.mock('@colanode/ui/contexts/database', () => ({
  useDatabase: () => ({ id: 'db', role: 'admin', fields: [] }),
}));
vi.mock('@colanode/ui/contexts/database-view', () => ({
  useDatabaseView: () => ({
    id: 'view',
    filters: state.filters,
    sorts: [],
    fields: [],
    nameWidth: 300,
  }),
}));
vi.mock('@colanode/ui/hooks/use-records-query', () => ({
  useRecordsQuery: () => ({
    data: ['Alpha', 'Beta', 'Gamma'].map((name, index) => ({
      type: 'record',
      id: `${index}`,
      name,
      createdBy: 'human',
      fields: {},
    })),
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
  state.execute.mockReset().mockResolvedValue({ success: true });
  Object.assign(window, { colanode: { executeMutation: state.execute } });
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
