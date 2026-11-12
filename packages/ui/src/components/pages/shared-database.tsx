import {
  BasicIndex,
  createCollection,
  localOnlyCollectionOptions,
} from '@tanstack/react-db';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import type { SharedDatabase, SharedPage } from '@colanode/client/mutations';
import type { LocalNode } from '@colanode/client/types';
import { Database } from '@colanode/ui/components/databases/database';
import { DatabaseViews } from '@colanode/ui/components/databases/database-views';
import { PageLinkContent } from '@colanode/ui/components/pages/page-link-content';
import { Button } from '@colanode/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@colanode/ui/components/ui/dialog';
import {
  useWorkspace,
  WorkspaceContext,
} from '@colanode/ui/contexts/workspace';

type ChildDatabase = NonNullable<SharedPage['databases']>[number];

export const SharedDatabasesContext = createContext<{
  pageId: string;
  databases: ReadonlyMap<string, ChildDatabase>;
} | null>(null);

export const SharedDatabaseBlock = ({
  id,
  inline,
}: {
  id?: string;
  inline?: boolean;
}) => {
  const shared = useContext(SharedDatabasesContext);
  const database = id ? shared?.databases.get(id) : undefined;
  if (!shared || !database) return null;

  return (
    <div
      data-document-block={database.id}
      className={inline ? 'my-4 w-full' : undefined}
    >
      {inline ? (
        <SharedDatabaseView pageId={shared.pageId} databaseId={database.id} />
      ) : (
        <SharedDatabaseDialog pageId={shared.pageId} database={database} />
      )}
    </div>
  );
};

export const SharedDatabaseDialog = ({
  pageId,
  database,
}: {
  pageId: string;
  database: ChildDatabase;
}) => (
  <Dialog>
    <DialogTrigger asChild>
      <button type="button" className="block w-full text-left">
        <PageLinkContent {...database} />
      </button>
    </DialogTrigger>
    <DialogContent className="max-h-[85dvh] w-[95vw] max-w-none overflow-auto sm:max-w-6xl">
      <DialogTitle>{database.name}</DialogTitle>
      <SharedDatabaseView pageId={pageId} databaseId={database.id} />
    </DialogContent>
  </Dialog>
);

const SharedDatabaseView = ({
  pageId,
  databaseId,
}: {
  pageId: string;
  databaseId: string;
}) => {
  const { userId } = useWorkspace();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<SharedDatabase | null | undefined>(
    undefined
  );

  useEffect(() => {
    let active = true;
    setResult(undefined);
    void window.colanode
      .executeMutation({
        type: 'page.share',
        action: 'read-database',
        userId,
        pageId,
        databaseId,
      })
      .then((response) => {
        if (!active) return;
        setResult(
          response.success && response.output.action === 'read-database'
            ? response.output.database
            : null
        );
      })
      .catch(() => {
        if (active) setResult(null);
      });
    return () => {
      active = false;
    };
  }, [userId, pageId, databaseId, attempt]);

  if (result === undefined) return <p className="text-sm">Loading database…</p>;
  if (!result) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <p role="alert">This database is unavailable.</p>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setAttempt((value) => value + 1)}
        >
          Try again
        </Button>
      </div>
    );
  }
  return <SharedDatabaseContent data={result} />;
};

const SharedDatabaseContent = ({ data }: { data: SharedDatabase }) => {
  const workspace = useWorkspace();
  const nodes = useMemo(
    () =>
      createCollection(
        localOnlyCollectionOptions<LocalNode, string>({
          getKey: (node) => node.id,
        defaultIndexType: BasicIndex,
        autoIndex: 'eager',
          initialData: data.nodes.map((node) => ({
            ...node,
            localRevision: '0',
            serverRevision: '0',
          })),
        })
      ),
    [data]
  );

  return (
    <WorkspaceContext.Provider
      value={{
        ...workspace,
        collections: {
          ...workspace.collections,
          nodes,
          cleanup: () => nodes.cleanup(),
        },
      }}
    >
      <Database
        database={{ ...data.database, localRevision: '0', serverRevision: '0' }}
        role="viewer"
        shared
      >
        <DatabaseViews />
      </Database>
    </WorkspaceContext.Provider>
  );
};
