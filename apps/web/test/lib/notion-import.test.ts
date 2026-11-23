import { strToU8, zipSync } from 'fflate';
import { afterEach, expect, it, vi } from 'vitest';

import { buildEditorContent } from '@colanode/client/lib';
import { richTextContentSchema } from '@colanode/core';
import { YDoc } from '@colanode/crdt';
import {
  importNotionPlan,
  parseNotionCsv,
  previewNotionZip,
} from '@colanode/ui/lib/notion-import';

const archive = (files: Record<string, string | Uint8Array>) =>
  zipSync(
    Object.fromEntries(
      Object.entries(files).map(([key, value]) => [
        key,
        typeof value === 'string' ? strToU8(value) : value,
      ])
    )
  );
afterEach(() => vi.unstubAllGlobals());
it('previews hierarchy, quoted multiline CSV, record bodies and exact local images without remote requests', () => {
  const network = vi.fn();
  vi.stubGlobal('fetch', network);
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1]);
  const plan = previewNotionZip(
    archive({
      'Export/Hub.html':
        '<header><h1 class="page-title">Hub</h1></header><div class="page-body"><h2>Before</h2><a href="Hub/Tasks.csv">Tasks</a><p>After</p><script>fetch("https://bad.test")</script><img src="https://bad.test/pixel.png"><p><a href="javascript:alert(1)">Unsafe</a></p></div>',
      'Export/Hub/Child.md':
        '# Child\n\n**Bold**\n\n![Photo](../assets/photo.png)',
      'Export/Hub/Tasks.csv':
        'Name,Comment,Body page\r\n"Row","one, two\nthree","Tasks/Row.html"\r\n',
      'Export/Hub/Tasks/Row.html':
        '<div class="page-body"><p>Record body</p><img src="../../assets/photo.png"></div>',
      'Export/assets/photo.png': bytes,
    })
  );
  expect(plan.items.map((item) => [item.name, item.kind, item.parent])).toEqual(
    [
      ['Hub', 'page', undefined],
      ['Child', 'page', 'Export/Hub.html'],
      ['Row', 'record', 'Export/Hub/Tasks.csv'],
      ['Tasks', 'database', 'Export/Hub.html'],
    ]
  );
  expect(plan.items.find((item) => item.kind === 'record')?.values?.[1]).toBe(
    'one, two\nthree'
  );
  expect(plan.images).toEqual(['Export/assets/photo.png']);
  expect(plan.files['Export/assets/photo.png']).toEqual(bytes);
  const body = JSON.stringify(plan.items[0]?.body);
  expect(body).not.toContain('javascript:');
  expect(body).not.toContain('fetch(');
  expect(network).not.toHaveBeenCalled();
});
it('rejects unsafe paths, duplicates and declared oversized decompression before importing', () => {
  expect(() => previewNotionZip(archive({ '../secret.html': 'bad' }))).toThrow(
    'Unsafe'
  );
  expect(() => previewNotionZip(archive({ 'C:/secret.html': 'bad' }))).toThrow(
    'Unsafe'
  );
  expect(() =>
    previewNotionZip(
      archive({ 'same/é.html': 'one', 'same/e\u0301.html': 'two' })
    )
  ).toThrow('duplicate');
  const bytes = archive({ 'Page.html': '<p>Safe</p>' });
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < bytes.length - 46; index++)
    if (view.getUint32(index, true) === 0x02014b50)
      view.setUint32(index + 24, 300 * 1024 * 1024, true);
  expect(() => previewNotionZip(bytes)).toThrow('expands');
  expect(() => parseNotionCsv('Name\n"broken')).toThrow('unterminated');
});
it('creates fresh native nodes and CRDT documents with rewritten page/image IDs and preserves the existing parent', async () => {
  const plan = previewNotionZip(
    archive({
      'Page.html':
        '<p>Before</p><a href="Page/DB.csv">DB</a><p>After</p><img src="assets/p.png">',
      'Page/DB.csv': 'Name,State\nRow,Ready\n',
      'assets/p.png': new Uint8Array([137, 80, 78, 71]),
    })
  );
  const inputs: Record<string, unknown>[] = [];
  const executeMutation = vi.fn(async (input: Record<string, unknown>) => {
    inputs.push(input);
    return { success: true, output: { id: 'image-new' } };
  });
  Object.defineProperty(window, 'colanode', {
    configurable: true,
    value: {
      executeMutation,
      saveTempFile: vi.fn(async () => ({ id: 'temp-new' })),
    },
  });
  const root = await importNotionPlan(plan, {
    parentId: 'existing',
    workspaceId: 'ws',
    userId: 'user',
  });
  const creates = inputs.filter((input) => input.type === 'node.create');
  expect(creates).toHaveLength(5); // wrapper, page, database, default view, row
  expect(creates.every((input) => input.nodeId !== 'existing')).toBe(true);
  const document = inputs.find((input) => input.type === 'document.update')!;
  const ydoc = new YDoc(document.update as string);
  const content = richTextContentSchema.parse(ydoc.getObject());
  const editor = buildEditorContent(document.documentId as string, content);
  expect(editor.content?.map((node) => node.type)).toEqual([
    'paragraph',
    'database',
    'paragraph',
    'file',
  ]);
  expect(editor.content?.at(-1)?.attrs?.id).toBe('image-new');
  expect(JSON.stringify(content)).not.toContain('importTarget');
  expect(root).not.toBe('existing');
});
it('retains an inspectable partial root on failure and does not automatically delete or overwrite anything', async () => {
  const plan = previewNotionZip(archive({ 'Page.html': '<p>Body</p>' }));
  const onRoot = vi.fn();
  const mutation = vi
    .fn()
    .mockResolvedValueOnce({ success: true, output: {} })
    .mockResolvedValue({ success: false, error: { message: 'No permission' } });
  Object.defineProperty(window, 'colanode', {
    configurable: true,
    value: { executeMutation: mutation },
  });
  await expect(
    importNotionPlan(plan, {
      parentId: 'existing',
      workspaceId: 'ws',
      userId: 'user',
      onRoot,
    })
  ).rejects.toThrow('No permission');
  expect(onRoot).toHaveBeenCalledOnce();
  expect(
    mutation.mock.calls.every(([input]) => input.type === 'node.create')
  ).toBe(true);
});
