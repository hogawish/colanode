import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { SpaceChildArchiveMutationHandler } from '@colanode/client/handlers/mutations/spaces/space-child-archive';
import { SpaceChildReorderMutationHandler } from '@colanode/client/handlers/mutations/spaces/space-child-reorder';
import type { LocalNode, LocalSpaceNode } from '@colanode/client/types';
import type { SpaceAttributes } from '@colanode/core';
import {
  spaceAttributesSchema,
  spaceChildAttributesSchema,
} from '@colanode/core';
import { YDoc } from '@colanode/crdt';
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

  it('archives and restores one item while the previous schema can still reorder it', async () => {
    const previousSchema = spaceAttributesSchema.extend({
      children: z
        .record(z.string(), spaceChildAttributesSchema.omit({ archived: true }))
        .optional(),
    });
    const document = new YDoc();
    document.update(previousSchema, {
      type: 'space',
      name: 'Work',
      visibility: 'public',
      collaborators: { human: 'admin' },
      children: { a: { id: 'a', index: 'Zz' }, b: { id: 'b', index: 'a1' } },
    });
    const clauses: unknown[][] = [];
    const query = {
      where: (...args: unknown[]) => {
        clauses.push(args);
        return query;
      },
      select: () => query,
      executeTakeFirst: async () => ({ id: 'a' }),
      orderBy: () => query,
      selectAll: () => query,
      execute: async () => [{ id: 'a' }, { id: 'b' }],
    };
    let schema: z.ZodType = spaceAttributesSchema;
    fixture.workspace = {
      database: { selectFrom: () => query },
      nodes: {
        updateNode: vi.fn(
          async (
            _id: string,
            update: (attributes: SpaceAttributes) => SpaceAttributes
          ) => {
            document.update(
              schema,
              update(document.getObject<SpaceAttributes>())
            );
            return 'success';
          }
        ),
      },
    };
    const archive = new SpaceChildArchiveMutationHandler(
      {} as ConstructorParameters<typeof SpaceChildArchiveMutationHandler>[0]
    );
    const reorder = new SpaceChildReorderMutationHandler(
      {} as ConstructorParameters<typeof SpaceChildReorderMutationHandler>[0]
    );
    const input = {
      type: 'space.child.archive',
      userId: 'human',
      spaceId: 'space',
      childId: 'a',
      archived: true,
    } as const;
    await archive.handleMutation(input);
    expect(clauses).toContainEqual(['root_id', '=', 'space']);
    expect(document.getObject<SpaceAttributes>().children?.a).toEqual({
      id: 'a',
      index: 'Zz',
      archived: true,
    });

    schema = previousSchema;
    await reorder.handleMutation({
      type: 'space.child.reorder',
      userId: 'human',
      spaceId: 'space',
      childId: 'a',
      after: 'b',
    });
    const reordered = document.getObject<SpaceAttributes>();
    expect(reordered.children?.a?.archived).toBe(true);
    expect(reordered.children?.a?.index).not.toBe('Zz');

    schema = spaceAttributesSchema;
    await archive.handleMutation({ ...input, archived: false });
    expect(document.getObject<SpaceAttributes>()).toEqual({
      ...reordered,
      children: {
        ...reordered.children,
        a: { id: 'a', index: reordered.children?.a?.index },
      },
    });
  });
});
