import { renderHook, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { expect, it, vi } from 'vitest';

import type { LocalNode } from '@colanode/client/types';
import type { DatabaseViewFilterAttributes } from '@colanode/core';
import { createNodesCollection } from '@colanode/ui/collections/nodes';
import { DatabaseContext } from '@colanode/ui/contexts/database';
import { WorkspaceContext } from '@colanode/ui/contexts/workspace';
import { useRecordsQuery } from '@colanode/ui/hooks/use-records-query';

vi.mock('@colanode/ui/lib/nodes', () => ({ applyNodeTransaction: vi.fn() }));

type BackendFilter = { field: string[]; operator: string; value: unknown };
type BackendQuery = { filters: BackendFilter[]; limit?: number };
const readField = (row: unknown, keys: string[]): unknown =>
  keys.reduce<unknown>(
    (value, key) =>
      value !== null && typeof value === 'object'
        ? (value as Record<string, unknown>)[key]
        : undefined,
    row
  );
const filters = [
  { type: 'field', fieldId: 'kind', operator: 'is_in', value: ['todo'] },
  { type: 'field', fieldId: 'done', operator: 'is_false' },
] as DatabaseViewFilterAttributes[];
const sorts: [] = [];
const record = (id: string, done?: boolean, databaseId = 'db'): LocalNode =>
  ({
    id,
    type: 'record',
    databaseId,
    name: id,
    fields: {
      kind: { type: 'string', value: 'todo' },
      ...(done === undefined ? {} : { done: { type: 'boolean', value: done } }),
    },
    createdAt: '2026-01-01',
    createdBy: 'agent',
    rootId: 'space',
    parentId: databaseId,
    localRevision: '1',
    serverRevision: '1',
  }) as LocalNode;

const mount = (
  rows: LocalNode[],
  deferred = false,
  ids?: { mode: 'include' | 'exclude'; values: readonly string[] }
) => {
  let release!: () => void;
  const gate = deferred
    ? new Promise<void>((resolve) => {
        release = resolve;
      })
    : Promise.resolve();
  const executeQuery = vi.fn(async (query: BackendQuery) => {
    const isRecords = query.filters.some(
      (filter: BackendFilter) => filter.field[0] === 'databaseId'
    );
    if (!isRecords) return [];
    await gate;
    const result = rows.filter((row) =>
      query.filters.every((filter: BackendFilter) => {
        const value = readField(row, filter.field);
        if (filter.operator === 'eq') return value === filter.value;
        if (filter.operator === 'in' || filter.operator === 'inArray')
          return Array.isArray(filter.value) && filter.value.includes(value);
        if (filter.operator === 'not_in' || filter.operator === 'not_inArray')
          return !(Array.isArray(filter.value) && filter.value.includes(value));
        throw new Error(`Unexpected test backend filter: ${filter.operator}`);
      })
    );
    return query.limit ? result.slice(0, query.limit) : result;
  });
  Object.assign(window, {
    colanode: { executeQuery },
    eventBus: { subscribe: () => 'test', unsubscribe: vi.fn() },
  });
  const nodes = createNodesCollection('agent');
  const workspace = {
    workspaceId: 'workspace',
    accountId: 'account',
    userId: 'agent',
    role: 'admin',
    collections: { nodes },
  } as ComponentProps<typeof WorkspaceContext.Provider>['value'];
  const database = {
    id: 'db',
    name: 'Test',
    fields: [
      { id: 'kind', type: 'select' },
      { id: 'done', type: 'boolean' },
    ],
  } as ComponentProps<typeof DatabaseContext.Provider>['value'];
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <WorkspaceContext.Provider value={workspace}>
      <DatabaseContext.Provider value={database}>
        {children}
      </DatabaseContext.Provider>
    </WorkspaceContext.Provider>
  );
  const count = ids?.mode === 'include' ? ids.values.length + 1 : undefined;
  const hook = renderHook(
    ({ currentFilters }) => useRecordsQuery(currentFilters, sorts, count, ids),
    { wrapper, initialProps: { currentFilters: filters } }
  );
  return { ...hook, executeQuery, release };
};

it('loads the pending view cold and after All → pending without changing data or filters', async () => {
  const hook = mount([
    record('false', false),
    record('unset'),
    record('done', true),
    record('other-db', false, 'other'),
  ]);
  await waitFor(() =>
    expect(hook.result.current.data.map((row) => row.id)).toEqual([
      'false',
      'unset',
    ])
  );
  expect(hook.result.current.isReady).toBe(true);
  hook.rerender({ currentFilters: [] });
  await waitFor(() => expect(hook.result.current.data).toHaveLength(3));
  hook.rerender({ currentFilters: filters });
  await waitFor(() =>
    expect(hook.result.current.data.map((row) => row.id)).toEqual([
      'false',
      'unset',
    ])
  );
});

it('does not truncate a complex filter before evaluating it locally', async () => {
  const rows = Array.from({ length: 130 }, (_, index) =>
    record(`done-${index}`, true)
  );
  rows.push(record('late-pending', false));
  const hook = mount(rows);
  await waitFor(() =>
    expect(hook.result.current.data.map((row) => row.id)).toEqual([
      'late-pending',
    ])
  );
  const request = hook.executeQuery.mock.calls
    .map(([query]) => query)
    .find((query) =>
      query.filters.some(
        (filter: BackendFilter) => filter.field[0] === 'databaseId'
      )
    );
  expect(request?.limit).toBeUndefined();
  expect(request?.filters).toContainEqual({
    field: ['databaseId'],
    operator: 'eq',
    value: 'db',
  });
});

it('keeps a pending load distinct from a ready empty result', async () => {
  const hook = mount([], true);
  await waitFor(() =>
    expect(
      hook.executeQuery.mock.calls.some(([query]) =>
        query.filters.some(
          (filter: BackendFilter) => filter.field[0] === 'databaseId'
        )
      )
    ).toBe(true)
  );
  expect(hook.result.current.isReady).toBe(false);
  expect(hook.result.current.data).toHaveLength(0);
  hook.release();
  await waitFor(() => expect(hook.result.current.isReady).toBe(true));
  expect(hook.result.current.data).toHaveLength(0);
});

it('loads saved rows beyond the first page and excludes them from the remaining pages', async () => {
  const rows = [
    record('a-ranked', false),
    ...Array.from({ length: 130 }, (_, index) =>
      record(`task-${String(index).padStart(3, '0')}`, false)
    ),
    record('z-ranked', false),
    record('z-hidden', true),
  ];
  const values = ['a-ranked', 'z-ranked', 'z-hidden'];
  const ranked = mount(rows, false, { mode: 'include', values });
  await waitFor(() =>
    expect(ranked.result.current.data.map((row) => row.id)).toEqual([
      'a-ranked',
      'z-ranked',
    ])
  );
  ranked.unmount();

  const unranked = mount(rows, false, { mode: 'exclude', values });
  await waitFor(() => expect(unranked.result.current.data).toHaveLength(100));
  unranked.result.current.fetchNextPage();
  await waitFor(() => expect(unranked.result.current.data).toHaveLength(130));
  expect(
    unranked.result.current.data.every((row) => row.id.startsWith('task-'))
  ).toBe(true);
});
