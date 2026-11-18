import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { TableViewBody } from '@colanode/ui/components/databases/tables/table-view-body';

const state = vi.hoisted(() => ({
  data: [],
  isReady: false,
  isError: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: vi.fn(),
}));
const manual = vi.hoisted(() => ({
  enabled: false,
  ranked: { isReady: false, isError: false },
  unranked: { isReady: false, isError: false },
}));
vi.mock('@colanode/ui/hooks/use-records-query', () => ({
  useRecordsQuery: (
    _filters: unknown,
    _sorts: unknown,
    _count?: number,
    ids?: { mode: 'include' | 'exclude' }
  ) =>
    ids
      ? {
          ...state,
          ...(ids.mode === 'include' ? manual.ranked : manual.unranked),
        }
      : state,
}));
vi.mock('@colanode/ui/contexts/database-view', () => ({
  useDatabaseView: () => ({
    filters: [],
    sorts: [],
    manualSort: manual.enabled,
  }),
}));
vi.mock('@colanode/ui/contexts/database', () => ({
  useDatabase: () => ({ id: 'db', canEdit: true }),
}));
vi.mock('@colanode/ui/contexts/workspace', () => ({
  useWorkspace: () => ({ userId: 'member' }),
}));
vi.mock('@colanode/ui/components/databases/tables/table-bulk-actions', () => ({
  TableBulkActions: () => null,
}));
vi.mock('@colanode/ui/components/databases/tables/table-view-header', () => ({
  TableViewHeader: () => null,
}));
vi.mock('@colanode/ui/components/databases/tables/table-view-row', () => ({
  TableViewRow: () => null,
}));

it('shows loading, failure and a confirmed empty result separately', () => {
  const view = render(<TableViewBody />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading records');
  expect(screen.queryByText('No records')).toBeNull();
  state.isError = true;
  view.rerender(<TableViewBody />);
  expect(screen.getByRole('alert')).toHaveTextContent('Could not load records');
  expect(screen.queryByText('No records')).toBeNull();
  state.isError = false;
  state.isReady = true;
  view.rerender(<TableViewBody />);
  expect(screen.getByText('No records')).toBeVisible();
  expect(screen.queryByRole('status')).toBeNull();
});

it('waits for both manual-order queries and shows a failure from either query', () => {
  manual.enabled = true;
  const view = render(<TableViewBody />);
  manual.unranked.isReady = true;
  view.rerender(<TableViewBody />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading records');
  expect(screen.queryByText('No records')).toBeNull();

  manual.ranked.isError = true;
  view.rerender(<TableViewBody />);
  expect(screen.getByRole('alert')).toHaveTextContent('Could not load records');
  expect(screen.queryByText('No records')).toBeNull();

  manual.ranked.isError = false;
  manual.ranked.isReady = true;
  manual.unranked.isError = true;
  view.rerender(<TableViewBody />);
  expect(screen.getByRole('alert')).toHaveTextContent('Could not load records');

  manual.unranked.isError = false;
  view.rerender(<TableViewBody />);
  expect(screen.getByText('No records')).toBeVisible();
  expect(screen.queryByRole('status')).toBeNull();
});
