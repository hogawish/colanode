import { afterAll, expect, it, vi } from 'vitest';

import { generateId, IdType, UserStatus } from '@colanode/core';
import { database } from '@colanode/server/data/database';
import { createDocument } from '@colanode/server/lib/documents';
import { createNode } from '@colanode/server/lib/nodes';

import { buildTestApp } from '../helpers/app';
import {
  buildAuthHeader,
  createAccount,
  createDevice,
  createFileNode,
  createPageNode,
  createSpaceNode,
  createUser,
  createWorkspace,
} from '../helpers/seed';

const app = buildTestApp();
afterAll(() => app.close());

it('authorizes Notion transfer before outbound calls, including revoked and cross-workspace access', async () => {
  const owner = await createAccount(),
    guest = await createAccount();
  const workspace = await createWorkspace({ createdBy: owner.id });
  const admin = await createUser({
    account: owner,
    workspaceId: workspace.id,
    role: 'owner',
  });
  const viewer = await createUser({
    account: guest,
    workspaceId: workspace.id,
    role: 'guest',
  });
  const device = await createDevice({ accountId: owner.id }),
    guestDevice = await createDevice({ accountId: guest.id });
  const headers = buildAuthHeader(device.token),
    guestHeaders = buildAuthHeader(guestDevice.token);
  const rootId = await createSpaceNode({
    workspaceId: workspace.id,
    userId: admin.id,
  });
  const page = await createPageNode({
    workspaceId: workspace.id,
    userId: admin.id,
    rootId,
    parentId: rootId,
    name: 'Transfer fixture',
  });
  const base = `/client/v1/workspaces/${workspace.id}/page-shares/${page}`;
  const transfer = (url = base, auth = guestHeaders) =>
    app.inject({
      method: 'POST',
      url: `${url}/notion`,
      headers: auth,
      payload: {
        token: 'synthetic-test-token',
        parent: '0123456789abcdef0123456789abcdef',
      },
    });
  const api = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({
          id: '0123456789abcdef0123456789abcdea',
          url: 'https://www.notion.so/new',
        })
      )
    );
  vi.stubGlobal('fetch', api);
  try {
    expect((await transfer()).statusCode).toBe(404);
    expect(api).not.toHaveBeenCalled();
    expect(
      (
        await app.inject({
          method: 'PUT',
          url: `${base}/viewers`,
          headers,
          payload: { viewerId: viewer.id, enabled: true },
        })
      ).statusCode
    ).toBe(200);
    const result = await transfer();
    expect(result.statusCode).toBe(200);
    expect(result.json().complete).toBe(true);
    expect(result.headers['cache-control']).toBe('private, no-store');
    expect(api).toHaveBeenCalledOnce();
    expect(result.body).not.toContain('synthetic-test-token');
    api.mockClear();
    expect(
      (
        await app.inject({
          method: 'PUT',
          url: `${base}/viewers`,
          headers,
          payload: { viewerId: viewer.id, enabled: false },
        })
      ).statusCode
    ).toBe(200);
    expect((await transfer()).statusCode).toBe(404);
    expect(api).not.toHaveBeenCalled();
    const other = await createWorkspace({ createdBy: owner.id });
    await createUser({ account: owner, workspaceId: other.id, role: 'owner' });
    expect(
      (
        await transfer(
          `/client/v1/workspaces/${other.id}/page-shares/${page}`,
          headers
        )
      ).statusCode
    ).toBe(404);
    expect(api).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});

it('exports only readable descendants and all database pages; record images require both live sharing and body references', async () => {
  const [owner, guest, outsider] = await Promise.all([
    createAccount(),
    createAccount(),
    createAccount(),
  ]);
  const workspace = await createWorkspace({ createdBy: owner.id });
  const [admin, viewer] = await Promise.all([
    createUser({ account: owner, workspaceId: workspace.id, role: 'owner' }),
    createUser({ account: guest, workspaceId: workspace.id, role: 'guest' }),
    createUser({ account: outsider, workspaceId: workspace.id, role: 'admin' }),
  ]);
  const [ownerDevice, guestDevice, outsiderDevice] = await Promise.all([
    createDevice({ accountId: owner.id }),
    createDevice({ accountId: guest.id }),
    createDevice({ accountId: outsider.id }),
  ]);
  const ownerHeaders = buildAuthHeader(ownerDevice.token),
    guestHeaders = buildAuthHeader(guestDevice.token);
  const rootId = await createSpaceNode({
    workspaceId: workspace.id,
    userId: admin.id,
  });
  const fixture = { workspaceId: workspace.id, userId: admin.id, rootId };
  const page = await createPageNode({
    ...fixture,
    parentId: rootId,
    name: 'Shared root',
  });
  const child = await createPageNode({
    ...fixture,
    parentId: page,
    name: 'Child',
  });
  const sibling = await createPageNode({
    ...fixture,
    parentId: rootId,
    name: 'Private sibling',
  });
  const folder = generateId(IdType.Folder),
    db = generateId(IdType.Database);
  expect(
    await createNode({
      ...fixture,
      nodeId: folder,
      attributes: { type: 'folder', name: 'Unshared folder', parentId: page },
    })
  ).toBeTruthy();
  expect(
    await createNode({
      ...fixture,
      nodeId: db,
      attributes: {
        type: 'database',
        name: 'Tasks',
        parentId: page,
        fields: {},
      },
    })
  ).toBeTruthy();
  const recordIds = Array.from({ length: 201 }, () =>
    generateId(IdType.Record)
  );
  for (const id of recordIds)
    expect(
      await createNode({
        ...fixture,
        nodeId: id,
        attributes: {
          type: 'record',
          name: 'Task',
          parentId: db,
          databaseId: db,
          fields: {},
        },
      })
    ).toBeTruthy();
  const record = recordIds[0]!;
  const base = `/client/v1/workspaces/${workspace.id}`;
  const payload = Buffer.from('record original image bytes');
  const attach = async () => {
    const id = await createFileNode({
      ...fixture,
      parentId: record,
      size: payload.length,
      name: 'image.png',
    });
    const created = await app.inject({
      method: 'POST',
      url: `${base}/files/${id}/tus`,
      headers: {
        ...ownerHeaders,
        'Tus-Resumable': '1.0.0',
        'Upload-Length': String(payload.length),
      },
    });
    expect([201, 204]).toContain(created.statusCode);
    const uploaded = await app.inject({
      method: 'PATCH',
      url: new URL(created.headers.location!, 'http://localhost').pathname,
      headers: {
        ...ownerHeaders,
        'Tus-Resumable': '1.0.0',
        'Upload-Offset': '0',
        'Content-Type': 'application/offset+octet-stream',
      },
      payload,
    });
    expect([200, 204]).toContain(uploaded.statusCode);
    return id;
  };
  const file = await attach(),
    undone = await attach();
  await createDocument({
    ...fixture,
    nodeId: record,
    content: {
      type: 'rich_text',
      blocks: {
        [file]: { id: file, parentId: record, type: 'file', index: 'a0' },
      },
    },
  });
  const share = async (enabled: boolean) =>
    app.inject({
      method: 'PUT',
      url: `${base}/page-shares/${page}/viewers`,
      headers: ownerHeaders,
      payload: { viewerId: viewer.id, enabled },
    });
  const read = (id: string, offset = 0, headers = guestHeaders) =>
    app.inject({
      url: `${base}/page-shares/${id}/export?offset=${offset}`,
      headers,
    });
  expect((await read(page)).statusCode).toBe(404);
  expect((await share(true)).statusCode).toBe(200);
  const root = await read(page);
  expect(root.statusCode).toBe(200);
  expect(root.headers['cache-control']).toBe('private, no-store');
  expect(
    root
      .json()
      .children.map((entry: { id: string }) => entry.id)
      .sort()
  ).toEqual([child, db].sort());
  expect(root.body).not.toMatch(
    /Unshared folder|Private sibling|collaborators|token/
  );
  expect((await read(child)).statusCode).toBe(200);
  expect((await read(folder)).statusCode).toBe(404);
  expect((await read(sibling)).statusCode).toBe(404);
  expect(
    (await read(page, 0, buildAuthHeader(outsiderDevice.token))).statusCode
  ).toBe(404);
  const first = (await read(db)).json(),
    second = (await read(db, 200)).json();
  expect(first.children).toHaveLength(200);
  expect(first.nextOffset).toBe(200);
  expect(second.children).toHaveLength(1);
  expect(second.nextOffset).toBeNull();
  expect(
    new Set(
      [...first.children, ...second.children].map(
        (entry: { id: string }) => entry.id
      )
    ).size
  ).toBe(201);
  const row = await read(record);
  expect(row.statusCode).toBe(200);
  expect(row.json().content.blocks[file].type).toBe('file');
  expect(row.json().files.map((entry: { id: string }) => entry.id)).toEqual([
    file,
  ]);
  const download = await app.inject({
    url: `${base}/files/${file}`,
    headers: guestHeaders,
  });
  expect(download.statusCode).toBe(200);
  expect(download.rawPayload).toEqual(payload);
  expect(
    (
      await app.inject({
        url: `${base}/files/${undone}`,
        headers: guestHeaders,
      })
    ).statusCode
  ).toBe(403);
  // A shared record's file must not become a bridge to a different workspace.
  const foreignWorkspace = await createWorkspace({ createdBy: owner.id });
  const foreignAdmin = await createUser({
    account: owner,
    workspaceId: foreignWorkspace.id,
    role: 'owner',
  });
  const foreignRoot = await createSpaceNode({
    workspaceId: foreignWorkspace.id,
    userId: foreignAdmin.id,
  });
  const foreignPage = await createPageNode({
    workspaceId: foreignWorkspace.id,
    userId: foreignAdmin.id,
    rootId: foreignRoot,
    parentId: foreignRoot,
  });
  expect((await read(foreignPage, 0, ownerHeaders)).statusCode).toBe(404);
  expect((await read(page, -1)).statusCode).toBe(400);
  expect((await read(page, 0, ownerHeaders)).statusCode).toBe(200);
  await share(false);
  expect((await read(record)).statusCode).toBe(404);
  expect(
    (await app.inject({ url: `${base}/files/${file}`, headers: guestHeaders }))
      .statusCode
  ).toBe(403);
  await share(true);
  await database
    .updateTable('users')
    .set({ status: UserStatus.Removed })
    .where('id', '=', viewer.id)
    .execute();
  expect((await read(page)).statusCode).not.toBe(200);
}, 60000);
