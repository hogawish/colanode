import { describe, expect, it, vi } from 'vitest';

import { SpaceChildReorderMutationHandler } from '@colanode/client/handlers/mutations/spaces/space-child-reorder';
import type { LocalNode, LocalSpaceNode } from '@colanode/client/types';
import { sortSpaceChildren } from '@colanode/ui/lib/spaces';

const fixture = vi.hoisted(() => ({
  workspace: {} as {
    database: { selectFrom: () => unknown };
    nodes: { updateNode: ReturnType<typeof vi.fn> };
  },
}));
vi.mock(
  '@colanode/client/handlers/mutations/workspace-mutation-handler-base',
  () => ({
    WorkspaceMutationHandlerBase: class {
      getWorkspace() {
        return fixture.workspace;
      }
    },
  })
);

describe('sidebar sibling ordering', () => {
  it('persists page-child ordering in the existing space metadata without moving pages', () => {
    const children = [
      { id: 'a', parentId: 'page' },
      { id: 'b', parentId: 'page' },
    ] as LocalNode[];
    const space = {
      children: { b: { id: 'b', index: 'Zz' } },
    } as unknown as LocalSpaceNode;
    expect(sortSpaceChildren(space, children).map((node) => node.id)).toEqual([
      'b',
      'a',
    ]);
    expect(children.map((node) => node.parentId)).toEqual(['page', 'page']);
  });
  it('scopes reorder to siblings in the same space and reports a permission failure', async () => {
    const clauses: unknown[][] = [];
    const query = {
      where: (...args: unknown[]) => {
        clauses.push(args);
        return query;
      },
      orderBy: () => query,
      selectAll: () => query,
      execute: async () => [{ id: 'a' }, { id: 'b' }],
    };
    fixture.workspace = {
      database: { selectFrom: () => query },
      nodes: { updateNode: vi.fn().mockResolvedValue('unauthorized') },
    };
    const handler = new SpaceChildReorderMutationHandler(
      {} as ConstructorParameters<typeof SpaceChildReorderMutationHandler>[0]
    );
    await expect(
      handler.handleMutation({
        type: 'space.child.reorder',
        userId: 'human',
        spaceId: 'space',
        parentId: 'page',
        childId: 'b',
        after: null,
      })
    ).rejects.toThrow('permission');
    expect(clauses).toContainEqual(['parent_id', '=', 'page']);
    expect(clauses).toContainEqual(['root_id', '=', 'space']);
    fixture.workspace.nodes.updateNode.mockClear();
    await expect(
      handler.handleMutation({
        type: 'space.child.reorder',
        userId: 'human',
        spaceId: 'space',
        parentId: 'page',
        childId: 'foreign',
        after: null,
      })
    ).rejects.toThrow('same parent');
    expect(fixture.workspace.nodes.updateNode).not.toHaveBeenCalled();
  });
});
