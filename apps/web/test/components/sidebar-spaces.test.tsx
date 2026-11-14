import {
  createCollection,
  localOnlyCollectionOptions,
} from '@tanstack/react-db';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { useState } from 'react';
import { expect, it, vi } from 'vitest';

import type { LocalSpaceNode, Metadata, User } from '@colanode/client/types';
import { SidebarSpaces } from '@colanode/ui/components/layouts/sidebars/sidebar-spaces';

const fixture = vi.hoisted(() => ({
  userId: 'a',
  nodes: null as unknown,
  users: null as unknown,
  metadata: null as unknown,
}));

vi.mock('@colanode/ui/collections', () => ({
  collections: {
    get metadata() {
      return fixture.metadata;
    },
  },
}));
vi.mock('@colanode/ui/contexts/workspace', () => ({
  useWorkspace: () => ({
    userId: fixture.userId,
    role: 'guest',
    collections: { nodes: fixture.nodes, users: fixture.users },
  }),
}));
vi.mock('@colanode/ui/contexts/app', () => ({
  useApp: () => ({ type: 'desktop' }),
}));
vi.mock('@colanode/ui/hooks/use-metadata', () => ({ useMetadata: useState }));
vi.mock('@colanode/ui/components/spaces/space-sidebar-item', () => ({
  SpaceSidebarItem: ({
    space,
    pinned,
    onTogglePin,
  }: {
    space: LocalSpaceNode;
    pinned: boolean;
    onTogglePin: () => void;
  }) => (
    <button aria-pressed={pinned} onClick={onTogglePin}>
      {space.name}
    </button>
  ),
}));

it('builds filter options only from the current member’s Spaces and combines search, members and tags', async () => {
  fixture.nodes = createCollection(
    localOnlyCollectionOptions<LocalSpaceNode>({
      getKey: (space) => space.id,
      initialData: [
        {
          id: '01',
          name: 'Zebra',
          collaborators: { a: 'viewer', editor: 'admin' },
          tags: ['Shared', 'Delivery'],
        },
        {
          id: '02',
          name: 'Alpha',
          collaborators: { a: 'viewer' },
          tags: ['Shared'],
        },
        {
          id: '03',
          name: 'Private B',
          collaborators: { b: 'viewer' },
          tags: ['B internal'],
        },
      ].map((space) => ({ ...space, type: 'space' }) as LocalSpaceNode),
    })
  );
  fixture.users = createCollection(
    localOnlyCollectionOptions<User>({
      getKey: (user) => user.id,
      initialData: [
        { id: 'a', name: 'Company A' },
        { id: 'b', name: 'Company B' },
        { id: 'editor', name: 'Project editor' },
      ] as User[],
    })
  );
  fixture.metadata = createCollection(
    localOnlyCollectionOptions<Metadata>({
      getKey: (item) => item.key,
      initialData: [
        {
          namespace: 'space-visits:a',
          key: '01',
          value: '2026-11-14T00:00:00.000Z',
          createdAt: '',
          updatedAt: null,
        },
      ],
    })
  );

  const { rerender } = render(<SidebarSpaces />);
  await screen.findByRole('button', { name: 'Zebra' });
  const filterButton = screen.getByRole('button', {
    name: 'Sort and filter Spaces',
  });
  fireEvent.click(filterButton);
  const filters = within(await screen.findByRole('dialog'));
  expect(filters.queryByLabelText('Company B')).not.toBeInTheDocument();
  expect(filters.queryByLabelText('B internal')).not.toBeInTheDocument();
  fireEvent.click(filters.getByLabelText('Project editor'));
  fireEvent.click(filters.getByLabelText('Delivery'));
  expect(
    screen.queryByRole('button', { name: 'Alpha' })
  ).not.toBeInTheDocument();

  const search = screen.getByRole('searchbox');
  fireEvent.change(search, { target: { value: 'alpha' } });
  expect(screen.getByText('No matching Spaces')).toBeInTheDocument();
  fireEvent.change(search, { target: { value: '' } });
  fireEvent.click(filters.getByRole('button', { name: 'Clear filters' }));
  fireEvent.change(filters.getByLabelText('Sort Spaces'), {
    target: { value: 'name' },
  });

  const order = () =>
    screen
      .getAllByRole('button', { name: /^(Alpha|Zebra)$/ })
      .map((button) => button.textContent);
  expect(order()).toEqual(['Alpha', 'Zebra']);
  fireEvent.change(filters.getByLabelText('Sort Spaces'), {
    target: { value: 'recent' },
  });
  expect(order()).toEqual(['Zebra', 'Alpha']);
  fireEvent.click(screen.getByRole('button', { name: 'Alpha' }));
  expect(order()).toEqual(['Alpha', 'Zebra']);

  fixture.userId = 'b';
  rerender(<SidebarSpaces />);
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Private B' })
    ).toBeInTheDocument()
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Sort and filter Spaces' })
  );
  const companyBFilters = within(await screen.findByRole('dialog'));
  expect(companyBFilters.getByLabelText('B internal')).toBeInTheDocument();
  expect(companyBFilters.queryByLabelText('Company A')).not.toBeInTheDocument();
  expect(companyBFilters.queryByLabelText('Delivery')).not.toBeInTheDocument();
});
