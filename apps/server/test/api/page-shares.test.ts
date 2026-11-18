import { afterAll, expect, it } from 'vitest';

import { IdType, UserStatus, generateId } from '@colanode/core';
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

it('shares a single page and its children and attachments until access is removed', async () => {
  const [owner, reader, other, editorAccount] = await Promise.all([
    createAccount(),
    createAccount(),
    createAccount(),
    createAccount(),
  ]);
  const workspace = await createWorkspace({ createdBy: owner.id });
  const [admin, viewer, , editor] = await Promise.all([
    createUser({ account: owner, workspaceId: workspace.id, role: 'owner' }),
    createUser({ account: reader, workspaceId: workspace.id, role: 'guest' }),
    createUser({ account: other, workspaceId: workspace.id, role: 'admin' }),
    createUser({
      account: editorAccount,
      workspaceId: workspace.id,
      role: 'collaborator',
    }),
  ]);
  const [adminDevice, viewerDevice, outsideDevice, editorDevice] =
    await Promise.all([
      createDevice({ accountId: owner.id }),
      createDevice({ accountId: reader.id }),
      createDevice({ accountId: other.id }),
      createDevice({ accountId: editorAccount.id }),
    ]);
  const adminHeaders = buildAuthHeader(adminDevice.token);
  const viewerHeaders = buildAuthHeader(viewerDevice.token);
  const outsideHeaders = buildAuthHeader(outsideDevice.token);
  const editorHeaders = buildAuthHeader(editorDevice.token);

  const rootId = generateId(IdType.Space);
  expect(
    await createNode({
      nodeId: rootId,
      rootId,
      workspaceId: workspace.id,
      userId: admin.id,
      attributes: {
        type: 'space',
        name: 'Production Space',
        visibility: 'private',
        collaborators: { [admin.id]: 'admin', [editor.id]: 'editor' },
      },
    })
  ).toBe(true);
  const fixture = { workspaceId: workspace.id, userId: admin.id, rootId };
  const pageId = await createPageNode({
    ...fixture,
    parentId: rootId,
    name: 'Shared original',
  });
  const childId = await createPageNode({
    ...fixture,
    parentId: pageId,
    name: 'Child',
  });
  const siblingId = await createPageNode({
    ...fixture,
    parentId: rootId,
    name: 'Private sibling',
  });
  const folderId = generateId(IdType.Folder);
  expect(
    await createNode({
      ...fixture,
      nodeId: folderId,
      attributes: { type: 'folder', name: 'Unshared folder', parentId: pageId },
    })
  ).toBe(true);
  const behindFolder = await createPageNode({ ...fixture, parentId: folderId });
  const foreignWorkspace = await createWorkspace({ createdBy: other.id });
  const foreignMember = await createUser({
    account: other,
    workspaceId: foreignWorkspace.id,
    role: 'owner',
  });
  const foreignRoot = await createSpaceNode({
    workspaceId: foreignWorkspace.id,
    userId: foreignMember.id,
  });
  const foreignPage = await createPageNode({
    workspaceId: foreignWorkspace.id,
    userId: foreignMember.id,
    rootId: foreignRoot,
    parentId: foreignRoot,
  });
  const destinationId = generateId(IdType.Space);
  expect(
    await createNode({
      workspaceId: workspace.id,
      userId: admin.id,
      nodeId: destinationId,
      rootId: destinationId,
      attributes: {
        type: 'space',
        name: 'Partner Space',
        visibility: 'private',
        collaborators: { [admin.id]: 'admin', [viewer.id]: 'viewer' },
        pageReferences: { [pageId]: true, [siblingId]: true },
      },
    })
  ).toBeTruthy();
  const blockId = generateId(IdType.Block);
  const dbId = generateId(IdType.Database);
  const unrelatedDb = generateId(IdType.Database);
  const linkedBlockId = generateId(IdType.Block);
  const sourceViewId = generateId(IdType.DatabaseView);
  const recordId = generateId(IdType.Record);
  const viewId = generateId(IdType.DatabaseView);
  for (const [nodeId, parentId] of [
    [dbId, pageId],
    [unrelatedDb, siblingId],
  ] as const) {
    expect(
      await createNode({
        ...fixture,
        nodeId,
        attributes: {
          type: 'database',
          name: 'Example database',
          parentId,
          fields: {},
        },
      })
    ).toBeTruthy();
  }
  expect(
    await createNode({
      ...fixture,
      nodeId: recordId,
      attributes: {
        type: 'record',
        name: 'Example record',
        parentId: dbId,
        databaseId: dbId,
        fields: {},
      },
    })
  ).toBeTruthy();
  expect(
    await createNode({
      ...fixture,
      nodeId: viewId,
      attributes: {
        type: 'database_view',
        name: 'Default',
        parentId: dbId,
        index: 'a0',
        layout: 'table',
      },
    })
  ).toBeTruthy();
  expect(
    await createNode({
      ...fixture,
      nodeId: sourceViewId,
      attributes: {
        type: 'database_view',
        name: 'Linked view',
        parentId: unrelatedDb,
        index: 'a0',
        layout: 'table',
      },
    })
  ).toBeTruthy();
  await createDocument({
    ...fixture,
    nodeId: pageId,
    content: {
      type: 'rich_text',
      blocks: {
        [blockId]: {
          id: blockId,
          type: 'paragraph',
          parentId: pageId,
          index: 'a0',
          content: [{ type: 'text', text: 'Original body' }],
        },
        [childId]: { id: childId, type: 'page', parentId: pageId, index: 'a1' },
        [siblingId]: {
          id: siblingId,
          type: 'page',
          parentId: pageId,
          index: 'a2',
        },
        [dbId]: {
          id: dbId,
          type: 'database',
          parentId: pageId,
          index: 'a3',
          attrs: { inline: true },
        },
        [unrelatedDb]: {
          id: unrelatedDb,
          type: 'database',
          parentId: pageId,
          index: 'a4',
        },
        [linkedBlockId]: {
          id: linkedBlockId,
          parentId: pageId,
          index: 'a5',
          type: 'database',
          attrs: { sourceDatabaseId: unrelatedDb, sourceViewId },
        },
      },
    },
  });

  const endpoint = `/client/v1/workspaces/${workspace.id}`;
  const payload = Buffer.from('attachment content');
  const addAttachment = async (parentId: string, name: string) => {
    const fileId = await createFileNode({
      ...fixture,
      parentId,
      name,
      size: payload.length,
    });
    const created = await app.inject({
      method: 'POST',
      url: `${endpoint}/files/${fileId}/tus`,
      headers: {
        ...adminHeaders,
        'Tus-Resumable': '1.0.0',
        'Upload-Length': String(payload.length),
      },
    });
    expect([201, 204]).toContain(created.statusCode);
    const location = new URL(created.headers.location!, 'http://localhost');
    const uploaded = await app.inject({
      method: 'PATCH',
      url: location.pathname,
      headers: {
        ...adminHeaders,
        'Tus-Resumable': '1.0.0',
        'Upload-Offset': '0',
        'Content-Type': 'application/offset+octet-stream',
      },
      payload,
    });
    expect([200, 204]).toContain(uploaded.statusCode);
    return fileId;
  };
  const childFile = await addAttachment(childId, 'Child.txt');
  const undoneFile = await addAttachment(childId, 'Undone.txt');
  await createDocument({
    ...fixture,
    nodeId: childId,
    content: {
      type: 'rich_text',
      blocks: {
        [childFile]: {
          id: childFile,
          parentId: childId,
          index: 'a0',
          type: 'file',
        },
      },
    },
  });
  const privateFile = await addAttachment(siblingId, 'Private.txt');

  const url = `${endpoint}/page-shares/${pageId}`;
  const setAccess = (
    headers: Record<string, string>,
    enabled: boolean,
    role?: 'viewer' | 'editor'
  ) =>
    app.inject({
      method: 'PUT',
      url: `${url}/viewers`,
      headers,
      payload: { viewerId: viewer.id, enabled, role },
    });
  const read = (id: string, headers = viewerHeaders) =>
    app.inject({ url: `${endpoint}/page-shares/${id}`, headers });
  const download = (id: string) =>
    app.inject({ url: `${endpoint}/files/${id}`, headers: viewerHeaders });

  const sharedPages = (headers = viewerHeaders) =>
    app.inject({ url: `${endpoint}/page-shares/mine`, headers });
  const references = (headers = viewerHeaders) =>
    app.inject({
      url: `${endpoint}/page-shares/space-references/${destinationId}`,
      headers,
    });
  const managedPages = (headers = adminHeaders) =>
    app.inject({
      url: `${endpoint}/page-shares/by-user/${viewer.id}`,
      headers,
    });
  const readDatabase = (id: string, headers = viewerHeaders) =>
    app.inject({ url: `${url}/databases/${id}`, headers });
  const readLinkedDatabase = (headers = viewerHeaders) =>
    app.inject({ url: `${url}/linked-databases/${linkedBlockId}`, headers });

  expect((await references()).json()).toEqual({ pages: [] });
  expect((await managedPages()).json()).toEqual({ pages: [] });
  expect((await setAccess(adminHeaders, true, 'editor')).statusCode).toBe(404);
  expect((await sharedPages()).json()).toEqual({ pages: [] });
  expect((await references()).json()).toEqual({ pages: [] });
  expect((await references(outsideHeaders)).statusCode).toBe(404);
  expect((await read(pageId)).statusCode).toBe(404);
  expect((await setAccess(viewerHeaders, true)).statusCode).toBe(404);
  expect((await read(pageId, editorHeaders)).statusCode).toBe(200);
  expect((await setAccess(editorHeaders, true)).statusCode).toBe(404);
  expect((await read(foreignPage)).statusCode).toBe(404);
  expect(
    (
      await app.inject({
        method: 'PUT',
        url: `${url}/viewers`,
        headers: adminHeaders,
        payload: { viewerId: foreignMember.id, enabled: true },
      })
    ).statusCode
  ).toBe(404);
  expect((await setAccess(adminHeaders, true)).statusCode).toBe(200);
  const visibleReferences = await references();
  expect(visibleReferences.headers['cache-control']).toBe('private, no-store');
  expect(visibleReferences.json()).toEqual({
    pages: [{ id: pageId, name: 'Shared original' }],
  });
  expect((await managedPages()).json()).toEqual({
    pages: [
      {
        id: pageId,
        name: 'Shared original',
        role: 'viewer',
        location: { spaceName: 'Production Space', ancestorNames: [] },
      },
    ],
  });
  expect((await managedPages()).headers['cache-control']).toBe(
    'private, no-store'
  );
  expect((await managedPages(viewerHeaders)).statusCode).toBe(404);
  expect((await managedPages(outsideHeaders)).json()).toEqual({ pages: [] });
  expect((await setAccess(adminHeaders, true, 'editor')).statusCode).toBe(200);
  expect((await managedPages()).json().pages[0].role).toBe('editor');
  expect((await read(childId)).json().canEdit).toBe(true);
  expect((await setAccess(adminHeaders, true, 'viewer')).statusCode).toBe(200);
  expect((await read(childId)).json().canEdit).toBe(false);
  const list = await sharedPages();
  expect(list.headers['cache-control']).toBe('private, no-store');
  expect(list.json()).toEqual({
    pages: [{ id: pageId, name: 'Shared original' }],
  });
  expect((await sharedPages(outsideHeaders)).json()).toEqual({ pages: [] });
  expect(
    (await app.inject({ url: `${url}/viewers`, headers: adminHeaders })).json()
  ).toMatchObject({ viewers: [{ id: viewer.id }] });
  expect(
    (await app.inject({ url: `${url}/viewers`, headers: viewerHeaders }))
      .statusCode
  ).toBe(404);

  const shared = await read(pageId);
  expect(shared.statusCode).toBe(200);
  expect(shared.headers['cache-control']).toBe('private, no-store');
  expect(shared.json()).toMatchObject({
    name: 'Shared original',
    canEdit: false,
    location: { spaceName: null, ancestorNames: [] },
    pages: [{ id: childId, name: 'Child' }],
    pagePlacements: [{ id: childId, parentId: pageId, index: 'a1' }],
    databases: [{ id: dbId, name: 'Example database' }],
    databasePlacements: [
      { id: dbId, parentId: pageId, index: 'a3', inline: true },
    ],
    content: {
      blocks: { [blockId]: { content: [{ text: 'Original body' }] } },
    },
  });
  expect(shared.json().content.blocks).not.toHaveProperty(childId);
  expect(shared.json().content.blocks).not.toHaveProperty(siblingId);
  expect(shared.json().content.blocks).not.toHaveProperty(dbId);
  expect(shared.json().linkedDatabasePlacements).toEqual([
    { id: linkedBlockId, parentId: pageId, index: 'a5' },
  ]);
  expect(shared.json().content.blocks).not.toHaveProperty(linkedBlockId);
  expect(
    (
      await app.inject({
        url: `${url}/linked-databases/${blockId}`,
        headers: viewerHeaders,
      })
    ).statusCode
  ).toBe(404);
  const sharedDatabase = await readDatabase(dbId);
  expect(sharedDatabase.statusCode).toBe(200);
  expect(sharedDatabase.headers['cache-control']).toBe('private, no-store');
  expect(sharedDatabase.json()).toMatchObject({
    database: { id: dbId },
    nodes: expect.arrayContaining([
      expect.objectContaining({ id: recordId, name: 'Example record' }),
      expect.objectContaining({ id: viewId, layout: 'table' }),
    ]),
  });
  expect((await readDatabase(dbId, outsideHeaders)).statusCode).toBe(404);
  expect((await readDatabase(unrelatedDb)).statusCode).toBe(404);
  expect((await readLinkedDatabase()).statusCode).toBe(404);
  const setSourceAccess = (enabled: boolean) =>
    app.inject({
      method: 'PUT',
      url: `${endpoint}/page-shares/${siblingId}/viewers`,
      headers: adminHeaders,
      payload: { viewerId: viewer.id, enabled },
    });
  expect((await setSourceAccess(true)).statusCode).toBe(200);
  const linkedDatabase = await readLinkedDatabase();
  expect(linkedDatabase.statusCode).toBe(200);
  expect(linkedDatabase.headers['cache-control']).toBe('private, no-store');
  expect(linkedDatabase.json()).toMatchObject({
    database: { id: unrelatedDb },
    initialViewId: sourceViewId,
    nodes: [{ id: sourceViewId, name: 'Linked view' }],
  });
  expect((await readLinkedDatabase(editorHeaders)).statusCode).toBe(200);
  expect((await setAccess(adminHeaders, false)).statusCode).toBe(200);
  expect((await readLinkedDatabase()).statusCode).toBe(404);
  expect((await setAccess(adminHeaders, true)).statusCode).toBe(200);
  expect((await readLinkedDatabase(outsideHeaders)).statusCode).toBe(404);
  expect((await setSourceAccess(false)).statusCode).toBe(200);
  expect((await readLinkedDatabase()).statusCode).toBe(404);
  const sharedChild = (await read(childId)).json();
  expect(sharedChild.location).toEqual({
    spaceName: null,
    ancestorNames: ['Shared original'],
  });
  expect(sharedChild.files).toEqual([
    {
      id: childFile,
      name: 'Child.txt',
      mimeType: 'text/plain',
      subtype: 'other',
    },
  ]);
  expect(sharedChild.filePlacements).toEqual([
    { id: childFile, parentId: childId, index: 'a0' },
  ]);
  expect(sharedChild.content.blocks).not.toHaveProperty(childFile);
  expect((await read(pageId, outsideHeaders)).statusCode).toBe(404);
  expect((await read(siblingId)).statusCode).toBe(404);
  expect((await read(behindFolder)).statusCode).toBe(404);
  const addedChild = await createPageNode({ ...fixture, parentId: pageId });
  expect((await read(addedChild)).statusCode).toBe(200);
  const withUnplacedChild = (await read(pageId)).json();
  expect(withUnplacedChild.pages).toContainEqual(
    expect.objectContaining({ id: addedChild })
  );
  expect(withUnplacedChild.pagePlacements).toEqual([
    { id: childId, parentId: pageId, index: 'a1' },
  ]);
  const file = await download(childFile);
  expect(file.statusCode).toBe(200);
  expect(file.body).toBe(payload.toString());
  expect(file.headers['cache-control']).toBe('private, no-store');
  expect((await download(undoneFile)).statusCode).toBe(403);
  expect(
    (
      await app.inject({
        url: `${endpoint}/files/${undoneFile}`,
        headers: adminHeaders,
      })
    ).statusCode
  ).toBe(200);
  expect((await download(privateFile)).statusCode).toBe(403);

  await database
    .updateTable('users')
    .set({ status: UserStatus.Removed })
    .where('id', '=', viewer.id)
    .execute();
  expect((await read(pageId)).statusCode).toBe(403);
  expect((await download(childFile)).statusCode).toBe(403);
  await database
    .updateTable('users')
    .set({ status: UserStatus.Active })
    .where('id', '=', viewer.id)
    .execute();
  expect((await read(pageId)).statusCode).toBe(200);

  expect((await setAccess(adminHeaders, false)).statusCode).toBe(200);
  expect((await sharedPages()).json()).toEqual({ pages: [] });
  expect((await read(pageId)).statusCode).toBe(404);
  expect((await read(childId)).statusCode).toBe(404);
  expect(
    (
      await app.inject({
        method: 'PUT',
        url: endpoint + '/page-shares/' + childId + '/viewers',
        headers: adminHeaders,
        payload: { viewerId: viewer.id, enabled: true },
      })
    ).statusCode
  ).toBe(200);
  expect((await read(childId)).json().location).toEqual({
    spaceName: null,
    ancestorNames: [],
  });
  expect((await read(pageId)).statusCode).toBe(404);
  expect(
    (
      await app.inject({
        method: 'PUT',
        url: endpoint + '/page-shares/' + childId + '/viewers',
        headers: adminHeaders,
        payload: { viewerId: viewer.id, enabled: false },
      })
    ).statusCode
  ).toBe(200);
  expect((await readDatabase(dbId)).statusCode).toBe(404);
  expect((await download(childFile)).statusCode).toBe(403);
  expect((await read(pageId, adminHeaders)).statusCode).toBe(200);
});

it('invites a new guest and edits the original body only for a page editor', async () => {
  const [owner, recipient, other] = await Promise.all([
    createAccount(),
    createAccount(),
    createAccount(),
  ]);
  const workspace = await createWorkspace({ createdBy: owner.id });
  const admin = await createUser({
    account: owner,
    workspaceId: workspace.id,
    role: 'owner',
  });
  const [adminDevice, recipientDevice, otherDevice] = await Promise.all([
    createDevice({ accountId: owner.id }),
    createDevice({ accountId: recipient.id }),
    createDevice({ accountId: other.id }),
  ]);
  const adminHeaders = buildAuthHeader(adminDevice.token);
  const recipientHeaders = buildAuthHeader(recipientDevice.token);
  const otherHeaders = buildAuthHeader(otherDevice.token);
  const rootId = await createSpaceNode({
    workspaceId: workspace.id,
    userId: admin.id,
  });
  const fixture = { workspaceId: workspace.id, userId: admin.id, rootId };
  const pageId = await createPageNode({ ...fixture, parentId: rootId });
  const siblingId = await createPageNode({ ...fixture, parentId: rootId });
  const childId = await createPageNode({ ...fixture, parentId: pageId });
  const blockId = generateId(IdType.Block);
  const content = {
    type: 'rich_text' as const,
    blocks: {
      [blockId]: {
        id: blockId,
        parentId: pageId,
        type: 'paragraph',
        index: 'a0',
        content: [{ type: 'text', text: 'Before' }],
      },
      [childId]: { id: childId, parentId: pageId, type: 'page', index: 'a1' },
    },
  };
  expect(
    await createDocument({ ...fixture, nodeId: pageId, content })
  ).not.toBeNull();
  const endpoint = `/client/v1/workspaces/${workspace.id}/page-shares`;
  const url = `${endpoint}/${pageId}`;
  const invite = (role: 'viewer' | 'editor') =>
    app.inject({
      method: 'POST',
      url: `${url}/invitations`,
      headers: adminHeaders,
      payload: { email: recipient.email.toUpperCase(), role },
    });
  const claim = (headers: Record<string, string>, token: string) =>
    app.inject({
      method: 'POST',
      url: '/client/v1/workspaces/page-invitations/accept',
      headers,
      payload: { token },
    });
  const read = (id = pageId) =>
    app.inject({ url: `${endpoint}/${id}`, headers: recipientHeaders });
  const edit = (revision: string, text: string) =>
    app.inject({
      method: 'PUT',
      url,
      headers: recipientHeaders,
      payload: {
        revision,
        content: {
          ...content,
          blocks: {
            [blockId]: {
              ...content.blocks[blockId],
              content: [{ type: 'text', text }],
            },
          },
        },
      },
    });

  const invitation = await invite('editor');
  expect(invitation.statusCode).toBe(200);
  const { token } = invitation.json<{ token: string }>();
  expect((await claim(otherHeaders, token)).statusCode).toBe(404);
  expect((await claim(recipientHeaders, token)).json()).toEqual({
    pageId,
    workspaceId: workspace.id,
  });
  expect((await claim(recipientHeaders, token)).statusCode).toBe(404);
  expect((await read(siblingId)).statusCode).toBe(404);
  expect((await read(childId)).json()).toMatchObject({ canEdit: true });
  expect((await read('mine')).json()).toEqual({
    pages: [{ id: pageId, name: 'Test Page' }],
  });

  const initial = (await read()).json();
  expect(initial.content.blocks[blockId].content[0].text).toBe('Before');
  expect(initial.canEdit).toBe(true);
  expect(initial.content.blocks[childId]).toBeUndefined();
  const firstSave = await edit(initial.revision, 'First draft');
  expect(firstSave.statusCode).toBe(200);
  expect(
    (await edit(firstSave.json().revision, 'Edited by guest')).statusCode
  ).toBe(200);
  expect((await edit(initial.revision, 'Stale save')).statusCode).toBe(409);
  expect((await read()).json().content.blocks[blockId].content[0].text).toBe(
    'Edited by guest'
  );
  const stored = await database
    .selectFrom('documents')
    .select('content')
    .where('id', '=', pageId)
    .executeTakeFirstOrThrow();
  expect(stored.content).toMatchObject({
    blocks: {
      [childId]: { type: 'page' },
      [blockId]: { content: [{ text: 'Edited by guest' }] },
    },
  });
  const member = await database
    .selectFrom('users')
    .select(['id', 'role'])
    .where('account_id', '=', recipient.id)
    .where('workspace_id', '=', workspace.id)
    .executeTakeFirstOrThrow();
  expect(member.role).toBe('guest');
  expect(
    await database
      .selectFrom('collaborations')
      .select('collaborator_id')
      .where('collaborator_id', '=', member.id)
      .execute()
  ).toEqual([]);

  const setChildShare = (enabled: boolean) =>
    app.inject({
      method: 'PUT',
      url: `${endpoint}/${childId}/viewers`,
      headers: adminHeaders,
      payload: { viewerId: member.id, enabled },
    });
  const readSharedRoots = () =>
    app.inject({ url: `${endpoint}/mine`, headers: recipientHeaders });
  expect((await setChildShare(true)).statusCode).toBe(200);
  expect(
    (await readSharedRoots()).json().pages.map(({ id }: { id: string }) => id)
  ).toEqual([pageId]);
  expect((await setChildShare(false)).statusCode).toBe(200);

  expect((await invite('viewer')).json()).toEqual({ type: 'shared' });
  expect((await read()).json()).toMatchObject({ canEdit: false });
  expect(
    (await edit((await read()).json().revision, 'Not allowed')).statusCode
  ).toBe(403);
});

it('keeps page grants and Space reference lookups inside their Workspace', async () => {
  const owner = await createAccount();
  const reader = await createAccount();
  const first = await createWorkspace({ createdBy: owner.id });
  const second = await createWorkspace({ createdBy: owner.id });
  const [admin, viewer, otherMember] = await Promise.all([
    createUser({ account: owner, workspaceId: first.id, role: 'owner' }),
    createUser({ account: reader, workspaceId: first.id, role: 'guest' }),
    createUser({ account: reader, workspaceId: second.id, role: 'owner' }),
  ]);
  const device = await createDevice({ accountId: reader.id });
  const headers = buildAuthHeader(device.token);
  const rootId = await createSpaceNode({
    workspaceId: first.id,
    userId: admin.id,
  });
  const pageId = await createPageNode({
    workspaceId: first.id,
    userId: admin.id,
    rootId,
    parentId: rootId,
  });
  const otherRootId = await createSpaceNode({
    workspaceId: second.id,
    userId: otherMember.id,
  });
  await database
    .insertInto('page_shares')
    .values({ page_id: pageId, viewer_id: viewer.id, role: 'viewer' })
    .execute();
  const own = `/client/v1/workspaces/${first.id}/page-shares`;
  const other = `/client/v1/workspaces/${second.id}/page-shares`;
  expect(
    (await app.inject({ url: `${own}/${pageId}`, headers })).statusCode
  ).toBe(200);
  expect(
    (await app.inject({ url: `${other}/${pageId}`, headers })).statusCode
  ).toBe(404);
  expect(
    (
      await app.inject({
        url: `${own}/space-references/${otherRootId}`,
        headers,
      })
    ).statusCode
  ).toBe(404);
  expect(
    (
      await app.inject({
        method: 'PUT',
        url: `${other}/${pageId}/viewers`,
        headers,
        payload: { viewerId: otherMember.id, enabled: true, role: 'editor' },
      })
    ).statusCode
  ).toBe(404);
  expect((await app.inject({ url: `${other}/mine`, headers })).json()).toEqual({
    pages: [],
  });
});
