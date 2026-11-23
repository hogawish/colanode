import { expect, it, vi } from 'vitest';

import type { PageExportSnapshot } from '@colanode/core';

import {
  notionParentId,
  transferToNotion,
} from '../../../server/src/lib/notion-transfer';

const item = (
  id: string,
  kind: PageExportSnapshot['kind'] = 'page'
): PageExportSnapshot => ({
  id,
  name: id,
  kind,
  children: [],
  files: [],
  content: null,
  nextOffset: null,
});
it('creates a real inline database between body blocks, with native rows, row body and uploaded image', async () => {
  const root = item('root'),
    db = item('database', 'database'),
    row = item('row', 'record');
  root.children = [db];
  db.children = [row];
  root.content = {
    type: 'rich_text',
    blocks: {
      before: {
        id: 'before',
        parentId: 'root',
        index: 'a0',
        type: 'paragraph',
        content: [{ type: 'text', text: 'Before' }],
      },
      database: {
        id: 'database',
        parentId: 'root',
        index: 'a1',
        type: 'database',
        attrs: { inline: true },
      },
      after: {
        id: 'after',
        parentId: 'root',
        index: 'a2',
        type: 'paragraph',
        content: [{ type: 'text', text: 'After' }],
      },
    },
  };
  row.files = [
    { id: 'image', name: 'photo.png', subtype: 'image', mimeType: 'image/png' },
  ];
  row.content = {
    type: 'rich_text',
    blocks: {
      p: {
        id: 'p',
        parentId: 'row',
        index: 'a0',
        type: 'paragraph',
        content: [{ type: 'text', text: 'Row body' }],
      },
      image: { id: 'image', parentId: 'row', index: 'a1', type: 'file' },
    },
  };
  const items = new Map([root, db, row].map((node) => [node.id, node]));
  const calls: { url: string; body: unknown; method: string }[] = [];
  let id = 0;
  const api = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    expect(init?.headers).toMatchObject({
      'Notion-Version': '2025-09-03',
      Authorization: 'Bearer test-token',
    });
    expect(init?.redirect).toBe('error');
    const body =
      typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body;
    calls.push({ url: String(url), body, method: init?.method ?? '' });
    const response = {
      id: `n-${++id}`,
      url: 'https://www.notion.so/new',
      results: [{ id: `b-${id}` }],
      data_sources: [{ id: 'source' }],
      status: 'uploaded',
    };
    return new Response(JSON.stringify(response), { status: 200 });
  });
  const result = await transferToNotion({
    token: 'test-token',
    parent: '0123456789abcdef0123456789abcdef',
    rootId: 'root',
    read: async (id) => items.get(id)!,
    image: async () =>
      new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }),
    fetch: api,
    sleep: async () => {},
  });
  expect(result.complete).toBe(true);
  expect(result.pages).toBe(3);
  const dbIndex = calls.findIndex((call) => call.url.endsWith('/databases'));
  expect(calls[dbIndex]!.body).toMatchObject({
    is_inline: true,
    initial_data_source: { properties: { Name: { title: {} } } },
  });
  expect(JSON.stringify(calls.slice(0, dbIndex))).toContain('Before');
  expect(JSON.stringify(calls.slice(dbIndex + 1))).toContain('After');
  expect(
    calls.some((call) => JSON.stringify(call.body).includes('data_source_id'))
  ).toBe(true);
  expect(
    calls.some(
      (call) => call.url.endsWith('/send') && call.body instanceof FormData
    )
  ).toBe(true);
  expect(JSON.stringify(calls)).toContain('file_upload');
  expect(JSON.stringify(result)).not.toContain('test-token');
});
it('makes no outbound request for inaccessible descendants or invalid destination', async () => {
  const api = vi.fn();
  const root = item('root');
  root.children = [item('hidden')];
  const options = {
    token: 'private',
    parent: '0123456789abcdef0123456789abcdef',
    rootId: 'root',
    read: async (id: string) => (id === 'root' ? root : null),
    image: vi.fn(),
    fetch: api,
    sleep: async () => {},
  };
  await expect(transferToNotion(options)).rejects.toThrow('unavailable');
  expect(api).not.toHaveBeenCalled();
  expect(() => notionParentId('https://evil.test/no-id')).toThrow('page URL');
});
it('returns the partial destination and never automatically retries ambiguous writes or exposes upstream error content', async () => {
  const api = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({ id: 'created', url: 'https://www.notion.so/created' })
      )
    )
    .mockResolvedValue(
      new Response('secret echoed by upstream', { status: 503 })
    );
  const root = item('root');
  root.content = {
    type: 'rich_text',
    blocks: {
      p: {
        id: 'p',
        type: 'paragraph',
        parentId: 'root',
        index: 'a0',
        content: [{ type: 'text', text: 'Body' }],
      },
    },
  };
  const result = await transferToNotion({
    token: 'secret',
    parent: '0123456789abcdef0123456789abcdef',
    rootId: 'root',
    read: async () => root,
    image: vi.fn(),
    fetch: api,
    sleep: async () => {},
  });
  expect(result).toMatchObject({
    complete: false,
    url: 'https://www.notion.so/created',
  });
  expect(api).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(result)).not.toContain('secret');
});
