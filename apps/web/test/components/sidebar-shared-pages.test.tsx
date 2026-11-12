import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SidebarSharedPages } from '@colanode/ui/components/layouts/sidebars/sidebar-shared-pages';

vi.mock(import('@tanstack/react-router'), async (original) => ({
  ...(await original()),
  Link: ({
    params,
    children,
  }: {
    params: { pageId: string };
    children: React.ReactNode;
  }) => <a href={`/shared/${params.pageId}`}>{children}</a>,
}));
vi.mock('@colanode/ui/contexts/workspace', () => ({
  useWorkspace: () => ({ userId: 'exampleus', workspaceId: 'examplewc' }),
}));
vi.mock('@colanode/ui/hooks/use-query', () => ({
  useQuery: () => ({ data: [{ id: 'parentpg', name: 'Shared parent' }] }),
}));
vi.mock('@colanode/ui/components/pages/shared-database', () => ({
  SharedDatabaseDialog: ({ trigger }: { trigger: React.ReactNode }) => trigger,
}));

describe('shared page sidebar', () => {
  it('loads children on demand, nests them, and collapses the branch', async () => {
    const read = vi.fn().mockImplementation(({ pageId }) => ({
      success: true,
      output: {
        action: 'read',
        page:
          pageId === 'parentpg'
            ? {
                pages: [{ id: 'childpg', name: 'Shared child' }],
                databases: [{ id: 'tabledb', name: 'Shared table' }],
              }
            : { pages: [{ id: 'leafpg', name: 'Shared leaf' }] },
      },
    }));
    vi.stubGlobal('colanode', { executeMutation: read });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SidebarSharedPages />
      </QueryClientProvider>
    );

    expect(read).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Expand Shared parent' })
    );
    expect(
      await screen.findByRole('link', { name: 'Shared child' })
    ).toHaveAttribute('href', '/shared/childpg');
    expect(screen.getByRole('button', { name: 'Shared table' })).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: 'Expand Shared child' })
    );
    expect(
      await screen.findByRole('link', { name: 'Shared leaf' })
    ).toBeVisible();
    expect(read.mock.calls.map(([request]) => request.pageId)).toEqual([
      'parentpg',
      'childpg',
    ]);
    fireEvent.click(
      screen.getByRole('button', { name: 'Collapse Shared parent' })
    );
    expect(screen.queryByRole('link', { name: 'Shared child' })).toBeNull();
  });
});
