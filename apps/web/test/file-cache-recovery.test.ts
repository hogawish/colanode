import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import { Kysely, SqliteDialect } from 'kysely';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { WorkspaceDatabaseSchema } from '@colanode/client/databases/workspace/schema';
import { FileService } from '@colanode/client/services/workspaces/file-service';
import type { WorkspaceService } from '@colanode/client/services/workspaces/workspace-service';
import { WebPathService } from '@colanode/web/services/path-service';

const databases: Kysely<WorkspaceDatabaseSchema>[] = [];
afterEach(async () => {
  for (const db of databases.splice(0)) await db.destroy();
});
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

const setup = (extension: string, present: boolean) => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`CREATE TABLE nodes(id,type,parent_id,root_id,attributes,local_revision,server_revision,created_at,created_by,updated_at,updated_by);
    CREATE TABLE local_files(id PRIMARY KEY,version,path,created_at,opened_at,download_status,download_progress,download_retries,download_completed_at,download_error_code,download_error_message);`);
  const now = new Date().toISOString();
  sqlite.prepare('INSERT INTO nodes VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(
    'photo',
    'file',
    'record',
    'space',
    JSON.stringify({
      type: 'file',
      name: 'moment.png',
      subtype: 'image',
      extension,
      mimeType: 'image/png',
      status: 1,
      version: 'v1',
      size: png.length,
    }),
    '1',
    '1',
    now,
    'author',
    null,
    null
  );
  const originalPath = 'workspaces/viewer/files/photo' + extension;
  sqlite
    .prepare('INSERT INTO local_files VALUES(?,?,?,?,?,?,?,?,?,?,?)')
    .run('photo', 'v1', originalPath, now, now, 2, 100, 0, now, null, null);
  const database = new Kysely<WorkspaceDatabaseSchema>({
    dialect: new SqliteDialect({
      database: {
        prepare(sql: string) {
          const statement = sqlite.prepare(sql);
          return {
            reader: statement.columns().length > 0,
            iterate: (parameters: readonly unknown[]) =>
              statement.iterate(...(parameters as SQLInputValue[])),
            all: (parameters: readonly unknown[]) =>
              statement.all(...(parameters as SQLInputValue[])),
            run: (parameters: readonly unknown[]) =>
              statement.run(...(parameters as SQLInputValue[])),
          };
        },
        close() {
          sqlite.close();
        },
      },
    }),
  });
  databases.push(database);
  const bytes = new Map<string, Uint8Array>(
    present ? [[originalPath, png]] : []
  );
  const fs = {
    makeDirectory: vi.fn(async () => {}),
    exists: vi.fn(async (path: string) => bytes.has(path)),
    copy: vi.fn(async (from: string, to: string) => {
      bytes.set(to, bytes.get(from)!);
    }),
    delete: vi.fn(async (path: string) => {
      bytes.delete(path);
    }),
    listFiles: vi.fn(async (dir: string) =>
      [...bytes.keys()]
        .filter((path) => path.startsWith(dir + '/'))
        .map((path) => path.slice(dir.length + 1))
    ),
    url: vi.fn(async (path: string) =>
      bytes.has(path) ? 'blob:http://localhost/' + path : null
    ),
  };
  const addJob = vi.fn(async () => {});
  const app = { fs, path: new WebPathService(), jobs: { addJob } };
  const workspace = {
    userId: 'viewer',
    workspaceId: 'space',
    accountId: 'account',
    database,
    account: { app },
  };
  const service = new FileService(workspace as unknown as WorkspaceService);
  return { service, database, bytes, addJob, originalPath, fs };
};

describe('native image cache lifecycle', () => {
  it('keeps an initially visible legacy Bridge image visible after cleanup and reopen', async () => {
    const { service, bytes, addJob } = setup('png', true);
    expect((await service.getLocalFile('photo', true))?.url).not.toBeNull();
    await service.cleanupFiles();
    expect((await service.getLocalFile('photo', true))?.url).not.toBeNull();
    expect(bytes.get('workspaces/viewer/files/photo.png')).toEqual(png);
    expect(addJob).not.toHaveBeenCalled();
  });

  it('recovers an already missing Completed image with one existing download job', async () => {
    const { service, database, bytes, addJob } = setup('png', false);
    const pending = await service.getLocalFile('photo', true);
    expect(pending?.path).toBe('workspaces/viewer/files/photo.png');
    expect(pending?.downloadStatus).toBe(0);
    expect(pending?.url).toBeNull();
    await service.getLocalFile('photo', true);
    expect(addJob).toHaveBeenCalledTimes(1);
    expect(addJob).toHaveBeenCalledWith({
      type: 'local.file.download',
      userId: 'viewer',
      fileId: 'photo',
    });
    // Complete the queued transfer with the same original bytes, then reopen.
    bytes.set(pending!.path, png);
    await database
      .updateTable('local_files')
      .set({ download_status: 2, download_progress: 100 })
      .where('id', '=', 'photo')
      .execute();
    await service.cleanupFiles();
    const recovered = await service.getLocalFile('photo', true);
    expect(recovered?.downloadStatus).toBe(2);
    expect(recovered?.url).not.toBeNull();
  });

  it('preserves canonical cache files and respects disabled auto-download', async () => {
    const { service, addJob, bytes } = setup('.png', true);
    await service.cleanupFiles();
    expect((await service.getLocalFile('photo', true))?.url).not.toBeNull();
    bytes.clear();
    await service.getLocalFile('photo', false);
    expect(addJob).not.toHaveBeenCalled();
  });

  it('preserves an in-flight legacy cache until the transfer completes', async () => {
    const { service, database, bytes, originalPath, fs } = setup('png', true);
    await database
      .updateTable('local_files')
      .set({ download_status: 1 })
      .where('id', '=', 'photo')
      .execute();
    await service.getLocalFile('photo', true);
    await service.cleanupFiles();
    expect(fs.copy).not.toHaveBeenCalled();
    expect(bytes.get(originalPath)).toEqual(png);
    await database
      .updateTable('local_files')
      .set({ download_status: 2 })
      .where('id', '=', 'photo')
      .execute();
    expect((await service.getLocalFile('photo', true))?.path).toBe(
      'workspaces/viewer/files/photo.png'
    );
    expect(bytes.get('workspaces/viewer/files/photo.png')).toEqual(png);
  });
});
