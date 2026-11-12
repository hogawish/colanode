import { eq, useLiveQuery } from '@tanstack/react-db';

import { LocalSpaceNode } from '@colanode/client/types';
import { SidebarHeader } from '@colanode/ui/components/layouts/sidebars/sidebar-header';
import { SidebarSharedPages } from '@colanode/ui/components/layouts/sidebars/sidebar-shared-pages';
import { SpaceCreateButton } from '@colanode/ui/components/spaces/space-create-button';
import { SpaceSidebarItem } from '@colanode/ui/components/spaces/space-sidebar-item';
import { useApp } from '@colanode/ui/contexts/app';
import { useWorkspace } from '@colanode/ui/contexts/workspace';

export const SidebarSpaces = () => {
  const workspace = useWorkspace();
  const app = useApp();
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

  const spaces = spaceListQuery.data.map((node) => node as LocalSpaceNode);

  return (
    <div className="flex flex-col group/sidebar h-full px-2">
      <SidebarHeader
        title="Spaces"
        actions={canCreateSpace && <SpaceCreateButton />}
      />
      <div className="flex w-full min-w-0 flex-col gap-1">
        {spaces.map((space) => (
          <SpaceSidebarItem space={space} key={space.id} />
        ))}
      </div>
      {app.type === 'web' && <SidebarSharedPages />}
    </div>
  );
};
