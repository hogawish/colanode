import { eq, inArray, useLiveQuery } from '@tanstack/react-db';
import { useState } from 'react';

import { LocalNode } from '@colanode/client/types';
import { Button } from '@colanode/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@colanode/ui/components/ui/dialog';
import { useSidebarVisibility } from '@colanode/ui/contexts/sidebar-visibility';
import { useWorkspace } from '@colanode/ui/contexts/workspace';

export const SpaceSidebarVisibilityDialog = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const workspace = useWorkspace();
  const visibility = useSidebarVisibility()!;
  const { space, hiddenIds, archivedIds, canArchive } = visibility;
  const [busy, setBusy] = useState(false);
  const ids = [...new Set([...hiddenIds, ...archivedIds])];
  const nodesQuery = useLiveQuery(
    (q) => {
      const nodes = q
        .from({ nodes: workspace.collections.nodes })
        .where(({ nodes }) => eq(nodes.rootId, space.id));
      return ids.length
        ? nodes.where(({ nodes }) => inArray(nodes.id, ids))
        : nodes.where(({ nodes }) => eq(nodes.id, ''));
    },
    [workspace.userId, space.id, JSON.stringify(ids)]
  );
  const nodes = nodesQuery.data ?? [];
  const sections = [
    {
      title: 'Hidden from my sidebar',
      empty: 'No hidden items.',
      action: 'Show',
      items: nodes.filter((node) => hiddenIds.has(node.id)),
      canRestore: true,
      restore: (id: string) => visibility.setHidden(id, false),
    },
    {
      title: 'Archived in this space',
      empty: 'No archived items.',
      action: 'Restore',
      items: nodes.filter((node) => archivedIds.has(node.id)),
      canRestore: canArchive,
      restore: (id: string) => visibility.setArchived(id, false),
    },
  ];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hidden and archived</DialogTitle>
          <DialogDescription>{space.name}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto">
          {sections.map((section) => (
            <section key={section.title}>
              <h3 className="text-sm font-medium">{section.title}</h3>
              {section.items.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {section.empty}
                </p>
              ) : (
                <ul className="divide-y">
                  {section.items.map((node: LocalNode) => {
                    const name = ('name' in node && node.name) || 'Unnamed';
                    return (
                      <li
                        key={node.id}
                        className="flex items-center justify-between gap-3 py-1"
                      >
                        <span className="min-w-0 truncate text-sm" title={name}>
                          {name}
                        </span>
                        {section.canRestore && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            aria-label={`${section.action} ${name}`}
                            onClick={async () => {
                              setBusy(true);
                              try {
                                await section.restore(node.id);
                              } finally {
                                setBusy(false);
                              }
                            }}
                          >
                            {section.action}
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
