import { expect, it, vi } from 'vitest';

import { TableOrderUpdateMutationHandler } from '@colanode/client/handlers/mutations/nodes/table-order-update';
import {
  databaseViewAttributesSchema,
  type DatabaseViewAttributes,
} from '@colanode/core';
import { YDoc } from '@colanode/crdt';

const state = vi.hoisted(() => ({ updateNode: vi.fn() }));
vi.mock(
  '@colanode/client/handlers/mutations/workspace-mutation-handler-base',
  () => ({
    WorkspaceMutationHandlerBase: class {
      getWorkspace() {
        return { nodes: { updateNode: state.updateNode } };
      }
    },
  })
);

it('persists a view order across reload and preserves both sort settings and filtered rows', async () => {
  let doc = new YDoc();
  const original: DatabaseViewAttributes = {
    type: 'database_view',
    layout: 'table',
    parentId: 'db',
    name: 'List',
    index: 'a0',
    sorts: { date: { id: 'date', fieldId: 'date', direction: 'desc' } },
    manualRowOrder: ['a', 'filtered', 'b'],
  };
  doc.update(databaseViewAttributesSchema, original);
  state.updateNode.mockImplementation(async (_id, update) => {
    doc.update(
      databaseViewAttributesSchema,
      update(doc.getObject<DatabaseViewAttributes>())
    );
    return 'success';
  });
  const handler = new TableOrderUpdateMutationHandler(
    {} as ConstructorParameters<typeof TableOrderUpdateMutationHandler>[0]
  );
  const base = {
    type: 'table.order.update',
    userId: 'user',
    databaseId: 'db',
    viewId: 'view',
  } as const;
  const reorder = {
    ...base,
    action: 'reorder',
    visibleIds: ['a', 'b'],
    recordId: 'b',
    anchorId: 'a',
    side: 'before',
  } as const;
  await expect(
    handler.handleMutation({ ...reorder, visibleIds: [...reorder.visibleIds] })
  ).rejects.toThrow('Manual order');
  await handler.handleMutation({ ...base, action: 'set-mode', manual: true });
  await handler.handleMutation({
    ...reorder,
    visibleIds: [...reorder.visibleIds],
  });
  await handler.handleMutation({ ...base, action: 'set-mode', manual: false });
  doc = new YDoc(doc.getState());
  await handler.handleMutation({ ...base, action: 'set-mode', manual: true });
  expect(doc.getObject<DatabaseViewAttributes>()).toEqual({
    ...original,
    manualSort: true,
    manualRowOrder: ['b', 'filtered', 'a'],
  });
});
