import { eq, useLiveQuery } from '@tanstack/react-db';
import { createContext, useContext } from 'react';
import { toast } from 'sonner';

import { LocalSpaceNode } from '@colanode/client/types';
import { extractNodeRole, hasNodeRole } from '@colanode/core';
import { collections } from '@colanode/ui/collections';
import { useWorkspace } from '@colanode/ui/contexts/workspace';

export const useSpaceSidebarVisibility = (space: LocalSpaceNode) => {
  const workspace = useWorkspace();
  const namespace = `sidebar-hidden:${workspace.userId}:${space.id}`;
  const hiddenItems = useLiveQuery(
    (q) =>
      q
        .from({ metadata: collections.metadata })
        .where(({ metadata }) => eq(metadata.namespace, namespace)),
    [namespace]
  );
  const hiddenIds = new Set(hiddenItems.data?.map((item) => item.key));
  const archivedIds = new Set(
    Object.values(space.children ?? {})
      .filter((child) => child.archived)
      .map((child) => child.id)
  );
  const role = extractNodeRole(space, workspace.userId);
  const canArchive = !!role && hasNodeRole(role, 'admin');

  const setHidden = async (id: string, hidden: boolean) => {
    try {
      const result = await window.colanode.executeMutation(
        hidden
          ? { type: 'metadata.update', namespace, key: id, value: 'true' }
          : { type: 'metadata.delete', namespace, key: id }
      );
      if (!result.success) throw new Error(result.error.message);
      if (!result.output.success)
        throw new Error('Could not save sidebar visibility.');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not save sidebar visibility.'
      );
    }
  };

  const setArchived = async (id: string, archived: boolean) => {
    if (!canArchive) return;
    try {
      const result = await window.colanode.executeMutation({
        type: 'space.child.archive',
        userId: workspace.userId,
        spaceId: space.id,
        childId: id,
        archived,
      });
      if (!result.success) throw new Error(result.error.message);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not save the archive status.'
      );
    }
  };

  return {
    space,
    hiddenIds,
    archivedIds,
    canArchive,
    isVisible: (id: string) => !hiddenIds.has(id) && !archivedIds.has(id),
    setHidden,
    setArchived,
  };
};

export const SidebarVisibilityContext = createContext<ReturnType<
  typeof useSpaceSidebarVisibility
> | null>(null);

export const useSidebarVisibility = () => useContext(SidebarVisibilityContext);
