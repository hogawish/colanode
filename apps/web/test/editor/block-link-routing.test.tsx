import {
  createMemoryHistory,
  createRouteMask,
  createRouter,
} from '@tanstack/react-router';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@colanode/ui/components/nodes/node-container', () => ({
  NodeContainer: () => null,
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
});
