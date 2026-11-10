import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { activityNodesSql, withRecordActivity } from '../src/lib/record-activity';

const record = {
  id: 'record-a', type: 'record', name: 'Original title', fields: {},
  createdAt: '2025-01-01T10:00:00.000Z', createdBy: 'client-a',
  updatedAt: '2025-01-01T10:05:00.000Z', updatedBy: 'client-a',
};
const document = {
  createdAt: '2025-01-01T10:01:00.000Z', createdBy: 'client-a',
  updatedAt: '2025-01-01T10:08:00.000Z', updatedBy: 'client-b',
};

describe('derived record activity', () => {
  it('uses later body activity without mutating source or creation metadata', () => {
    const effective = withRecordActivity(record, document);
    expect(effective.updatedAt).toBe(document.updatedAt);
    expect(effective.updatedBy).toBe('client-b');
    expect(effective.createdAt).toBe(record.createdAt);
    expect(effective.createdBy).toBe(record.createdBy);
    expect(effective.name).toBe(record.name);
    expect(record.updatedAt).toBe('2025-01-01T10:05:00.000Z');
    expect(withRecordActivity({ ...record, updatedAt: null }, null).updatedAt).toBe(record.createdAt);
    expect(withRecordActivity({ ...record, updatedAt: null }, { ...document, updatedAt: null }).updatedAt).toBe(document.createdAt);
    expect(withRecordActivity({ ...record, updatedAt: '2025-01-01T10:09:00.000Z' }, document).updatedBy).toBe('client-a');
    const page = { ...record, type: 'page' };
    expect(withRecordActivity(page, document)).toBe(page);
  });

  it('applies the same effective time before SQL filtering, sorting and limiting', () => {
    const db = new DatabaseSync(':memory:');
    try {
      db.exec('CREATE TABLE nodes(id,type,parent_id,root_id,attributes,local_revision,server_revision,created_at,created_by,updated_at,updated_by); CREATE TABLE documents(id,created_at,created_by,updated_at,updated_by);');
      const insert = db.prepare('INSERT INTO nodes VALUES(?,?,?,?,?,?,?,?,?,?,?)');
      insert.run('record-a', 'record', 'db', 'space', '{}', '1', '1', record.createdAt, record.createdBy, record.updatedAt, record.updatedBy);
      insert.run('record-b', 'record', 'db', 'space', '{}', '1', '1', record.createdAt, record.createdBy, '2025-01-01T10:06:00.000Z', record.updatedBy);
      db.prepare('INSERT INTO documents VALUES(?,?,?,?,?)').run('record-a', document.createdAt, document.createdBy, document.updatedAt, document.updatedBy);
      const rows = db.prepare(`SELECT id,updated_by FROM ${activityNodesSql} n WHERE updated_at > ? ORDER BY updated_at DESC LIMIT 1`).all('2025-01-01T10:07:00.000Z');
      expect(rows).toEqual([{ id: 'record-a', updated_by: 'client-b' }]);
      expect(db.prepare('SELECT updated_at FROM nodes WHERE id=?').get('record-a')?.updated_at).toBe(record.updatedAt);
    } finally {
      db.close();
    }
  });
});
