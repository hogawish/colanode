import { Copy, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import type { PageShareViewer } from '@colanode/client/mutations';
import type { User } from '@colanode/client/types';
import { NodeCollaboratorSearch } from '@colanode/ui/components/collaborators/node-collaborator-search';
import { Button } from '@colanode/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@colanode/ui/components/ui/dialog';
import { useWorkspace } from '@colanode/ui/contexts/workspace';

interface PageShareDialogProps {
  pageId: string;
  onClose: () => void;
}

export const PageShareDialog = ({ pageId, onClose }: PageShareDialogProps) => {
  const { userId, workspaceId } = useWorkspace();
  const [viewers, setViewers] = useState<PageShareViewer[]>([]);
  const [selected, setSelected] = useState<User[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  const refresh = async () => {
    const result = await window.colanode.executeMutation({
      type: 'page.share',
      action: 'list',
      userId,
      pageId,
    });
    if (!result.success) throw new Error(result.error.message);
    if (result.output.action === 'list') setViewers(result.output.viewers);
  };

  useEffect(() => {
    void refresh()
      .catch(() => setError('Could not load page sharing.'))
      .finally(() => setBusy(false));
  }, [pageId, userId]);

  const update = async (viewerIds: string[], enabled: boolean) => {
    setBusy(true);
    setError('');
    try {
      for (const viewerId of viewerIds) {
        const result = await window.colanode.executeMutation({
          type: 'page.share',
          action: 'set',
          userId,
          pageId,
          viewerId,
          enabled,
        });
        if (!result.success) throw new Error(result.error.message);
      }
      setSelected([]);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Could not update page sharing.'
      );
    } finally {
      await refresh().catch(() => setError('Could not reload page sharing.'));
      setBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(
        new URL(`/${workspaceId}/shared/${pageId}`, window.location.origin).href
      );
      toast.success('Page link copied');
    } catch {
      toast.error('Could not copy the page link.');
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share page</DialogTitle>
          <DialogDescription>
            Give workspace members read access to this page, its attachments,
            and its child pages.
          </DialogDescription>
        </DialogHeader>
        <NodeCollaboratorSearch
          value={selected}
          excluded={[
            userId,
            ...viewers.map((viewer) => viewer.id),
            ...selected.map((viewer) => viewer.id),
          ]}
          onChange={setSelected}
        />
        <div className="flex justify-between gap-2">
          <Button variant="outline" onClick={() => void copyLink()}>
            <Copy className="size-4" /> Copy link
          </Button>
          <Button
            disabled={busy || !selected.length}
            onClick={() =>
              void update(
                selected.map((viewer) => viewer.id),
                true
              )
            }
          >
            Grant view access
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {viewers.length > 0 && (
          <ul className="max-h-56 overflow-y-auto border-t pt-2">
            {viewers.map((viewer) => (
              <li
                key={viewer.id}
                className="flex items-center justify-between gap-3 py-1"
              >
                <span className="truncate text-sm">
                  {viewer.name}{' '}
                  <span className="text-muted-foreground">{viewer.email}</span>
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={busy}
                  aria-label={`Remove access for ${viewer.name}`}
                  onClick={() => void update([viewer.id], false)}
                >
                  <X className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
};
