import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LocalRecordNode } from '@colanode/client/types';
import { TableBulkActions } from '@colanode/ui/components/databases/tables/table-bulk-actions';

const state = vi.hoisted(() => ({
  role: 'admin',
  execute: vi.fn(),
  clear: vi.fn(),
}));
vi.mock('@colanode/ui/contexts/workspace', () => ({
  useWorkspace: () => ({ userId: 'human' }),
}));
vi.mock('@colanode/ui/contexts/database', () => ({
  useDatabase: () => ({
    id: 'db',
    role: state.role,
    fields: [
      {
        id: 'status',
        type: 'select',
        name: 'Status',
        index: 'a0',
        options: {
          done: { id: 'done', name: 'Done', color: 'blue', index: 'a0' },
        },
      },
    ],
  }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const records = ['Alpha', 'Beta'].map((name, index) => ({
  id: `${index}`,
  type: 'record',
  name,
  createdBy: 'other',
  databaseId: 'db',
  fields: {},
})) as LocalRecordNode[];
beforeEach(() => {
  state.role = 'admin';
  state.execute
    .mockReset()
    .mockResolvedValue({ success: true, output: { success: true } });
  state.clear.mockReset();
  Object.assign(window, { colanode: { executeMutation: state.execute } });
});
describe('table selected-row actions', () => {
  it('shows the target rows, then sends only the chosen field for each selected record', async () => {
    render(<TableBulkActions records={records} clearSelection={state.clear} />);
    fireEvent.click(screen.getByText('Edit selected'));
    expect(screen.getByLabelText('Rows to change')).toHaveTextContent(
      'AlphaBeta'
    );
    fireEvent.change(screen.getByLabelText('Field to edit'), {
      target: { value: 'status' },
    });
    fireEvent.change(screen.getByLabelText('New value'), {
      target: { value: 'done' },
    });
    fireEvent.click(screen.getByText('Apply to 2 rows'));
    await waitFor(() => expect(state.execute).toHaveBeenCalledTimes(2));
    expect(state.execute.mock.calls.map(([input]) => input)).toEqual(
      records.map((record) => ({
        type: 'record.field.set',
        userId: 'human',
        databaseId: 'db',
        recordId: record.id,
        fieldId: 'status',
        value: { type: 'string', value: 'done' },
      }))
    );
    await waitFor(() =>
      expect(state.clear).toHaveBeenCalledWith(new Set(['0', '1']))
    );
  });
  it('does not delete before confirmation and retains failures for a partial delete', async () => {
    state.execute
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({
        success: false,
        error: { message: 'Permission changed' },
      });
    render(<TableBulkActions records={records} clearSelection={state.clear} />);
    fireEvent.click(screen.getByText('Delete selected'));
    expect(state.execute).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Delete 2 rows'));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        '1 succeeded; 1 failed'
      )
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Beta: Permission changed'
    );
    expect(state.clear).toHaveBeenCalledWith(new Set(['0']));
    expect(state.execute.mock.calls[0]![0]).toEqual({
      type: 'node.delete',
      userId: 'human',
      nodeId: '0',
    });
  });
  it('respects read-only records instead of enabling bulk writes', () => {
    state.role = 'viewer';
    render(<TableBulkActions records={records} clearSelection={state.clear} />);
    expect(screen.getByText('Edit selected')).toBeDisabled();
    expect(screen.getByText('Delete selected')).toBeDisabled();
    expect(state.execute).not.toHaveBeenCalled();
  });
});
