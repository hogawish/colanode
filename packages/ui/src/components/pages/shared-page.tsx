import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import { buildEditorContent } from '@colanode/client/lib';
import type { SharedPage } from '@colanode/client/mutations';
import { FileSaveButton } from '@colanode/ui/components/files/file-save-button';
import { Button } from '@colanode/ui/components/ui/button';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { DocumentRenderer } from '@colanode/ui/editor/renderers/document';

export const SharedPageView = ({ pageId }: { pageId: string }) => {
  const { userId, workspaceId } = useWorkspace();
  const [page, setPage] = useState<SharedPage | null>(null);
  const [busy, setBusy] = useState(true);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let current = true;
    setPage(null);
    setBusy(true);
    const readPage = async () => {
      try {
        const result = await window.colanode.executeMutation({
          type: 'page.share',
          action: 'read',
          userId,
          pageId,
        });
        if (current && result.success && result.output.action === 'read') {
          setPage(result.output.page);
        }
      } finally {
        if (current) setBusy(false);
      }
    };
    void readPage().catch(() => {});
    return () => {
      current = false;
    };
  }, [userId, pageId, refresh]);

  if (busy) return <p className="m-6 text-sm">Loading shared page…</p>;
  if (!page)
    return (
      <p role="alert" className="m-6 text-sm">
        This page is unavailable.
      </p>
    );

  return (
    <article className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-sm text-muted-foreground">
            Shared page · View only
          </p>
          <h1 className="text-3xl font-semibold">{page.name}</h1>
        </div>
        <Button
          variant="ghost"
          onClick={() => setRefresh((value) => value + 1)}
        >
          Reload
        </Button>
      </header>
      <div className="space-y-2">
        <DocumentRenderer
          node={buildEditorContent(pageId, page.content)}
          keyPrefix={pageId}
        />
      </div>
      {page.pages.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Child pages</h2>
          <ul className="space-y-2">
            {page.pages.map((child) => (
              <li key={child.id}>
                <Link
                  className="underline"
                  to="/workspace/$userId/shared/$pageId"
                  params={{ userId, pageId: child.id }}
                  mask={{
                    to: '/$workspaceId/shared/$pageId',
                    params: { workspaceId, pageId: child.id },
                  }}
                >
                  {child.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {page.files.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Attachments</h2>
          <ul className="space-y-2">
            {page.files.map((file) => (
              <li
                key={file.id}
                className="flex items-center justify-between gap-3"
              >
                <span>{file.name}</span>
                <FileSaveButton file={file} remoteOnly />
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
};
