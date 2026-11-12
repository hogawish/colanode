import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import type { SharedPage } from '@colanode/client/mutations';
import type { RichTextContent } from '@colanode/core';
import { FileSaveButton } from '@colanode/ui/components/files/file-save-button';
import { SharedPageDocument } from '@colanode/ui/components/pages/shared-page-document';
import { SharedPageEditor } from '@colanode/ui/components/pages/shared-page-editor';
import { Button } from '@colanode/ui/components/ui/button';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { useFollowBlockLink } from '@colanode/ui/hooks/use-follow-block-link';

export const SharedPageView = ({ pageId }: { pageId: string }) => {
  const followBlockLink = useFollowBlockLink();
  return (
    <div
      className="h-full overflow-y-auto overscroll-contain"
      onClickCapture={followBlockLink}
    >
      <SharedPageContent pageId={pageId} />
    </div>
  );
};

const SharedPageContent = ({ pageId }: { pageId: string }) => {
  const { userId, workspaceId } = useWorkspace();
  const [page, setPage] = useState<SharedPage | null>(null);
  const [busy, setBusy] = useState(true);
  const [editing, setEditing] = useState(false);
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
      <div className="m-6 flex items-center gap-2 text-sm">
        <p role="alert">This page is unavailable.</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setRefresh((value) => value + 1)}
        >
          Try again
        </Button>
      </div>
    );

  const save = async (content: RichTextContent) => {
    const result = await window.colanode.executeMutation({
      type: 'page.share',
      action: 'edit',
      userId,
      pageId,
      content,
      revision: page.revision,
    });
    if (!result.success) throw new Error(result.error.message);
    setEditing(false);
    setRefresh((value) => value + 1);
  };

  return (
    <article className="mx-auto w-full min-w-0 max-w-3xl space-y-6 px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-sm text-muted-foreground">
            {page.canEdit
              ? 'Shared page · Can edit'
              : 'Shared page · View only'}
          </p>
          <h1 className="text-3xl font-semibold">{page.name}</h1>
        </div>
        {!editing && (
          <div className="flex gap-2">
            {page.canEdit && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                Edit page
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => setRefresh((value) => value + 1)}
            >
              Reload
            </Button>
          </div>
        )}
      </header>
      {editing ? (
        <SharedPageEditor
          pageId={pageId}
          content={page.content}
          onSave={save}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <SharedPageDocument pageId={pageId} content={page.content} />
      )}
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
