import { useLiveQuery } from '@tanstack/react-db';
import { createRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { collections } from '@colanode/ui/collections';
import { Button } from '@colanode/ui/components/ui/button';
import { rootRoute } from '@colanode/ui/routes/root';

const PageInvite = () => {
  const invitation = new URLSearchParams(window.location.hash.slice(1));
  const token = invitation.get('token');
  const server = invitation.get('server');
  const accounts = useLiveQuery((query) =>
    query.from({ account: collections.accounts })
  ).data;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const accept = async (accountId: string) => {
    if (!token || !server) return;
    setBusy(true);
    setError('');
    try {
      const result = await window.colanode.executeMutation({
        type: 'page.invitation.accept',
        accountId,
        token,
        server,
      });
      if (!result.success) throw new Error(result.error.message);
      const { workspaceId, pageId } = result.output;
      window.location.replace(`/${workspaceId}/shared/${pageId}`);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Could not accept the invitation.'
      );
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-md space-y-4 p-8 pt-16">
      <h1 className="text-2xl font-semibold">Page invitation</h1>
      {!token || !server ? (
        <p role="alert">This invitation link is incomplete.</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Use the account with the email address that was invited.
          </p>
          {accounts
            .filter((account) => account.server === server)
            .map((account) => (
              <Button
                key={account.id}
                variant="outline"
                className="w-full"
                disabled={busy}
                onClick={() => void accept(account.id)}
              >
                Accept as {account.email}
              </Button>
            ))}
          <a
            className="inline-block underline"
            href="/auth/login"
            target="_blank"
            rel="noreferrer"
          >
            Sign in or register in a new tab
          </a>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </>
      )}
    </main>
  );
};

export const pageInviteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/page-invite',
  component: PageInvite,
});
