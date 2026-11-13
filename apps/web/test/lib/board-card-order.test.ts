import { expect, it } from 'vitest';

import {
  boardColumnOrderKey,
  moveRecordInOrder,
  orderRecordIds,
} from '@colanode/client/lib/view-record-order';
import {
  databaseViewAttributesSchema,
  type DatabaseViewAttributes,
} from '@colanode/core';
import { YDoc } from '@colanode/crdt';

it('reopens a saved order and keeps filtered cards in their saved slots', () => {
  const key = boardColumnOrderKey('status', 'todo');
  const done = boardColumnOrderKey('status', 'done');
  const view: DatabaseViewAttributes = {
    type: 'database_view',
    parentId: 'database',
    layout: 'board',
    name: 'Tasks',
    index: 'a0',
    groupBy: 'status',
    boardCardOrder: { [key]: ['a', 'hidden', 'b', 'c'], [done]: ['d'] },
  };
  const order = moveRecordInOrder(
    view.boardCardOrder![key]!,
    ['a', 'b', 'c'],
    'c',
    'a',
    'before'
  );
  expect(order).toEqual(['c', 'hidden', 'a', 'b']);
  const doc = new YDoc();
  doc.update(databaseViewAttributesSchema, view);
  doc.update(databaseViewAttributesSchema, {
    ...view,
    boardCardOrder: { ...view.boardCardOrder, [key]: order! },
  });

  const legacy = new YDoc(doc.getState());
  const oldSchema = databaseViewAttributesSchema.omit({ boardCardOrder: true });
  legacy.update(oldSchema, {
    ...legacy.getObject<DatabaseViewAttributes>(),
    name: 'Renamed board',
  });
  const reopened = new YDoc(
    legacy.getState()
  ).getObject<DatabaseViewAttributes>();
  expect(
    orderRecordIds(
      ['a', 'b', 'c', 'hidden', 'new'],
      reopened.boardCardOrder?.[key]
    )
  ).toEqual(['c', 'hidden', 'a', 'b', 'new']);
  expect(reopened.boardCardOrder?.[done]).toEqual(['d']);
});
