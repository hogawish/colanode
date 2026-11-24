import { useState } from 'react';

import { Button } from '@colanode/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@colanode/ui/components/ui/dialog';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import {
  importNotionPlan,
  previewNotionZip,
  type NotionImportPlan,
} from '@colanode/ui/lib/notion-import';

export const NotionImportDialog = ({
  parentId,
  onClose,
}: {
  parentId: string;
  onClose: () => void;
}) => {
  const { userId, workspaceId } = useWorkspace();
  const [plan, setPlan] = useState<NotionImportPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const [root, setRoot] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className="max-h-[90vh] overflow-y-auto"
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Import from Notion</DialogTitle>
          <DialogDescription>
            Export from Notion as HTML or Markdown &amp; CSV, including
            subpages, then select the ZIP. A new “Notion import” page will be
            created here; existing pages are not replaced.
          </DialogDescription>
        </DialogHeader>
        <input
          aria-label="Notion export ZIP"
          type="file"
          accept=".zip,application/zip"
          disabled={busy || !!root}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            setPlan(null);
            setError(null);
            if (!file) return;
            setBusy(true);
            try {
              if (file.size > 256 * 1024 * 1024)
                throw new Error('ZIP must be smaller than 256 MB.');
              setPlan(
                previewNotionZip(new Uint8Array(await file.arrayBuffer()))
              );
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : 'Could not inspect ZIP.'
              );
            } finally {
              setBusy(false);
            }
          }}
        />
        {plan && (
          <div className="space-y-2 text-sm">
            <p>
              {plan.items.filter((item) => item.kind === 'page').length} pages ·{' '}
              {plan.items.filter((item) => item.kind === 'database').length}{' '}
              databases ·{' '}
              {plan.items.filter((item) => item.kind === 'record').length} rows
              · {plan.images.length} images
              {plan.attachments.some((file) => file.subtype !== 'image') && (
                <>
                  {' '}
                  ·{' '}
                  {
                    plan.attachments.filter((file) => file.subtype !== 'image')
                      .length
                  }{' '}
                  attachments
                </>
              )}
            </p>
            {plan.attachments.length > 0 && (
              <details>
                <summary className="cursor-pointer">
                  Included files ({plan.attachments.length})
                </summary>
                <ul className="max-h-40 overflow-auto list-disc pl-5">
                  {plan.attachments.map((file) => (
                    <li key={file.path}>
                      {file.name} · {file.subtype} ·{' '}
                      {(
                        (plan.files[file.path]?.length ?? 0) /
                        1024 /
                        1024
                      ).toFixed(2)}{' '}
                      MB
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <ul className="max-h-40 overflow-auto list-disc pl-5">
              {plan.items.slice(0, 50).map((item) => (
                <li key={item.path}>
                  {item.name} ({item.kind})
                </li>
              ))}
            </ul>
            {plan.warnings.map((warning) => (
              <p key={warning} className="text-muted-foreground">
                {warning}
              </p>
            ))}
            {!root && (
              <Button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    await importNotionPlan(plan, {
                      userId,
                      workspaceId,
                      parentId,
                      onRoot: setRoot,
                      onProgress: (done, total) =>
                        setProgress(`${done} / ${total}`),
                    });
                    setComplete(true);
                  } catch (cause) {
                    setError(
                      cause instanceof Error ? cause.message : 'Import failed.'
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Import as new pages
              </Button>
            )}
          </div>
        )}
        {busy && (
          <p role="status">
            {root ? `Importing… ${progress}` : 'Inspecting ZIP…'}
          </p>
        )}
        {error && (
          <p role="alert">
            {error}
            {root
              ? ' The partially imported page is retained. Check it before importing again.'
              : ''}
          </p>
        )}
        {root && !busy && (
          <p>
            <a className="underline" href={`/${workspaceId}/${root}`}>
              {complete
                ? 'Open imported pages'
                : 'Open partially imported pages'}
            </a>
            {complete && ' · Saved locally; syncing to server.'}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};
