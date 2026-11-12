import {
  useQuery as useAsyncQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ChevronRight, Database, FileText, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import type { SharedPage } from '@colanode/client/mutations';
import { SidebarHeader } from '@colanode/ui/components/layouts/sidebars/sidebar-header';
import { SharedDatabaseDialog } from '@colanode/ui/components/pages/shared-database';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { useQuery } from '@colanode/ui/hooks/use-query';
import { cn } from '@colanode/ui/lib/utils';

const rowClass =
  'flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent';

const SharedPageBranch = ({ page }: { page: SharedPage['pages'][number] }) => {
  const { userId, workspaceId } = useWorkspace();
  const [expanded, setExpanded] = useState(false);
  const children = useAsyncQuery({
    queryKey: ['shared-page-children', userId, page.id],
    enabled: expanded,
    retry: false,
    queryFn: async () => {
      const result = await window.colanode.executeMutation({
        type: 'page.share',
        action: 'read',
        pageId: page.id,
        userId,
      });
      if (!result.success || result.output.action !== 'read') {
        throw new Error('Could not load child pages.');
      }
      return {
        pages: result.output.page.pages,
        databases: result.output.page.databases ?? [],
      };
    },
  });
  const empty =
    children.isSuccess &&
    !children.data.pages.length &&
    !children.data.databases.length;

  return (
    <li>
      <div className="flex min-w-0 items-center">
        {empty ? (
          <span className="w-5 shrink-0" />
        ) : (
          <button
            type="button"
            className="grid size-5 shrink-0 place-items-center rounded-sm hover:bg-sidebar-accent"
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${page.name}`}
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            <ChevronRight className={cn('size-4', expanded && 'rotate-90')} />
          </button>
        )}
        <Link
          className={cn(rowClass, 'flex-1')}
          activeProps={{ className: 'bg-sidebar-accent' }}
          to="/workspace/$userId/shared/$pageId"
          params={{ userId, pageId: page.id }}
          mask={{
            to: '/$workspaceId/shared/$pageId',
            params: { workspaceId, pageId: page.id },
          }}
          title={page.name}
        >
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">{page.name}</span>
        </Link>
      </div>
      {expanded &&
        !empty &&
        (children.isPending ? (
          <p role="status" className="pl-6 text-xs text-muted-foreground">
            Loading…
          </p>
        ) : children.isError ? (
          <button
            type="button"
            className="pl-6 text-xs text-muted-foreground underline"
            onClick={() => void children.refetch()}
          >
            Retry loading children
          </button>
        ) : (
          <ul className="flex min-w-0 flex-col gap-0.5 pl-3">
            {children.data?.pages.map((child) => (
              <SharedPageBranch key={child.id} page={child} />
            ))}
            {children.data?.databases.map((database) => (
              <li key={database.id} className="pl-5">
                <SharedDatabaseDialog
                  pageId={page.id}
                  database={database}
                  trigger={
                    <button
                      type="button"
                      title={database.name}
                      className={cn(rowClass, 'w-full text-left')}
                    >
                      <Database className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">
                        {database.name}
                      </span>
                    </button>
                  }
                />
              </li>
            ))}
          </ul>
        ))}
    </li>
  );
};

export const SidebarSharedPages = () => {
  const { userId } = useWorkspace();
  const queryClient = useQueryClient();
  const query = useQuery(
    { type: 'shared.pages.list', userId },
    { retry: false, refetchOnWindowFocus: true }
  );

  return (
    <section className="mt-2 border-t border-sidebar-border pb-2">
      <SidebarHeader
        title="Shared with me"
        actions={
          <button
            type="button"
            className="rounded p-1 hover:bg-sidebar-accent focus-visible:outline-ring"
            aria-label="Refresh shared pages"
            title="Refresh shared pages"
            disabled={query.isFetching}
            onClick={() => {
              void query.refetch();
              void queryClient.invalidateQueries({
                queryKey: ['shared-page-children', userId],
              });
            }}
          >
            <RefreshCw
              className={cn('size-4', query.isFetching && 'animate-spin')}
            />
          </button>
        }
      />
      {query.isPending ? (
        <p className="px-2 text-xs text-muted-foreground">
          Loading shared pages…
        </p>
      ) : query.isError ? (
        <p className="px-2 text-xs text-muted-foreground">
          Could not load shared pages.
        </p>
      ) : query.data?.length ? (
        <ul className="flex min-w-0 flex-col gap-0.5">
          {query.data.map((page) => (
            <SharedPageBranch key={page.id} page={page} />
          ))}
        </ul>
      ) : (
        <p className="px-2 text-xs text-muted-foreground">
          No shared pages yet.
        </p>
      )}
    </section>
  );
};
