import { strFromU8, unzipSync } from 'fflate';
import { expect, it, vi } from 'vitest';

import type { PageExportSnapshot, RichTextContent } from '@colanode/core';
import { buildNotionTreeZip } from '@colanode/ui/lib/notion-tree-export';

const item = (
  id: string,
  kind: PageExportSnapshot['kind'] = 'page'
): PageExportSnapshot => ({
  id,
  name: '同名',
  kind,
  content: null,
  children: [],
  files: [],
  nextOffset: null,
});
const body = (id: string, text: string): RichTextContent => ({
  type: 'rich_text' as const,
  blocks: {
    [`${id}-text`]: {
      id: `${id}-text`,
      parentId: id,
      type: 'paragraph',
      index: 'a0',
      content: [{ type: 'text', text }],
    },
  },
});
const url = (id: string) => `http://localhost/workspace/${id}`;

it('exports the real hierarchy, all paginated database records, body images and rewritten links without filename collisions', async () => {
  const root = item('root'),
    child = item('child'),
    grandchild = item('grandchild'),
    db = item('db', 'database');
  root.children = [child, db];
  child.children = [grandchild];
  root.content = body('root', 'Root text');
  root.content.blocks['root-text']!.content = [
    {
      type: 'text',
      text: 'To grandchild',
      marks: [
        { type: 'link', attrs: { href: url('grandchild') + '#block=target' } },
      ],
    },
  ];
  grandchild.content = body('grandchild', 'Nested 日本語');
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 5, 255]);
  grandchild.files = [
    { id: 'photo', name: 'image.png', subtype: 'image', mimeType: 'image/png' },
  ];
  grandchild.content.blocks.photo = {
    id: 'photo',
    type: 'file',
    parentId: 'grandchild',
    index: 'a1',
  };
  db.fields = {
    status: {
      id: 'status',
      name: 'Status',
      type: 'select',
      index: 'a0',
      options: {
        done: { id: 'done', name: 'Done', color: 'green', index: 'a0' },
      },
    },
  };
  const records = Array.from({ length: 201 }, (_, i) => {
    const record = item(`r${String(i).padStart(3, '0')}`, 'record');
    record.values = { status: { type: 'string', value: 'done' } };
    record.content = body(record.id, 'Text, "quoted"\nline ' + i);
    return record;
  });
  db.children = records.slice(0, 200);
  db.nextOffset = 200;
  const items = new Map(
    [root, child, grandchild, db, ...records].map((entry) => [entry.id, entry])
  );
  const read = vi.fn(async (id: string, offset: number) =>
    offset === 200
      ? { ...db, children: records.slice(200), nextOffset: null }
      : items.get(id)!
  );
  const resolveImage = vi.fn().mockResolvedValue(new Blob([png]));
  const result = await buildNotionTreeZip('root', {
    read,
    resolveImage,
    sourceUrl: url,
  });
  const files = unzipSync(result.bytes),
    names = Object.keys(files);
  expect(result.count).toBe(205);
  expect(read).toHaveBeenCalledWith('db', 200);
  expect(names.filter((name) => name.endsWith('.html'))).toHaveLength(204);
  expect(names.filter((name) => name.endsWith('.csv'))).toHaveLength(1);
  const grandchildPath = result.paths.get('grandchild')!;
  expect(grandchildPath).toBe('notion-export/同名/同名/同名.html');
  const rootHtml = strFromU8(files[result.paths.get('root')!]!);
  const parsed = new DOMParser().parseFromString(rootHtml, 'text/html');
  const link = parsed.querySelector('a')!.getAttribute('href')!;
  expect(decodeURIComponent(link)).toBe('同名/同名/同名.html#block-target');
  const csvPath = result.paths.get('db')!;
  const csv = strFromU8(files[csvPath]!);
  expect(csv).toContain('"Status","Body","Body page"');
  expect(csv).toContain('"Done"');
  expect(csv).toContain('Text, ""quoted""\nline 200');
  expect(csv).toContain(encodeURIComponent('同名 (201).html'));
  const imagePath = names.find((name) => name.endsWith('.png'))!;
  expect(files[imagePath]).toEqual(png);
  expect(resolveImage).toHaveBeenCalledExactlyOnceWith('photo');
  const grandchildHtml = new DOMParser().parseFromString(
    strFromU8(files[grandchildPath]!),
    'text/html'
  );
  expect(grandchildHtml.querySelector('img')?.getAttribute('src')).toBe(
    'assets/grandchild-001.png'
  );
  expect(names.every((name) => !name.split('/').includes('..'))).toBe(true);
}, 20000);

it('fails before producing a partial archive if a child becomes inaccessible, and never fetches its images', async () => {
  const root = item('root');
  root.children = [item('removed')];
  const resolveImage = vi.fn();
  await expect(
    buildNotionTreeZip('root', {
      read: async (id) => {
        if (id === 'removed') throw new Error('Access removed');
        return root;
      },
      resolveImage,
      sourceUrl: url,
    })
  ).rejects.toThrow('Access removed');
  expect(resolveImage).not.toHaveBeenCalled();
});

it('rejects stuck pagination instead of silently repeating or truncating records', async () => {
  const root = item('root');
  root.nextOffset = 200;
  await expect(
    buildNotionTreeZip('root', {
      read: async () => root,
      resolveImage: vi.fn(),
      sourceUrl: url,
    })
  ).rejects.toThrow('pagination');
});

it('does not follow outside linked databases or cycles, and preserves safe formatting and row text', async () => {
  const root = item('root');
  root.children = [root];
  root.content = {
    type: 'rich_text',
    blocks: {
      a: {
        id: 'a',
        type: 'paragraph',
        parentId: 'root',
        index: 'a0',
        attrs: { blockBackground: 'yellow' },
        content: [
          {
            type: 'text',
            text: '<safe>',
            marks: [
              { type: 'bold' },
              { type: 'link', attrs: { href: 'javascript:alert(1)' } },
            ],
          },
        ],
      },
      b: {
        id: 'b',
        type: 'database',
        parentId: 'root',
        index: 'a1',
        attrs: { sourceDatabaseId: 'private-db' },
      },
    },
  };
  const read = vi.fn(async () => root);
  const result = await buildNotionTreeZip('root', {
    read,
    resolveImage: vi.fn(),
    sourceUrl: url,
  });
  expect(read).toHaveBeenCalledOnce();
  const files = unzipSync(result.bytes);
  const html = strFromU8(files[Object.keys(files)[0]!]!);
  expect(html).not.toContain('javascript:');
  expect(html).toContain('&lt;safe&gt;');
  expect(html).toContain('<strong');
  expect(html).toContain('http://localhost/workspace/private-db');
  expect(html).toContain('background-color:');
});

it('bundles direct external image previews while keeping Drive embeds as source links', async () => {
  const root = item('root');
  root.content = {
    type: 'rich_text',
    blocks: {
      image: {
        id: 'image',
        type: 'paragraph',
        parentId: 'root',
        index: 'a0',
        attrs: {
          externalRef: {
            version: 1,
            provider: 'direct-image',
            sourceUrl: 'https://example.com/picture.png',
          },
        },
      },
      drive: {
        id: 'drive',
        type: 'paragraph',
        parentId: 'root',
        index: 'a1',
        attrs: {
          externalRef: {
            version: 1,
            provider: 'drive',
            sourceUrl: 'https://drive.google.com/file/d/example/view',
            fileId: 'example',
          },
        },
      },
    },
  };
  const fetch = vi.fn().mockResolvedValue({
    ok: true,
    blob: async () => new Blob(['png'], { type: 'image/png' }),
  });
  vi.stubGlobal('fetch', fetch);
  const result = await buildNotionTreeZip('root', {
    read: async () => root,
    resolveImage: vi.fn(),
    sourceUrl: url,
  });
  const files = unzipSync(result.bytes);
  expect(Object.keys(files).some((name) => name.endsWith('.png'))).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledWith(
    'https://example.com/picture.png',
    expect.anything()
  );
  expect(
    strFromU8(
      files[Object.keys(files).find((name) => name.endsWith('.html'))!]!
    )
  ).toContain('https://drive.google.com/file/d/example/view');
});
