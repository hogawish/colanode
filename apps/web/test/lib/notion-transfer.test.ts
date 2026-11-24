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

it('transfers video/audio/PDF/files as native blocks and completes multipart uploads over 20 MiB in order', async () => {
  const root = item('root');
  const types = ['video', 'audio', 'pdf', 'other'] as const;
  root.files = types.map((subtype, index) => ({
    id: 'f' + index,
    name: ['clip.mp4', 'voice.wav', 'brief.pdf', 'notes.txt'][index]!,
    subtype,
    mimeType: ['video/mp4', 'audio/wav', 'application/pdf', 'text/plain'][
      index
    ]!,
  }));
  root.content = {
    type: 'rich_text',
    blocks: Object.fromEntries(
      root.files.map((file, index) => [
        file.id,
        { id: file.id, type: 'file', parentId: 'root', index: 'a' + index },
      ])
    ),
  };
  const calls: { path: string; body: Record<string, unknown> | FormData }[] =
    [];
  let n = 0;
  const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const body =
      init?.body instanceof FormData
        ? init.body
        : JSON.parse(String(init?.body));
    const path = String(url).replace('https://api.notion.com/v1/', '');
    calls.push({ path, body });
    return new Response(
      JSON.stringify({
        id: 'n' + ++n,
        url: 'https://www.notion.so/test',
        status:
          body instanceof FormData && body.has('part_number')
            ? 'pending'
            : 'uploaded',
        results: [{ id: 'b' + n }],
      })
    );
  });
  const large = new Blob([new Uint8Array(20 * 1024 * 1024 + 7).fill(93)], {
    type: 'video/mp4',
  });
  const result = await transferToNotion({
    token: 'test',
    parent: '0123456789abcdef0123456789abcdef',
    rootId: 'root',
    read: async () => root,
    image: async (file) =>
      file.subtype === 'video'
        ? large
        : new Blob(['data'], { type: file.mimeType }),
    fetch: fetcher,
    sleep: async () => {},
  });
  expect(result.complete).toBe(true);
  const multipart = calls.find((call) => call.path === 'file_uploads')!;
  expect(multipart.body).toMatchObject({
    mode: 'multi_part',
    number_of_parts: 2,
    filename: 'clip.mp4',
  });
  const parts = calls
    .filter(
      (call) => call.body instanceof FormData && call.body.has('part_number')
    )
    .map((call) => call.body as FormData);
  expect(parts.map((part) => part.get('part_number'))).toEqual(['1', '2']);
  expect((parts[0]!.get('file') as Blob).size).toBe(20 * 1024 * 1024);
  expect((parts[1]!.get('file') as Blob).size).toBe(7);
  expect(
    calls.findIndex((call) => call.path.endsWith('/complete'))
  ).toBeGreaterThan(calls.findIndex((call) => call.body === parts[1]));
  const blocks = calls
    .filter((call) => call.path.includes('/children'))
    .map(
      (call) =>
        (call.body as { children: { type: string }[] }).children[0]!.type
    );
  expect(blocks).toEqual(['video', 'audio', 'pdf', 'file']);
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

it.each(['timeout', 'server-error'])(
  'retains the destination without completing or inserting a partial multipart file after %s',
  async (failure) => {
    const root = item('root');
    root.files = [
      {
        id: 'movie',
        name: 'clip.mp4',
        subtype: 'video',
        mimeType: 'video/mp4',
      },
    ];
    root.content = {
      type: 'rich_text',
      blocks: {
        movie: { id: 'movie', type: 'file', parentId: 'root', index: 'a0' },
      },
    };
    const calls: string[] = [];
    const api = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const endpoint = String(url);
      calls.push(endpoint);
      if (
        init?.body instanceof FormData &&
        init.body.get('part_number') === '2'
      ) {
        if (failure === 'timeout')
          throw new DOMException('private transport detail', 'TimeoutError');
        return new Response('private upstream detail', { status: 503 });
      }
      return new Response(
        JSON.stringify({
          id: 'fixture',
          url: 'https://www.notion.so/partial',
          status: 'pending',
        })
      );
    });
    const result = await transferToNotion({
      token: 'private-token',
      parent: '0123456789abcdef0123456789abcdef',
      rootId: 'root',
      read: async () => root,
      image: async () =>
        new Blob([new Uint8Array(20 * 1024 * 1024 + 1)], { type: 'video/mp4' }),
      fetch: api,
      sleep: async () => {},
    });
    expect(result).toMatchObject({
      complete: false,
      url: 'https://www.notion.so/partial',
    });
    expect(calls).toHaveLength(4); // page, upload, first part, failed second part
    expect(
      calls.some(
        (path) => path.endsWith('/complete') || path.endsWith('/children')
      )
    ).toBe(false);
    expect(JSON.stringify(result)).not.toContain('private');
  }
);
