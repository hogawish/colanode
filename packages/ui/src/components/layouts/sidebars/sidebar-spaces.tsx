import { eq, useLiveQuery } from '@tanstack/react-db';
import { ListFilter, Search } from 'lucide-react';
import { useState } from 'react';

import { LocalSpaceNode } from '@colanode/client/types';
import { collections } from '@colanode/ui/collections';
import { SidebarHeader } from '@colanode/ui/components/layouts/sidebars/sidebar-header';
import { SidebarSharedPages } from '@colanode/ui/components/layouts/sidebars/sidebar-shared-pages';
import { SpaceCreateButton } from '@colanode/ui/components/spaces/space-create-button';
import { SpaceSidebarItem } from '@colanode/ui/components/spaces/space-sidebar-item';
import { Button } from '@colanode/ui/components/ui/button';
import { Input } from '@colanode/ui/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@colanode/ui/components/ui/popover';
import { useApp } from '@colanode/ui/contexts/app';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { useMetadata } from '@colanode/ui/hooks/use-metadata';
import {
  recordSpaceVisit,
  spaceVisitsNamespace,
} from '@colanode/ui/lib/space-visits';

type SpaceSort = 'created' | 'name' | 'recent';

const compareNames = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
}).compare;

const toggle = (values: string[], value: string) =>
  values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];

const FilterOptions = ({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) => (
  <fieldset className="min-w-0">
    <legend className="mb-1 text-sm font-medium">{title}</legend>
    {options.length ? (
      <div className="max-h-36 space-y-0.5 overflow-y-auto">
        {options.map(({ id, label }) => (
          <label
            key={id}
            className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent"
            title={label}
          >
            <input
              type="checkbox"
              checked={selected.includes(id)}
              onChange={() => onToggle(id)}
              className="shrink-0"
            />
            <span className="truncate">{label}</span>
          </label>
        ))}
      </div>
    ) : (
      <p className="text-xs text-muted-foreground">
        No {title.toLowerCase()} available
      </p>
    )}
  </fieldset>
);

export const SidebarSpaces = () => {
  const workspace = useWorkspace();
  return <WorkspaceSpaces key={workspace.userId} />;
};

const WorkspaceSpaces = () => {
  const workspace = useWorkspace();
  const app = useApp();
  const [search, setSearch] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [sort, setSort] = useMetadata<SpaceSort>(
    workspace.userId,
    'space-sort'
  );
  const [pins = [], setPins] = useMetadata<string[]>(
    workspace.userId,
    'space-pins'
  );
  const visitsNamespace = spaceVisitsNamespace(workspace.userId);
  const canCreateSpace =
    workspace.role !== 'guest' && workspace.role !== 'none';

  const spaceListQuery = useLiveQuery(
    (q) =>
      q
        .from({ nodes: workspace.collections.nodes })
        .where(({ nodes }) => eq(nodes.type, 'space'))
        .orderBy(({ nodes }) => nodes.id, 'asc'),
    [workspace.userId]
  );
  const users = useLiveQuery(
    (q) => q.from({ users: workspace.collections.users }),
    [workspace.userId]
  ).data;
  const visits = useLiveQuery(
    (q) =>
      q
        .from({ items: collections.metadata })
        .where(({ items }) => eq(items.namespace, visitsNamespace)),
    [visitsNamespace]
  ).data;

  const spaces = spaceListQuery.data
    .map((node) => node as LocalSpaceNode)
    .filter((space) => space.collaborators[workspace.userId]);
  const memberIds = new Set(
    spaces.flatMap((space) => Object.keys(space.collaborators))
  );
  const memberOptions = users
    .filter((user) => memberIds.has(user.id))
    .map((user) => ({
      id: user.id,
      label: user.customName || user.name || user.email,
    }))
    .sort((a, b) => compareNames(a.label, b.label));
  const tagOptions = Array.from(
    new Set(spaces.flatMap((space) => space.tags ?? []))
  )
    .sort(compareNames)
    .map((tag) => ({ id: tag, label: tag }));
  const activeMembers = members.filter((id) => memberIds.has(id));
  const availableTags = new Set(tagOptions.map(({ id }) => id));
  const activeTags = tags.filter((tag) => availableTags.has(tag));
  const filterCount = activeMembers.length + activeTags.length;
  const searchTerm = search.trim().normalize('NFKC').toLocaleLowerCase();
  const visitDates = new Map(visits.map((item) => [item.key, item.value]));
  const pinned = new Set(pins);
  const visibleSpaces = spaces.filter(
    (space) =>
      space.name.normalize('NFKC').toLocaleLowerCase().includes(searchTerm) &&
      activeMembers.every((id) => space.collaborators[id]) &&
      activeTags.every((tag) => space.tags?.includes(tag))
  );
  visibleSpaces.sort((a, b) => {
    const pinOrder = Number(pinned.has(b.id)) - Number(pinned.has(a.id));
    if (pinOrder) return pinOrder;
    if (sort === 'name') return compareNames(a.name, b.name);
    if (sort === 'recent') {
      return (visitDates.get(b.id) ?? '').localeCompare(
        visitDates.get(a.id) ?? ''
      );
    }
    return 0;
  });

  return (
    <div className="flex flex-col group/sidebar h-full px-2">
      <SidebarHeader
        title="Spaces"
        actions={canCreateSpace && <SpaceCreateButton />}
      />
      <div className="mb-2 flex items-center gap-1 px-1">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-2 left-2 size-4 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Search Spaces"
            placeholder="Search Spaces"
            className="h-8 pl-7 text-sm"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={filterCount ? 'secondary' : 'ghost'}
              size="icon"
              className={filterCount ? 'h-8 w-auto gap-1 px-1.5' : 'size-8'}
              aria-label="Sort and filter Spaces"
              title="Sort and filter Spaces"
            >
              <ListFilter />
              {filterCount > 0 && <span>{filterCount}</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="space-y-3">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Sort Spaces
              <select
                className="h-8 rounded-md border bg-background px-2 font-normal"
                value={sort ?? 'created'}
                onChange={(event) => setSort(event.target.value as SpaceSort)}
              >
                <option value="created">Creation order</option>
                <option value="name">Name</option>
                <option value="recent">Recently opened</option>
              </select>
            </label>
            <FilterOptions
              title="Members"
              options={memberOptions}
              selected={activeMembers}
              onToggle={(id) => setMembers(toggle(activeMembers, id))}
            />
            <FilterOptions
              title="Tags"
              options={tagOptions}
              selected={activeTags}
              onToggle={(tag) => setTags(toggle(activeTags, tag))}
            />
            {filterCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setMembers([]);
                  setTags([]);
                }}
              >
                Clear filters
              </Button>
            )}
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex w-full min-w-0 flex-col gap-1">
        {visibleSpaces.map((space) => (
          <SpaceSidebarItem
            space={space}
            key={space.id}
            pinned={pinned.has(space.id)}
            onTogglePin={() => setPins(toggle(pins, space.id))}
            onOpenReference={() => recordSpaceVisit(workspace.userId, space.id)}
          />
        ))}
        {!spaceListQuery.isLoading &&
          visibleSpaces.length === 0 &&
          (searchTerm || filterCount > 0) && (
            <p className="px-2 py-1 text-sm text-muted-foreground">
              No matching Spaces
            </p>
          )}
      </div>
      {app.type === 'web' && <SidebarSharedPages />}
    </div>
  );
};
