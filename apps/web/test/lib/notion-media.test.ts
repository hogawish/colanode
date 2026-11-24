import { strToU8, strFromU8, zipSync, unzipSync } from 'fflate';
import { afterEach, expect, it, vi } from 'vitest';

import { YDoc } from '@colanode/crdt';
import {
  importNotionPlan,
  previewNotionZip,
} from '@colanode/ui/lib/notion-import';
import { buildNotionMediaPageZip } from '@colanode/ui/lib/notion-media-export';

afterEach(() => vi.unstubAllGlobals());
const samples = [
  ['image', 'image/png', 'picture.png'],
  ['video', 'video/mp4', 'clip.mp4'],
  ['audio', 'audio/wav', 'voice.wav'],
  ['pdf', 'application/pdf', 'brief.pdf'],
  ['other', 'text/csv', 'attached.csv'],
  ['other', 'text/markdown', 'attached.md'],
] as const;
it('round-trips mixed media as exact original bytes and native File blocks in body order, excluding unreferenced files', async () => {
  const payloads = new Map(
    samples.map(([_type, mime, name], index) => [
      String(index),
      new Blob([strToU8(`original-${name}`)], { type: mime }),
    ])
  );
  const html =
    '<p>Before</p>' +
    samples
      .map(
        ([subtype, mimeType, name], id) =>
          `<a data-export-attachment-id="${id}" data-export-attachment-name="${name}" data-export-attachment-subtype="${subtype}" data-export-attachment-mime="${mimeType}"></a>`
      )
      .join('') +
    '<p>After</p>';
  const resolveFile = vi.fn(async (id: string) => payloads.get(id)!);
  const bytes = await buildNotionMediaPageZip(html, 'Media', resolveFile);
  const archive = unzipSync(bytes);
  expect(resolveFile).toHaveBeenCalledTimes(samples.length);
  const page = strFromU8(archive['notion-export/Media.html']!);
  expect(page).toContain('<video');
  expect(page).toContain('<audio');
  expect(page).not.toContain('data-export-attachment');
  expect(page).not.toContain('blob:');
  const plan = previewNotionZip(bytes);
  expect(plan.items).toHaveLength(1);
  expect(plan.images).toHaveLength(1);
  expect(plan.attachments.map((file) => file.subtype)).toEqual(
    samples.map(([type]) => type)
  );
  expect(plan.items[0]!.body.map((node) => node.type)).toEqual([
    'paragraph',
    ...samples.map(() => 'file'),
    'paragraph',
  ]);
  for (const file of plan.attachments)
    expect(strFromU8(plan.files[file.path]!)).toBe('original-' + file.name);
  const uploads: File[] = [];
  const mutations: Record<string, unknown>[] = [];
  Object.defineProperty(window, 'colanode', {
    configurable: true,
    value: {
      saveTempFile: async (file: File) => {
        uploads.push(file);
        return { id: 'temp-' + uploads.length };
      },
      executeMutation: async (input: Record<string, unknown>) => {
        mutations.push(input);
        return { success: true, output: { id: 'created-' + mutations.length } };
      },
    },
  });
  await importNotionPlan(plan, {
    userId: 'qa',
    workspaceId: 'workspace',
    parentId: 'destination',
  });
  expect(uploads.map((file) => file.name)).toEqual(
    samples.map(([, , name]) => name)
  );
  expect(uploads.map((file) => file.type)).toEqual(
    samples.map(([, mime]) => mime)
  );
  const document = mutations.find((input) => input.type === 'document.update')!;
  expect(
    JSON.stringify(new YDoc(document.update as string).getObject())
  ).not.toMatch(/importAttachmentPath|data-export/);
});

it('reads Notion-style HTML source/video/audio/file links and Markdown attachments without downloading external files', () => {
  const network = vi.fn();
  vi.stubGlobal('fetch', network);
  const archive = zipSync({
    'Page.html': strToU8(
      '<div class="page-body"><p>Before</p><figure><video><source src="assets/movie.mp4" type="video/mp4"></video><figcaption>A caption</figcaption></figure><audio src="assets/sound.wav"></audio><figure class="file"><a href="assets/file.pdf">PDF</a></figure><object data="assets/file.pdf" type="application/pdf"></object><video src="https://private.test/movie.mp4"></video><p>After</p></div>'
    ),
    'Child.md': strToU8(
      'Before\n\n[Audio](assets/sound.wav)\n\n[File](assets/file.pdf)\n\nAfter'
    ),
    'assets/movie.mp4': strToU8('movie'),
    'assets/sound.wav': strToU8('sound'),
    'assets/file.pdf': strToU8('pdf'),
    'assets/unreferenced.zip': strToU8('unused'),
  });
  const plan = previewNotionZip(archive);
  expect(plan.attachments.map((file) => file.subtype)).toEqual([
    'video',
    'audio',
    'pdf',
  ]);
  expect(
    plan.attachments.some((file) => file.path.includes('unreferenced'))
  ).toBe(false);
  expect(JSON.stringify(plan.items[0]?.body)).toContain('A caption');
  expect(plan.warnings.some((w) => w.includes('external'))).toBe(true);
  expect(network).not.toHaveBeenCalled();
});

it('stops ZIP export on attachment download failure instead of producing a silently partial archive', async () => {
  await expect(
    buildNotionMediaPageZip(
      '<a data-export-attachment-id="denied" data-export-attachment-name="private.mp4" data-export-attachment-mime="video/mp4"></a>',
      'Denied',
      async () => {
        throw Error('Access denied');
      }
    )
  ).rejects.toThrow('Access denied');
});

it('preserves unicode, percent signs and hashes in names without breaking relative media paths', async () => {
  const bytes = await buildNotionMediaPageZip(
    '<a data-export-attachment-id="v" data-export-attachment-name="会議 #1%.mp4" data-export-attachment-mime="video/mp4" data-export-attachment-subtype="video"></a>',
    'Names',
    async () => new Blob(['video'], { type: 'video/mp4' })
  );
  const plan = previewNotionZip(bytes);
  expect(plan.attachments).toHaveLength(1);
  expect(plan.attachments[0]?.name).toBe('会議 #1%.mp4');
  expect(strFromU8(plan.files[plan.attachments[0]!.path]!)).toBe('video');
});
