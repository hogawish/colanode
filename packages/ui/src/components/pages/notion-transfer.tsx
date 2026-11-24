import { useState } from 'react';

import { Button } from '@colanode/ui/components/ui/button';
import { Input } from '@colanode/ui/components/ui/input';
import { useWorkspace } from '@colanode/ui/contexts/workspace';

export const NotionTransfer = ({
  nodeId,
  disabled,
  onBusy,
}: {
  nodeId: string;
  disabled: boolean;
  onBusy: (busy: boolean) => void;
}) => {
  const { userId } = useWorkspace();
  const [token, setToken] = useState('');
  const [parent, setParent] = useState('');
  const [result, setResult] = useState<{
    url: string | null;
    complete: boolean;
    pages: number;
    warnings: string[];
    error?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <details className="space-y-3 border-t pt-3 text-sm">
      <summary className="cursor-pointer">
        Copy directly to Notion (native inline databases)
      </summary>
      <p className="text-muted-foreground">
        Creates a new copy, including readable subpages, databases and body
        attachments (images, videos, audio, PDFs and files). Add your Notion
        connection to the destination page first, with read, insert and update
        access. ZIP import does not preserve native inline views.
      </p>
      <label className="block space-y-1">
        Destination Notion page
        <Input
          value={parent}
          disabled={disabled}
          onChange={(event) => setParent(event.target.value)}
          placeholder="Notion page URL or ID"
        />
      </label>
      <label className="block space-y-1">
        Notion connection token
        <Input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={token}
          disabled={disabled}
          onChange={(event) => setToken(event.target.value)}
        />
      </label>
      <p className="text-muted-foreground">
        The token is used for this transfer only and is not saved. Properties
        are copied as text; views, relations, permissions and history are not
        copied. Files up to 256 MB each; files over 20 MB use multipart upload.
        Notion workspace limits also apply.
      </p>
      <Button
        variant="outline"
        disabled={disabled || !token.trim() || !parent.trim() || !!result?.url}
        onClick={async () => {
          onBusy(true);
          setResult(null);
          setError(null);
          try {
            const response = await window.colanode.executeMutation({
              type: 'page.share',
              action: 'transfer-notion',
              pageId: nodeId,
              userId,
              token: token.trim(),
              parent: parent.trim(),
            });
            if (!response.success) throw new Error(response.error.message);
            if (response.output.action !== 'transfer-notion')
              throw new Error('The server did not return a transfer result.');
            setResult(response.output.result);
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : 'Transfer failed. Check Notion before retrying.'
            );
          } finally {
            setToken('');
            onBusy(false);
          }
        }}
      >
        Create a new copy in Notion
      </Button>
      {result && (
        <div className="space-y-1">
          <p role="status">
            {result.complete ? 'Transfer complete' : 'Transfer stopped'} ·{' '}
            {result.pages} pages / databases created
          </p>
          {result.url && (
            <a
              className="underline"
              href={result.url}
              target="_blank"
              rel="noreferrer"
            >
              Open {result.complete ? 'copied' : 'partially copied'} page in
              Notion
            </a>
          )}
          {result.error && <p role="alert">{result.error}</p>}
          {result.warnings.map((warning) => (
            <p key={warning} className="text-muted-foreground">
              {warning}
            </p>
          ))}
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </details>
  );
};
