import { useEffect, useRef, useState } from 'react';

import type { SharedPage } from '@colanode/client/mutations';
import type { RichTextContent } from '@colanode/core';
import {
  PageExport,
  PageExportProvider,
  PageExportSettings,
} from '@colanode/ui/components/pages/page-export';
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
  const { userId } = useWorkspace();
  const [page, setPage] = useState<SharedPage | null>(null);
  const [busy, setBusy] = useState(true);
  const revision = useRef<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);
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
          revision.current = result.output.page.revision;
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
      revision: revision.current,
    });
    if (!result.success) throw new Error(result.error.message);
    if (
      result.output.action !== 'edit' ||
      result.output.revision === undefined
    ) {
      throw new Error('The server did not confirm the saved revision.');
    }
    revision.current = result.output.revision;
  };

  return (
    <PageExportProvider key={pageId}>
      <article
        className={`mx-auto w-full min-w-0 space-y-6 px-6 py-10 ${page.linkedDatabasePlacements?.length || page.databasePlacements?.some(({ inline }) => inline) ? '' : 'max-w-3xl'}`}
      >
        <PageExport title={page.name}>
          <header
            className="flex items-start justify-between gap-4"
            data-export-exclude
          >
            <div className="min-w-0">
              {page.location && (
                <p className="mb-1 break-words text-sm text-muted-foreground">
                  {[
                    page.location.spaceName ?? 'Private Space',
                    ...page.location.ancestorNames,
                  ].join(' › ')}
                </p>
              )}
              <p className="mb-1 text-sm text-muted-foreground">
                {page.canEdit
                  ? 'Shared page · Can edit'
                  : 'Shared page · View only'}
              </p>
              <h1 className="text-3xl font-semibold">{page.name}</h1>
            </div>
            <div className="flex items-center gap-2">
              <PageExportSettings />
              {!page.canEdit && (
                <Button
                  variant="ghost"
                  onClick={() => setRefresh((value) => value + 1)}
                >
                  Reload
                </Button>
              )}
            </div>
          </header>
          <SharedPageDocument
            pageId={pageId}
            content={page.content}
            pages={page.pages}
            pagePlacements={page.pagePlacements}
            databases={page.databases}
            databasePlacements={page.databasePlacements}
            linkedDatabasePlacements={page.linkedDatabasePlacements}
            files={page.files}
            filePlacements={page.filePlacements}
            renderEditor={
              page.canEdit && !unsupported
                ? (content) => (
                    <SharedPageEditor
                      pageId={pageId}
                      content={content}
                      onSave={save}
                      onUnsupported={() => setUnsupported(true)}
                    />
                  )
                : undefined
            }
          />
          {unsupported && (
            <p role="alert" className="text-sm text-muted-foreground">
              Some blocks on this page cannot be edited in the shared view.
            </p>
          )}
        </PageExport>
      </article>
    </PageExportProvider>
  );
};
