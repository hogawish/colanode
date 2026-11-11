// Modified: discoverable page actions and persistent sibling ordering in the sidebar.
import { eq, useLiveQuery } from '@tanstack/react-db';
import { ArrowDown, ArrowUp, GripVertical, Pencil, Trash2 } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';

import type { LocalNode, LocalSpaceNode } from '@colanode/client/types';
import { extractNodeRole, hasNodeRole } from '@colanode/core';
import { NodeDeleteDialog } from '@colanode/ui/components/nodes/node-delete-dialog';
import { PageUpdateDialog } from '@colanode/ui/components/pages/page-update-dialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@colanode/ui/components/ui/context-menu';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { sortSpaceChildren } from '@colanode/ui/lib/spaces';

const DRAG_TYPE = 'application/x-colanode-sidebar-node';

export const SidebarNodeActions = ({
  node,
  children,
}: {
  node: LocalNode;
  children: ReactNode;
}) => {
  const workspace = useWorkspace();
  const name = 'name' in node ? node.name : 'item';
  const [over, setOver] = useState<'before' | 'after' | null>(null);
  const [rename, setRename] = useState(false);
  const [remove, setRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const spaceQuery = useLiveQuery(
    (q) =>
      q
        .from({ nodes: workspace.collections.nodes })
        .where(({ nodes }) => eq(nodes.id, node.rootId))
        .findOne(),
    [workspace.userId, node.rootId]
  );
  const siblingsQuery = useLiveQuery(
    (q) =>
      q
        .from({ nodes: workspace.collections.nodes })
        .where(({ nodes }) => eq(nodes.parentId, node.parentId)),
    [workspace.userId, node.parentId]
  );
  const space =
    spaceQuery.data?.type === 'space'
      ? (spaceQuery.data as LocalSpaceNode)
      : null;
  const role = space ? extractNodeRole(space, workspace.userId) : null;
  const canReorder = !!role && hasNodeRole(role, 'admin');
  const canEdit = !!role && hasNodeRole(role, 'editor');
  const canDelete = !!role && hasNodeRole(role, 'admin');
  const siblings = space
    ? sortSpaceChildren(space, siblingsQuery.data ?? [])
    : [];
  const index = siblings.findIndex((sibling) => sibling.id === node.id);

  const reorder = async (childId: string, after: string | null) => {
    if (!canReorder || !space || busy || childId === after) return;
    setBusy(true);
    try {
      const result = await window.colanode.executeMutation({
        type: 'space.child.reorder',
        userId: workspace.userId,
        spaceId: space.id,
        parentId: node.parentId ?? undefined,
        childId,
        after,
      });
      if (!result.success) throw new Error(result.error.message);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not reorder this item.'
      );
    } finally {
      setBusy(false);
      setOver(null);
    }
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className="group/sidebar-node relative min-w-0"
            onDragOver={(event) => {
              if (!canReorder || !event.dataTransfer.types.includes(DRAG_TYPE))
                return;
              event.preventDefault();
              event.stopPropagation();
              const rect = event.currentTarget.getBoundingClientRect();
              setOver(event.clientY < rect.top + 14 ? 'before' : 'after');
              event.dataTransfer.dropEffect = 'move';
            }}
            onDragLeave={(event) => {
              if (
                !event.currentTarget.contains(
                  event.relatedTarget as Node | null
                )
              )
                setOver(null);
            }}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setOver(null);
              try {
                const drag = JSON.parse(event.dataTransfer.getData(DRAG_TYPE));
                if (
                  drag.workspaceId !== workspace.workspaceId ||
                  drag.parentId !== node.parentId ||
                  drag.nodeId === node.id ||
                  !siblings.some((item) => item.id === drag.nodeId)
                )
                  return;
                const remaining = siblings.filter(
                  (item) => item.id !== drag.nodeId
                );
                const target = remaining.findIndex(
                  (item) => item.id === node.id
                );
                const rect = event.currentTarget.getBoundingClientRect();
                const after =
                  event.clientY < rect.top + 14
                    ? (remaining[target - 1]?.id ?? null)
                    : node.id;
                void reorder(drag.nodeId, after);
              } catch {
                /* External drag data is not a sidebar move. */
              }
            }}
          >
            {over && (
              <div
                className={`pointer-events-none absolute inset-x-0 z-10 border-t-2 border-primary ${over === 'before' ? 'top-0' : 'top-7'}`}
              />
            )}
            {children}
            {canReorder && (
              <button
                type="button"
                title="Drag to reorder within this parent; right-click for actions"
                aria-label={`Reorder ${name || 'item'}`}
                className="absolute right-1 top-0.5 rounded bg-sidebar p-1 opacity-0 group-hover/sidebar-node:opacity-100 focus:opacity-100"
                draggable={!busy}
                onDragStart={(event) => {
                  event.stopPropagation();
                  event.dataTransfer.setData(
                    DRAG_TYPE,
                    JSON.stringify({
                      workspaceId: workspace.workspaceId,
                      parentId: node.parentId,
                      nodeId: node.id,
                    })
                  );
                  event.dataTransfer.effectAllowed = 'move';
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              >
                <GripVertical className="size-4" />
              </button>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            disabled={!canReorder || busy || index <= 0}
            onSelect={() =>
              void reorder(node.id, siblings[index - 2]?.id ?? null)
            }
          >
            <ArrowUp className="size-4" />
            Move up
          </ContextMenuItem>
          <ContextMenuItem
            disabled={
              !canReorder || busy || index < 0 || index >= siblings.length - 1
            }
            onSelect={() => void reorder(node.id, siblings[index + 1]!.id)}
          >
            <ArrowDown className="size-4" />
            Move down
          </ContextMenuItem>
          {node.type === 'page' && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                disabled={!canEdit}
                onSelect={() => setRename(true)}
              >
                <Pencil className="size-4" />
                Rename page
              </ContextMenuItem>
              <ContextMenuItem
                disabled={!canDelete}
                onSelect={() => setRemove(true)}
              >
                <Trash2 className="size-4" />
                Delete page
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
      {node.type === 'page' && role && (
        <PageUpdateDialog
          page={node}
          role={role}
          open={rename}
          onOpenChange={setRename}
        />
      )}
      <NodeDeleteDialog
        id={node.id}
        title={`Delete ${name || 'this item'}?`}
        description="This item and its contents will no longer be accessible."
        open={remove}
        onOpenChange={setRemove}
      />
    </>
  );
};
