import { describe, expect, it, vi } from 'vitest';

import { setRecordField } from '@colanode/client/handlers/mutations/nodes/record-field-set';
import type { RecordAttributes } from '@colanode/core';
import { bulkFieldValue } from '@colanode/ui/lib/record-bulk';

vi.mock(
  '@colanode/client/handlers/mutations/workspace-mutation-handler-base',
  () => ({ WorkspaceMutationHandlerBase: class {} })
);

describe('record bulk field editing', () => {
  it('changes one field and preserves other fields and attributes from the latest record', () => {
    const record: RecordAttributes = {
      type: 'record',
      parentId: 'db',
      databaseId: 'db',
      name: 'Human title',
      fields: {
        note: { type: 'text', value: 'Human note' },
        status: { type: 'string', value: 'old' },
      },
    };
    const next = setRecordField(record, {
      databaseId: 'db',
      fieldId: 'status',
      value: { type: 'string', value: 'new' },
    });
    expect(next.fields.note).toEqual(record.fields.note);
    expect(next.name).toBe('Human title');
    expect(next.fields.status).toEqual({ type: 'string', value: 'new' });
    expect(record.fields.status).toEqual({ type: 'string', value: 'old' });
    const cleared = setRecordField(next, {
      databaseId: 'db',
      fieldId: 'status',
      value: null,
    });
    expect(cleared.fields.status).toBeUndefined();
    expect(cleared.fields.note).toEqual(record.fields.note);
  });
  it('rejects a moved record instead of changing another database', () => {
    expect(() =>
      setRecordField(
        {
          type: 'record',
          parentId: 'other',
          databaseId: 'other',
          name: '',
          fields: {},
        },
        { databaseId: 'db', fieldId: 'x', value: null }
      )
    ).toThrow('no longer in this database');
  });
  it('uses native field values and validates numbers and select options', () => {
    const base = { id: 'field', name: 'Status', index: 'a0' };
    const select = {
      ...base,
      type: 'select' as const,
      options: {
        open: { id: 'open', name: 'Open', color: 'blue', index: 'a0' },
      },
    };
    expect(bulkFieldValue(select, 'open')).toEqual({
      type: 'string',
      value: 'open',
    });
    expect(() => bulkFieldValue(select, 'missing')).toThrow('Choose an option');
    expect(() => bulkFieldValue({ ...base, type: 'number' }, '')).toThrow(
      'valid number'
    );
    expect(bulkFieldValue({ ...base, type: 'number' }, '0')).toEqual({
      type: 'number',
      value: 0,
    });
    expect(bulkFieldValue({ ...base, type: 'boolean' }, 'false')).toEqual({
      type: 'boolean',
      value: false,
    });
    expect(() =>
      bulkFieldValue({ ...base, type: 'created_at' }, 'value')
    ).toThrow('cannot be edited');
  });
});
