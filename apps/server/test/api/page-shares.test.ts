import { afterAll, expect, it } from 'vitest';

import { IdType, generateId } from '@colanode/core';
import { database } from '@colanode/server/data/database';
import { createDocument } from '@colanode/server/lib/documents';

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
  const [owner, reader, other] = await Promise.all([
    createAccount(),
    createAccount(),
    createAccount(),
  ]);
  const workspace = await createWorkspace({ createdBy: owner.id });
  const [admin, viewer] = await Promise.all([
    createUser({ account: owner, workspaceId: workspace.id, role: 'owner' }),
    createUser({ account: reader, workspaceId: workspace.id, role: 'guest' }),
    createUser({ account: other, workspaceId: workspace.id, role: 'guest' }),
  ]);
  const [adminDevice, viewerDevice, outsideDevice] = await Promise.all([
    createDevice({ accountId: owner.id }),
    createDevice({ accountId: reader.id }),
    createDevice({ accountId: other.id }),
  ]);
  const adminHeaders = buildAuthHeader(adminDevice.token);
  const viewerHeaders = buildAuthHeader(viewerDevice.token);
  const outsideHeaders = buildAuthHeader(outsideDevice.token);

  const rootId = await createSpaceNode({
    workspaceId: workspace.id,
    userId: admin.id,
  });
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
  const blockId = generateId(IdType.Block);
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
  const privateFile = await addAttachment(siblingId, 'Private.txt');

  const url = `${endpoint}/page-shares/${pageId}`;
  const setAccess = (headers: Record<string, string>, enabled: boolean) =>
    app.inject({
      method: 'PUT',
      url: `${url}/viewers`,
      headers,
      payload: { viewerId: viewer.id, enabled },
    });
  const read = (id: string, headers = viewerHeaders) =>
    app.inject({ url: `${endpoint}/page-shares/${id}`, headers });
  const download = (id: string) =>
    app.inject({ url: `${endpoint}/files/${id}`, headers: viewerHeaders });
  const sharedPages = (headers = viewerHeaders) =>
    app.inject({ url: `${endpoint}/page-shares/mine`, headers });

  expect((await sharedPages()).json()).toEqual({ pages: [] });
  expect((await read(pageId)).statusCode).toBe(404);
  expect((await setAccess(viewerHeaders, true)).statusCode).toBe(404);
  expect((await setAccess(adminHeaders, true)).statusCode).toBe(200);
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
    pages: [{ id: childId, name: 'Child' }],
    pagePlacements: [{ id: childId, parentId: pageId, index: 'a1' }],
    content: {
      blocks: { [blockId]: { content: [{ text: 'Original body' }] } },
    },
  });
  expect(shared.json().content.blocks).not.toHaveProperty(childId);
  expect(shared.json().content.blocks).not.toHaveProperty(siblingId);
  expect((await read(childId)).json()).toMatchObject({
    files: [{ id: childFile, name: 'Child.txt' }],
  });
  expect((await read(pageId, outsideHeaders)).statusCode).toBe(404);
  expect((await read(siblingId)).statusCode).toBe(404);
  const file = await download(childFile);
  expect(file.statusCode).toBe(200);
  expect(file.body).toBe(payload.toString());
  expect(file.headers['cache-control']).toBe('private, no-store');
  expect((await download(privateFile)).statusCode).toBe(403);

  expect((await setAccess(adminHeaders, false)).statusCode).toBe(200);
  expect((await sharedPages()).json()).toEqual({ pages: [] });
  expect((await read(pageId)).statusCode).toBe(404);
  expect((await read(childId)).statusCode).toBe(404);
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

  const initial = (await read()).json();
  expect(initial.canEdit).toBe(true);
  expect(initial.content.blocks[childId]).toBeUndefined();
  expect((await edit(initial.revision, 'Edited by guest')).statusCode).toBe(
    200
  );
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
    .select('role')
    .where('account_id', '=', recipient.id)
    .where('workspace_id', '=', workspace.id)
    .executeTakeFirstOrThrow();
  expect(member.role).toBe('guest');

  expect((await invite('viewer')).json()).toEqual({ type: 'shared' });
  expect((await read()).json()).toMatchObject({ canEdit: false });
  expect(
    (await edit((await read()).json().revision, 'Not allowed')).statusCode
  ).toBe(403);
});
