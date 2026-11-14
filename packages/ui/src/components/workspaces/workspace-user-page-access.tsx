import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type { PageShareRole } from '@colanode/client/mutations';
import { Button } from '@colanode/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@colanode/ui/components/ui/dialog';
import { Link } from '@colanode/ui/components/ui/link';
import { useWorkspace } from '@colanode/ui/contexts/workspace';

type Props = {
  viewerId: string;
  name: string;
  onClose: () => void;
};

export const WorkspaceUserPageAccess = ({ viewerId, name, onClose }: Props) => {
  const { userId } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmRemoval, setConfirmRemoval] = useState<string | null>(null);
  const shares = useQuery({
    queryKey: ['managed-page-shares', userId, viewerId],
    gcTime: 0,
    retry: false,
    queryFn: async () => {
      const result = await window.colanode.executeMutation({
        type: 'page.share',
        action: 'list-user',
        userId,
        viewerId,
      });
      if (!result.success) throw new Error(result.error.message);
      if (result.output.action !== 'list-user') {
        throw new Error('Could not load page access.');
      }
      return result.output.pages;
    },
  });

  const update = async (pageId: string, role: PageShareRole | null) => {
    setBusy(true);
    setError('');
    try {
      const result = await window.colanode.executeMutation({
        type: 'page.share',
        action: 'set',
        userId,
        viewerId,
        pageId,
        enabled: role !== null,
        ...(role ? { role } : {}),
      });
      if (!result.success) throw new Error(result.error.message);
      setConfirmRemoval(null);
      await shares.refetch();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not update page access.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Page access for {name}</DialogTitle>
          <DialogDescription>
            Direct shares on pages you administer. These grants extend to
            descendant pages. Space access and other grants can still apply.
          </DialogDescription>
        </DialogHeader>
        {shares.isPending && <p role="status">Loading page access…</p>}
        {shares.isError && (
          <div className="flex items-center gap-2">
            <p role="alert" className="text-sm">
              Could not load page access.
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void shares.refetch()}
            >
              Try again
            </Button>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {shares.isSuccess &&
          (shares.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No direct page shares to manage.
            </p>
          ) : (
            <ul className="max-h-[55dvh] divide-y overflow-auto">
              {shares.data.map((page) => (
                <li key={page.id} className="space-y-1 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to="/workspace/$userId/$nodeId"
                      params={{ userId, nodeId: page.id }}
                      onClick={onClose}
                      className="min-w-24 flex-1 break-words text-sm underline-offset-2 hover:underline"
                    >
                      {page.location && (
                        <span className="block text-xs text-muted-foreground">
                          {[
                            page.location.spaceName ?? 'Private Space',
                            ...page.location.ancestorNames,
                          ].join(' › ')}
                        </span>
                      )}
                      <span>{page.name}</span>
                    </Link>
                    <select
                      aria-label={`Access to ${page.name}`}
                      className="h-8 rounded-md border bg-background px-2 text-sm"
                      disabled={busy}
                      value={page.role}
                      onChange={(event) =>
                        void update(
                          page.id,
                          event.target.value === 'editor' ? 'editor' : 'viewer'
                        )
                      }
                    >
                      <option value="viewer">Can view</option>
                      <option value="editor">Can edit</option>
                    </select>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setConfirmRemoval(page.id)}
                      aria-label={`Remove access to ${page.name}`}
                    >
                      Remove
                    </Button>
                  </div>
                  {confirmRemoval === page.id && (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => setConfirmRemoval(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busy}
                        onClick={() => void update(page.id, null)}
                      >
                        Remove direct access
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ))}
      </DialogContent>
    </Dialog>
  );
};
