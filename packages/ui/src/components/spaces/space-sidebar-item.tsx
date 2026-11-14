import { eq, useLiveQuery } from '@tanstack/react-db';
import { ChevronRight, Pin } from 'lucide-react';

import { LocalSpaceNode } from '@colanode/client/types';
import { Avatar } from '@colanode/ui/components/avatars/avatar';
import { SidebarItem } from '@colanode/ui/components/layouts/sidebars/sidebar-item';
import { SpacePageReferenceLinks } from '@colanode/ui/components/spaces/space-page-references';
import { SpaceSidebarDropdown } from '@colanode/ui/components/spaces/space-sidebar-dropdown';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@colanode/ui/components/ui/collapsible';
import { useApp } from '@colanode/ui/contexts/app';
import {
  SidebarVisibilityContext,
  useSpaceSidebarVisibility,
} from '@colanode/ui/contexts/sidebar-visibility';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { sortSpaceChildren } from '@colanode/ui/lib/spaces';

interface SpaceSidebarItemProps {
  space: LocalSpaceNode;
  pinned?: boolean;
  onTogglePin?: () => void;
  onOpenReference?: () => void;
}

export const SpaceSidebarItem = ({
  space,
  pinned,
  onTogglePin,
  onOpenReference,
}: SpaceSidebarItemProps) => {
  const workspace = useWorkspace();
  const app = useApp();
  const visibility = useSpaceSidebarVisibility(space);

  const nodeChildrenGetQuery = useLiveQuery(
    (q) =>
      q
        .from({ nodes: workspace.collections.nodes })
        .where(({ nodes }) => eq(nodes.parentId, space.id)),
    [workspace.userId, space.id]
  );

  const children = sortSpaceChildren(space, nodeChildrenGetQuery.data).filter(
    (child) => visibility.isVisible(child.id)
  );

  return (
    <SidebarVisibilityContext.Provider value={visibility}>
      <Collapsible
        key={space.id}
        defaultOpen={true}
        className="group/sidebar-space"
      >
        <div className="group/space-row text-sm flex h-7 items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground cursor-pointer">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 overflow-hidden rounded-md text-left text-sm flex-1 cursor-pointer">
              <Avatar
                id={space.id}
                avatar={space.avatar}
                name={space.name}
                className="size-4 group-hover/space-row:hidden shrink-0"
              />
              <ChevronRight className="hidden size-4 transition-transform duration-200 group-hover/space-row:block group-data-[state=open]/sidebar-space:rotate-90 cursor-pointer rounded hover:bg-sidebar-accent/50" />
              <span className="truncate">{space.name}</span>
              {pinned && (
                <Pin aria-label="Pinned" className="size-3 shrink-0" />
              )}
            </button>
          </CollapsibleTrigger>
          <SpaceSidebarDropdown
            space={space}
            pinned={pinned}
            onTogglePin={onTogglePin}
          />
        </div>
        <CollapsibleContent>
          <ul className="ml-3 flex min-w-0 flex-col gap-0.5 py-0.5">
            {children.map((child) => (
              <li key={child.id}>
                <SidebarItem node={child} />
              </li>
            ))}
            {app.type === 'web' && (
              <SpacePageReferenceLinks space={space} onOpen={onOpenReference} />
            )}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </SidebarVisibilityContext.Provider>
  );
};
