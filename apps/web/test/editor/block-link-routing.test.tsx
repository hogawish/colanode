import {
  createMemoryHistory,
  createRouteMask,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

type RichTextContent = import('@colanode/core').RichTextContent;

const localNode = vi.hoisted(() => ({ exists: false }));
vi.mock(import('@tanstack/react-db'), async (original) => ({
  ...(await original()),
  useLiveQuery: () => ({
    isLoading: false,
    data: localNode.exists ? { id: 'pagepg' } : undefined,
  }),
}));
vi.mock('@colanode/ui/contexts/workspace', () => ({
  useWorkspace: () => ({
    workspaceId: 'space',
    userId: 'human',
    collections: {},
  }),
}));
vi.mock('@colanode/ui/components/files/file-save-button', () => ({
  FileSaveButton: () => null,
}));
vi.mock('@colanode/ui/components/pages/shared-page-editor', () => ({
  SharedPageEditor: () => null,
}));

vi.mock('@colanode/ui/components/nodes/node-container', () => ({
  NodeContainer: () => <div data-testid="local-page-editor" />,
}));
vi.mock('@colanode/ui/components/nodes/node-error-container', () => ({
  NodeErrorContainer: () => null,
}));
vi.mock('@colanode/ui/components/nodes/node-tab', () => ({
  NodeTab: () => null,
}));
vi.mock('@colanode/ui/routes/utils', () => ({
  getWorkspaceUserId: () => 'human',
}));
vi.mock('@colanode/ui/routes/workspace', async () => {
  const { createRootRoute, createRoute } =
    await import('@tanstack/react-router');
  const root = createRootRoute();
  return {
    workspaceRoute: createRoute({
      getParentRoute: () => root,
      path: '/workspace/$userId',
    }),
    workspaceMaskRoute: createRoute({
      getParentRoute: () => root,
      path: '/$workspaceId',
    }),
  };
});

import { readBlockHash } from '@colanode/ui/lib/block-links';
import {
  workspaceRoute,
  workspaceMaskRoute,
} from '@colanode/ui/routes/workspace';
import { nodeRoute, nodeMaskRoute } from '@colanode/ui/routes/workspace/node';
import {
  sharedPageRoute,
  sharedPageMaskRoute,
} from '@colanode/ui/routes/workspace/shared-page';

describe('block link route masking', () => {
  it('retains the block fragment in both application state and the visible URL after direct navigation', async () => {
    const root = workspaceRoute.options.getParentRoute!();
    const routeTree = root.addChildren([
      workspaceRoute.addChildren([nodeRoute]),
      workspaceMaskRoute.addChildren([nodeMaskRoute]),
    ]);
    const history = createMemoryHistory({
      initialEntries: ['/space/page#block=target'],
    });
    const router = createRouter({
      routeTree,
      history,
      routeMasks: [
        createRouteMask({
          routeTree,
          from: '/workspace/$userId/$nodeId',
          to: '/$workspaceId/$nodeId',
          params: { workspaceId: 'space' },
        }),
      ],
    });
    await router.load();
    expect(
      readBlockHash(
        router.state.location.maskedLocation?.hash || router.state.location.hash
      )
    ).toBe('target');
    expect(history.location.href).toBe('/space/page#block=target');
  });

  it('keeps the ordinary page editor mounted when a block hash is added', async () => {
    localNode.exists = true;
    try {
      const root = workspaceRoute.options.getParentRoute!();
      const routeTree = root.addChildren([
        workspaceRoute.addChildren([nodeRoute]),
        workspaceMaskRoute.addChildren([nodeMaskRoute]),
      ]);
      const history = createMemoryHistory({
        initialEntries: ['/space/pagepg'],
      });
      const router = createRouter({ routeTree, history });
      render(<RouterProvider router={router} />);
      const editor = await screen.findByTestId('local-page-editor');
      await act(() =>
        router.navigate({
          to: '/workspace/$userId/$nodeId',
          params: { userId: 'human', nodeId: 'pagepg' },
          hash: 'block=target',
        })
      );
      expect(screen.getByTestId('local-page-editor')).toBe(editor);
      expect(readBlockHash(router.state.location.hash)).toBe('target');
    } finally {
      localNode.exists = false;
    }
  });
});

describe('shared viewer block links', () => {
  const content: RichTextContent = {
    type: 'rich_text',
    blocks: {
      outer: { id: 'outer', type: 'toggle', parentId: 'pagepg', index: 'a0' },
      outerTitle: {
        id: 'outerTitle',
        type: 'paragraph',
        parentId: 'outer',
        index: 'a0',
        content: [{ type: 'text', text: 'Outer title' }],
      },
      inner: { id: 'inner', type: 'toggle', parentId: 'outer', index: 'a1' },
      innerTitle: {
        id: 'innerTitle',
        type: 'paragraph',
        parentId: 'inner',
        index: 'a0',
        content: [{ type: 'text', text: 'Inner title' }],
      },
      child: {
        id: 'child',
        type: 'paragraph',
        parentId: 'inner',
        index: 'a1',
        content: [{ type: 'text', text: 'Shared viewer target' }],
      },
    },
  };

  it.each(['/space/pagepg', '/space/shared/pagepg'])(
    'opens the viewer target from %s with its block fragment',
    async (path) => {
      const root = workspaceRoute.options.getParentRoute!();
      const routeTree = root.addChildren([
        workspaceRoute.addChildren([nodeRoute, sharedPageRoute]),
        workspaceMaskRoute.addChildren([nodeMaskRoute, sharedPageMaskRoute]),
      ]);
      const href = path + '#block=child';
      const history = createMemoryHistory({ initialEntries: [href] });
      const router = createRouter({ routeTree, history });
      const executeMutation = vi.fn().mockResolvedValue({
        success: true,
        output: {
          action: 'read',
          page: {
            name: 'Fixture',
            canEdit: false,
            content,
            pages: [],
            files: [],
          },
        },
      });
      vi.stubGlobal('colanode', { executeMutation });
      HTMLElement.prototype.scrollIntoView = vi.fn();
      render(<RouterProvider router={router} />);
      const target = await screen.findByText('Shared viewer target');
      const outer = screen.getByText('Outer title').closest('details')!;
      const inner = screen.getByText('Inner title').closest('details')!;
      expect(executeMutation).toHaveBeenCalledExactlyOnceWith({
        type: 'page.share',
        action: 'read',
        userId: 'human',
        pageId: 'pagepg',
      });
      expect(screen.getByText('Shared page · View only')).toBeVisible();
      expect(screen.queryByRole('button', { name: 'Edit page' })).toBeNull();
      expect(history.location.href).toBe(href);
      await waitFor(() =>
        expect(
          vi.mocked(HTMLElement.prototype.scrollIntoView).mock.contexts
        ).toContain(target)
      );

      const isShared = path.includes('/shared/');
      const navigateWithHash = (hash: string) =>
        isShared
          ? router.navigate({
              to: '/workspace/$userId/shared/$pageId',
              params: { userId: 'human', pageId: 'pagepg' },
              hash,
            })
          : router.navigate({
              to: '/workspace/$userId/$nodeId',
              params: { userId: 'human', nodeId: 'pagepg' },
              hash,
            });
      await act(() => navigateWithHash('block=outerTitle'));
      outer.open = false;
      inner.open = false;
      await act(() => navigateWithHash('block=child'));
      await waitFor(() => {
        expect(outer.open).toBe(true);
        expect(inner.open).toBe(true);
      });
    }
  );
});
