import { Copy, X } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';

import type {
  PageShareInvitation,
  PageShareMutationInput,
  PageShareRole,
  PageShareViewer,
} from '@colanode/client/mutations';
import { collections } from '@colanode/ui/collections';
import { Button } from '@colanode/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@colanode/ui/components/ui/dialog';
import { Input } from '@colanode/ui/components/ui/input';
import { useWorkspace } from '@colanode/ui/contexts/workspace';

interface PageShareDialogProps {
  pageId: string;
  onClose: () => void;
}

const roleLabel: Record<PageShareRole, string> = {
  viewer: 'Can view',
  editor: 'Can edit',
};

export const PageShareDialog = ({ pageId, onClose }: PageShareDialogProps) => {
  const { userId, workspaceId, accountId } = useWorkspace();
  const [viewers, setViewers] = useState<PageShareViewer[]>([]);
  const [invitations, setInvitations] = useState<PageShareInvitation[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<PageShareRole>('viewer');
  const [inviteLink, setInviteLink] = useState('');
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
    if (result.output.action === 'list') {
      setViewers(result.output.viewers);
      setInvitations(result.output.invitations ?? []);
    }
  };

  useEffect(() => {
    void refresh()
      .catch(() => setError('Could not load page sharing.'))
      .finally(() => setBusy(false));
  }, [pageId, userId]);

  const submit = async (input: PageShareMutationInput) => {
    setBusy(true);
    setError('');
    setInviteLink('');
    try {
      const result = await window.colanode.executeMutation(input);
      if (!result.success) throw new Error(result.error.message);
      if (result.output.action === 'invite') {
        if (result.output.token) {
          const url = new URL('/page-invite', window.location.origin);
          const server = collections.accounts.get(accountId)?.server;
          if (!server)
            throw new Error('Could not identify the invitation server.');
          url.hash = new URLSearchParams({
            token: result.output.token,
            server,
          }).toString();
          setInviteLink(url.href);
        } else {
          toast.success('Page access updated');
        }
        setEmail('');
      }
      await refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Could not update page sharing.'
      );
    } finally {
      setBusy(false);
    }
  };

  const invite = (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || busy) return;
    void submit({
      type: 'page.share',
      action: 'invite',
      userId,
      pageId,
      email: email.trim(),
      role,
    });
  };

  const copy = async (link: string, label: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success(label);
    } catch {
      toast.error('Could not copy the link.');
    }
  };

  const sharedLink = new URL(
    `/${workspaceId}/shared/${pageId}`,
    window.location.origin
  ).href;

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
            Invite by email. Access includes descendants and their attachments,
            including items added later. Changes apply on the next request.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-wrap gap-2" onSubmit={invite}>
          <Input
            type="email"
            aria-label="Invitee email"
            placeholder="Email address"
            required
            value={email}
            disabled={busy}
            maxLength={256}
            onChange={(event) => setEmail(event.target.value)}
            className="min-w-40 flex-1"
          />
          <select
            aria-label="Page access"
            className="rounded-md border bg-background px-2 text-sm"
            value={role}
            disabled={busy}
            onChange={(event) => setRole(event.target.value as PageShareRole)}
          >
            <option value="viewer">Can view</option>
            <option value="editor">Can edit</option>
          </select>
          <Button type="submit" disabled={busy || !email.trim()}>
            Invite
          </Button>
        </form>
        {inviteLink && (
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-sm">
              Send this invitation link to the person you invited. It expires in
              7 days.
            </p>
            <Input
              readOnly
              aria-label="Invitation link"
              value={inviteLink}
              onFocus={(event) => event.target.select()}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => void copy(inviteLink, 'Invitation link copied')}
            >
              <Copy className="size-4" /> Copy invitation link
            </Button>
          </div>
        )}
        <Button
          variant="outline"
          className="justify-self-start"
          onClick={() => void copy(sharedLink, 'Page link copied')}
        >
          <Copy className="size-4" /> Copy link
        </Button>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {viewers.length + invitations.length > 0 && (
          <ul className="max-h-56 overflow-y-auto border-t pt-2">
            {viewers.map((viewer) => (
              <li
                key={viewer.id}
                className="flex items-center justify-between gap-3 py-1 text-sm"
              >
                <span className="truncate">
                  {viewer.name}{' '}
                  <span className="text-muted-foreground">{viewer.email}</span>
                </span>
                <span className="ml-auto shrink-0">
                  {roleLabel[viewer.role]}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={busy}
                  aria-label={`Remove access for ${viewer.name}`}
                  onClick={() =>
                    void submit({
                      type: 'page.share',
                      action: 'set',
                      userId,
                      pageId,
                      viewerId: viewer.id,
                      enabled: false,
                    })
                  }
                >
                  <X className="size-4" />
                </Button>
              </li>
            ))}
            {invitations.map((invitation) => (
              <li
                key={invitation.email}
                className="flex items-center justify-between gap-3 py-1 text-sm"
              >
                <span className="truncate">{invitation.email}</span>
                <span className="ml-auto shrink-0 text-muted-foreground">
                  {roleLabel[invitation.role]} · Pending
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={busy}
                  aria-label={`Cancel invitation for ${invitation.email}`}
                  onClick={() =>
                    void submit({
                      type: 'page.share',
                      action: 'cancel-invitation',
                      userId,
                      pageId,
                      email: invitation.email,
                    })
                  }
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
