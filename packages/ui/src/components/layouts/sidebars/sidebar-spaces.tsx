import { eq, useLiveQuery } from '@tanstack/react-db';
import { useRouterState } from '@tanstack/react-router';
import { ListFilter, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { LocalSpaceNode } from '@colanode/client/types';
import { collections } from '@colanode/ui/collections';
import { SidebarHeader } from '@colanode/ui/components/layouts/sidebars/sidebar-header';
import { SidebarSharedPages } from '@colanode/ui/components/layouts/sidebars/sidebar-shared-pages';
import { SpaceAdvancedFilter } from '@colanode/ui/components/spaces/space-advanced-filter';
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
  buildSpaceViewLink,
  matchesAdvancedSpaceFilter,
  matchesSpaceFilter,
  normalizeSpaceName,
  readSpaceViewHash,
  type SpaceMatchMode,
  type SpaceView,
} from '@colanode/ui/lib/space-views';
import {
  recordSpaceVisit,
  spaceVisitsNamespace,
} from '@colanode/ui/lib/space-visits';

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
  mode,
  onToggle,
  onModeChange,
}: {
  title: string;
  options: { id: string; label: string }[];
  selected: string[];
  mode: SpaceMatchMode;
  onToggle: (id: string) => void;
  onModeChange: (mode: SpaceMatchMode) => void;
}) => (
  <fieldset className="min-w-0">
    <legend className="mb-1 text-sm font-medium">{title}</legend>
    {(options.length > 1 || selected.length > 1) && (
      <select
        aria-label={title + ' match mode'}
        className="mb-1 h-7 max-w-full rounded-md border bg-background px-2 text-xs"
        value={mode}
        onChange={(event) =>
          onModeChange(event.target.value === 'any' ? 'any' : 'all')
        }
      >
        <option value="all">Match all</option>
        <option value="any">Match any</option>
      </select>
    )}
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
  const hash = useRouterState({
    select: ({ location }) => location.maskedLocation?.hash || location.hash,
  });
  const [search, setSearch] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [memberMatch, setMemberMatch] = useState<SpaceMatchMode>('all');
  const [tagMatch, setTagMatch] = useState<SpaceMatchMode>('all');
  const [advancedFilter, setAdvancedFilter] =
    useState<SpaceView['advancedFilter']>();
  const [editingAdvanced, setEditingAdvanced] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [viewName, setViewName] = useState('');
  const [viewSort, setViewSort] = useState<SpaceView['sort']>();
  const [showHidden, setShowHidden] = useState(false);
  const [sort, setSort] = useMetadata<SpaceView['sort']>(
    workspace.userId,
    'space-sort'
  );
  const [pins = [], setPins] = useMetadata<string[]>(
    workspace.userId,
    'space-pins'
  );
  const [hidden = [], setHidden] = useMetadata<string[]>(
    workspace.userId,
    'space-hidden'
  );
  const [savedViews = [], setSavedViews] = useMetadata<SpaceView[]>(
    workspace.userId,
    'space-views'
  );
  const selectedSort = viewSort ?? sort ?? 'created';

  const applyView = (view: SpaceView) => {
    setViewName(view.name);
    setSearch(view.search);
    setMembers(view.members);
    setTags(view.tags);
    setMemberMatch(view.memberMatch ?? 'all');
    setTagMatch(view.tagMatch ?? 'all');
    setAdvancedFilter(view.advancedFilter);
    setViewSort(view.sort);
  };

  useEffect(() => {
    const view = readSpaceViewHash(hash);
    if (view) applyView(view);
  }, [hash]);

  const currentView = (): SpaceView => ({
    name: viewName.trim(),
    search: search.trim(),
    members,
    tags,
    memberMatch,
    tagMatch,
    advancedFilter,
    sort: selectedSort,
  });

  const copyViewLink = async () => {
    try {
      await navigator.clipboard.writeText(
        buildSpaceViewLink(
          window.location.origin,
          workspace.workspaceId,
          currentView()
        )
      );
      toast.success('Space view link copied.');
    } catch {
      toast.error('Could not copy the Space view link.');
    }
  };

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
  const availableMembers = new Set(memberOptions.map(({ id }) => id));
  const availableTags = new Set(tagOptions.map(({ id }) => id));
  const filterCount = members.length + tags.length + Number(!!advancedFilter);
  const missingFilter =
    members.some((id) => !availableMembers.has(id)) ||
    tags.some((tag) => !availableTags.has(tag));
  const searchTerm = normalizeSpaceName(search);
  const visitDates = new Map(visits.map((item) => [item.key, item.value]));
  const pinned = new Set(pins);
  const hiddenIds = new Set(hidden);
  const hiddenCount = spaces.filter((space) => hiddenIds.has(space.id)).length;
  const visibleSpaces = spaces.filter(
    (space) =>
      (showHidden || !hiddenIds.has(space.id)) &&
      normalizeSpaceName(space.name).includes(searchTerm) &&
      matchesSpaceFilter(members, memberMatch, (id) =>
        Object.hasOwn(space.collaborators, id)
      ) &&
      matchesSpaceFilter(tags, tagMatch, (tag) =>
        (space.tags ?? []).includes(tag)
      ) &&
      (!advancedFilter || matchesAdvancedSpaceFilter(advancedFilter, space))
  );
  visibleSpaces.sort((a, b) => {
    const pinOrder = Number(pinned.has(b.id)) - Number(pinned.has(a.id));
    if (pinOrder) return pinOrder;
    if (selectedSort === 'name') return compareNames(a.name, b.name);
    if (selectedSort === 'recent') {
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
      {(viewName || savedViews.length > 0) && (
        <label className="mb-2 block px-1">
          <select
            aria-label="Space view"
            className="h-8 w-full truncate rounded-md border bg-background px-2 text-sm"
            value={viewName}
            onChange={(event) => {
              const view = savedViews.find(
                (item) => item.name === event.target.value
              );
              applyView(
                view ?? {
                  name: '',
                  search: '',
                  members: [],
                  tags: [],
                  sort: sort ?? 'created',
                }
              );
              if (!view) setViewSort(undefined);
            }}
          >
            <option value="">All Spaces</option>
            {savedViews.map((view) => (
              <option key={view.name}>{view.name}</option>
            ))}
            {viewName && !savedViews.some((view) => view.name === viewName) && (
              <option>{viewName}</option>
            )}
          </select>
        </label>
      )}
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
        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
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
          <PopoverContent
            align="end"
            className="max-h-(--radix-popover-content-available-height) space-y-3 overflow-y-auto"
          >
            <label className="flex flex-col gap-1 text-sm font-medium">
              Sort Spaces
              <select
                className="h-8 rounded-md border bg-background px-2 font-normal"
                value={selectedSort}
                onChange={(event) => {
                  const value = event.target.value as SpaceView['sort'];
                  if (viewName) setViewSort(value);
                  else setSort(value);
                }}
              >
                <option value="created">Creation order</option>
                <option value="name">Name</option>
                <option value="recent">Recently opened</option>
              </select>
            </label>
            <FilterOptions
              title="Members"
              options={memberOptions}
              selected={members}
              mode={memberMatch}
              onToggle={(id) => setMembers(toggle(members, id))}
              onModeChange={setMemberMatch}
            />
            <FilterOptions
              title="Tags"
              options={tagOptions}
              selected={tags}
              mode={tagMatch}
              onToggle={(tag) => setTags(toggle(tags, tag))}
              onModeChange={setTagMatch}
            />
            <Button
              size="sm"
              variant={advancedFilter ? 'secondary' : 'outline'}
              onClick={() => {
                setFilterOpen(false);
                setEditingAdvanced(true);
              }}
            >
              {advancedFilter ? 'Edit advanced filter' : 'Advanced filter'}
            </Button>
            {missingFilter && (
              <p className="text-xs text-muted-foreground">
                Some conditions are unavailable in your Spaces.
              </p>
            )}
            {filterCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setMembers([]);
                  setTags([]);
                  setMemberMatch('all');
                  setTagMatch('all');
                  setAdvancedFilter(undefined);
                }}
              >
                Clear filters
              </Button>
            )}
            {hiddenCount > 0 && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showHidden}
                  onChange={(event) => setShowHidden(event.target.checked)}
                />
                Include my hidden Spaces ({hiddenCount})
              </label>
            )}
            <div className="space-y-2 border-t pt-3">
              <Input
                aria-label="View name"
                placeholder="View name"
                className="h-8 text-sm"
                value={viewName}
                onChange={(event) => setViewName(event.target.value)}
              />
              <div className="flex flex-wrap gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!viewName.trim()}
                  onClick={() => {
                    const view = currentView();
                    setSavedViews([
                      ...savedViews.filter((item) => item.name !== view.name),
                      view,
                    ]);
                    setViewName(view.name);
                    toast.success('Space view saved.');
                  }}
                >
                  Save view
                </Button>
                {app.type === 'web' && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!viewName.trim()}
                    onClick={() => void copyViewLink()}
                  >
                    Copy view link
                  </Button>
                )}
                {savedViews.some((view) => view.name === viewName) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setSavedViews(
                        savedViews.filter((view) => view.name !== viewName)
                      )
                    }
                  >
                    Remove saved view
                  </Button>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      {editingAdvanced && (
        <SpaceAdvancedFilter
          filter={advancedFilter}
          memberOptions={memberOptions}
          tagOptions={tagOptions}
          onApply={(next) => {
            setAdvancedFilter(next);
            setEditingAdvanced(false);
            setFilterOpen(true);
          }}
          onClose={() => {
            setEditingAdvanced(false);
            setFilterOpen(true);
          }}
        />
      )}
      <div className="flex w-full min-w-0 flex-col gap-1">
        {visibleSpaces.map((space) => (
          <SpaceSidebarItem
            space={space}
            key={space.id}
            pinned={pinned.has(space.id)}
            onTogglePin={() => setPins(toggle(pins, space.id))}
            hidden={hiddenIds.has(space.id)}
            onToggleHidden={() => setHidden(toggle(hidden, space.id))}
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
