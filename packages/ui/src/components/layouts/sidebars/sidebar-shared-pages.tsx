import { Link } from '@tanstack/react-router';
import { FileText, RefreshCw } from 'lucide-react';

import { SidebarHeader } from '@colanode/ui/components/layouts/sidebars/sidebar-header';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { useQuery } from '@colanode/ui/hooks/use-query';
import { cn } from '@colanode/ui/lib/utils';

export const SidebarSharedPages = () => {
  const { userId, workspaceId } = useWorkspace();
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
            onClick={() => void query.refetch()}
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
            <li key={page.id}>
              <Link
                className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent"
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
            </li>
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
