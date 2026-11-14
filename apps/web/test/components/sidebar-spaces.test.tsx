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
import { beforeEach, expect, it, vi } from 'vitest';

import type { LocalSpaceNode, Metadata, User } from '@colanode/client/types';
import { SidebarSpaces } from '@colanode/ui/components/layouts/sidebars/sidebar-spaces';
import { buildSpaceViewLink } from '@colanode/ui/lib/space-views';

const fixture = vi.hoisted(() => ({
  userId: 'a',
  hash: '',
  appType: 'desktop',
  preferences: new Map<string, unknown>(),
  nodes: null as unknown,
  users: null as unknown,
  metadata: null as unknown,
}));

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useRouterState: () => fixture.hash,
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
    workspaceId: 'demo',
    role: 'guest',
    collections: { nodes: fixture.nodes, users: fixture.users },
  }),
}));
vi.mock('@colanode/ui/contexts/app', () => ({
  useApp: () => ({ type: fixture.appType }),
}));
vi.mock(
  '@colanode/ui/components/layouts/sidebars/sidebar-shared-pages',
  () => ({
    SidebarSharedPages: () => null,
  })
);
vi.mock('@colanode/ui/hooks/use-metadata', () => {
  return {
    useMetadata: (namespace: string, key: string) => {
      const id = namespace + '/' + key;
      const [value, setValue] = useState(() => fixture.preferences.get(id));
      return [
        value,
        (next: unknown) => {
          fixture.preferences.set(id, next);
          setValue(next);
        },
      ];
    },
  };
});
vi.mock('@colanode/ui/components/spaces/space-sidebar-item', () => ({
  SpaceSidebarItem: ({
    space,
    pinned,
    onTogglePin,
    hidden,
    onToggleHidden,
  }: {
    space: LocalSpaceNode;
    pinned: boolean;
    onTogglePin: () => void;
    hidden: boolean;
    onToggleHidden: () => void;
  }) => (
    <>
      <button aria-pressed={pinned} onClick={onTogglePin}>
        {space.name}
      </button>
      <button onClick={onToggleHidden}>
        {hidden ? 'Show' : 'Hide'} {space.name}
      </button>
    </>
  ),
}));

beforeEach(() => {
  fixture.userId = 'a';
  fixture.hash = '';
  fixture.appType = 'desktop';
  fixture.preferences.clear();
  fixture.nodes = createCollection(
    localOnlyCollectionOptions<LocalSpaceNode>({
      getKey: (space) => space.id,
      initialData: [
        {
          id: '01',
          name: 'Zebra',
          collaborators: { a: 'viewer', b: 'viewer', editor: 'admin' },
          tags: ['Shared', 'Delivery'],
        },
        {
          id: '02',
          name: 'Alpha',
          collaborators: { a: 'viewer', b: 'viewer' },
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
});

it('builds filter options only from the current member’s Spaces and combines search, members and tags', async () => {
  const { rerender } = render(<SidebarSpaces />);
  await screen.findByRole('button', { name: 'Zebra' });
  const filterButton = screen.getByRole('button', {
    name: 'Sort and filter Spaces',
  });
  fireEvent.click(filterButton);
  const filters = within(await screen.findByRole('dialog'));
  expect(filters.queryByLabelText('Company B')).toBeInTheDocument();
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

  fireEvent.click(filters.getByLabelText('Company A'));
  fireEvent.click(filters.getByLabelText('Project editor'));
  fireEvent.click(filters.getByLabelText('Shared'));
  fireEvent.click(filters.getByLabelText('Delivery'));
  expect(order()).toEqual(['Zebra']);
  fireEvent.change(filters.getByLabelText('Tags match mode'), {
    target: { value: 'any' },
  });
  // The separate member condition still has to match.
  expect(order()).toEqual(['Zebra']);
  fireEvent.change(filters.getByLabelText('Members match mode'), {
    target: { value: 'any' },
  });
  expect(order()).toEqual(['Alpha', 'Zebra']);
  fireEvent.click(filters.getByLabelText('Project editor'));
  fireEvent.click(filters.getByLabelText('Company A'));
  fireEvent.change(filters.getByLabelText('View name'), {
    target: { value: 'アニメーター用' },
  });
  fireEvent.click(filters.getByRole('button', { name: 'Save view' }));
  const viewList = screen.getByRole('combobox', { name: 'Space view' });
  fireEvent.change(viewList, { target: { value: '' } });
  expect(order()).toEqual(['Alpha', 'Zebra']);
  fireEvent.change(viewList, { target: { value: 'アニメーター用' } });
  expect(filters.getByLabelText('Tags match mode')).toHaveValue('any');
  expect(order()).toEqual(['Alpha', 'Zebra']);
  fireEvent.change(filters.getByLabelText('Tags match mode'), {
    target: { value: 'all' },
  });
  expect(order()).toEqual(['Zebra']);
  fireEvent.click(screen.getByRole('button', { name: 'Hide Zebra' }));
  expect(screen.queryByRole('button', { name: 'Zebra' })).toBeNull();
  fireEvent.click(filters.getByLabelText(/Include my hidden Spaces/));
  expect(order()).toEqual(['Zebra']);
  expect(
    screen.getByRole('button', { name: 'Show Zebra' })
  ).toBeInTheDocument();
  fireEvent.click(filters.getByLabelText(/Include my hidden Spaces/));

  const shareLink = buildSpaceViewLink('http://localhost:18400', 'demo', {
    name: 'アニメーター用',
    search: '',
    members: [],
    tags: ['Delivery', 'Shared'],
    sort: 'name',
  });
  fixture.hash = new URL(shareLink).hash;
  fixture.userId = 'b';
  rerender(<SidebarSpaces />);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Zebra' })).toBeInTheDocument()
  );
  expect(screen.getByRole('combobox', { name: 'Space view' })).toHaveValue(
    'アニメーター用'
  );
  expect(screen.queryByRole('button', { name: 'Alpha' })).toBeNull();
  fireEvent.click(
    screen.getByRole('button', { name: 'Sort and filter Spaces' })
  );
  const companyBFilters = within(await screen.findByRole('dialog'));
  expect(companyBFilters.getByLabelText('Tags match mode')).toHaveValue('all');
  expect(companyBFilters.getByLabelText('B internal')).toBeInTheDocument();
  expect(
    companyBFilters.queryByLabelText(/Include my hidden Spaces/)
  ).toBeNull();

  const anyViewLink = buildSpaceViewLink('http://localhost:18400', 'demo', {
    name: '作画または共通',
    search: '',
    members: [],
    tags: ['Unavailable', 'Shared'],
    tagMatch: 'any',
    sort: 'name',
  });
  fixture.hash = new URL(anyViewLink).hash;
  rerender(<SidebarSpaces />);
  expect(companyBFilters.getByLabelText('Tags match mode')).toHaveValue('any');
  expect(order()).toEqual(['Alpha', 'Zebra']);
  expect(screen.queryByRole('button', { name: 'Private B' })).toBeNull();

  fixture.hash = new URL(
    buildSpaceViewLink('http://localhost:18400', 'demo', {
      name: 'Missing tag',
      search: '',
      members: [],
      tags: ['Unavailable'],
      sort: 'name',
    })
  ).hash;
  rerender(<SidebarSpaces />);
  expect(screen.getByText('No matching Spaces')).toBeInTheDocument();
  expect(companyBFilters.queryByLabelText('Unavailable')).toBeNull();
});

it('restores a saved AND/OR group and copies its conditions for another member', async () => {
  fixture.appType = 'web';
  const writeText = vi
    .fn<(text: string) => Promise<void>>()
    .mockResolvedValue();
  const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });

  try {
    const { rerender } = render(<SidebarSpaces />);
    await screen.findByRole('button', { name: 'Alpha' });
    fireEvent.click(
      screen.getByRole('button', { name: 'Sort and filter Spaces' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Advanced filter' }));
    const editor = within(
      await screen.findByRole('dialog', { name: 'Advanced Space filter' })
    );

    fireEvent.click(editor.getByRole('button', { name: 'Add condition' }));
    fireEvent.change(editor.getByLabelText('Filter field'), {
      target: { value: 'tag' },
    });
    fireEvent.change(editor.getByLabelText('Filter value'), {
      target: { value: 'Shared' },
    });
    fireEvent.click(editor.getByRole('button', { name: 'Add group' }));
    const group = within(
      editor.getByRole('group', { name: 'Group', exact: true })
    );
    fireEvent.change(group.getByLabelText('Group match mode'), {
      target: { value: 'any' },
    });
    fireEvent.change(group.getByLabelText('Filter value'), {
      target: { value: 'Zebra' },
    });
    fireEvent.click(group.getByRole('button', { name: 'Add condition' }));
    fireEvent.change(group.getAllByLabelText('Filter value')[1]!, {
      target: { value: 'Private B' },
    });
    fireEvent.click(editor.getByRole('button', { name: 'Apply filter' }));
    expect(screen.getByRole('button', { name: 'Zebra' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Alpha' })).toBeNull();

    fireEvent.change(await screen.findByLabelText('View name'), {
      target: { value: '制作ビュー' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save view' }));
    const viewSelect = screen.getByRole('combobox', { name: 'Space view' });
    fireEvent.change(viewSelect, { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'Alpha' })).toBeInTheDocument();
    fireEvent.change(viewSelect, { target: { value: '制作ビュー' } });
    expect(screen.queryByRole('button', { name: 'Alpha' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Copy view link' }));
    expect(writeText).toHaveBeenCalledOnce();
    fixture.hash = new URL(writeText.mock.calls[0]![0]).hash;
    fixture.userId = 'b';
    rerender(<SidebarSpaces />);
    expect(
      await screen.findByRole('combobox', { name: 'Space view' })
    ).toHaveValue('制作ビュー');
    expect(screen.getByRole('button', { name: 'Zebra' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Alpha' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Private B' })).toBeNull();
  } finally {
    if (clipboard) Object.defineProperty(navigator, 'clipboard', clipboard);
    else Reflect.deleteProperty(navigator, 'clipboard');
  }
});
