import { strFromU8, unzipSync } from 'fflate';
import { expect, it, vi } from 'vitest';

import { buildNotionPageZip } from '@colanode/ui/lib/notion-page-export';
import { buildPageExport } from '@colanode/ui/lib/page-export';

it('packages one sanitized page with exact original image bytes and relative image paths', async () => {
  const original = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 5, 255]);
  const source = document.createElement('div');
  source.innerHTML =
    '<p>Before 日本語</p><div data-export-image-id="photo"></div><p>After</p><div data-export-image-id="photo"></div><a href="http://localhost/child">Child page</a>';
  const resolveImage = vi.fn().mockResolvedValue(new Blob([original]));
  const html = await buildPageExport(source, 'ナギ', { resolveImage });
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const files = unzipSync(buildNotionPageZip(html, 'ナギ'));
  expect(Object.keys(files).sort()).toEqual([
    'notion-export/assets/image-001.png',
    'notion-export/ナギ.html',
  ]);
  expect(files['notion-export/assets/image-001.png']).toEqual(original);
  const result = new DOMParser().parseFromString(
    strFromU8(files['notion-export/ナギ.html']!),
    'text/html'
  );
  expect(result.title).toBe('ナギ');
  expect(result.querySelectorAll('img')).toHaveLength(2);
  expect(result.querySelector('img')?.getAttribute('src')).toBe(
    'assets/image-001.png'
  );
  expect(
    result.querySelector('figure')?.previousElementSibling?.textContent
  ).toBe('Before 日本語');
  expect(result.querySelector('figure')?.nextElementSibling?.textContent).toBe(
    'After'
  );
  expect(result.querySelector('a')?.href).toBe('http://localhost/child');
  expect(strFromU8(files['notion-export/ナギ.html']!)).not.toMatch(
    /data:image|blob:|data-export-image|Authorization/
  );
  expect(fetch).not.toHaveBeenCalled();
  expect(resolveImage).toHaveBeenCalledExactlyOnceWith('photo');
});

it('keeps separate images with the same displayed filename and safely names the HTML entry', async () => {
  const source = document.createElement('div');
  source.innerHTML =
    '<div data-export-image-id="a" data-export-image-name="image.png"></div><div data-export-image-id="b" data-export-image-name="image.png"></div>';
  const html = await buildPageExport(source, 'x', {
    resolveImage: async (id) => new Blob([id], { type: 'image/png' }),
  });
  const files = unzipSync(buildNotionPageZip(html, '../a/b:*?.'));
  expect(files['notion-export/assets/image-001.png']).toEqual(
    new Uint8Array([97])
  );
  expect(files['notion-export/assets/image-002.png']).toEqual(
    new Uint8Array([98])
  );
  const names = Object.keys(files);
  expect(names).toHaveLength(3);
  expect(names.every((path) => !path.split('/').includes('..'))).toBe(true);
  expect(names.some((path) => path.endsWith('.html'))).toBe(true);
});

it('reports an unbundled image instead of emitting a ZIP with a broken remote reference', () => {
  expect(() =>
    buildNotionPageZip('<img src="blob:http://localhost/expired">', 'Broken')
  ).toThrow('could not be packaged');
});
