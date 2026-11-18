import { describe, expect, it, vi } from 'vitest';

import { buildPageExport } from '@colanode/ui/lib/page-export';

describe('portable page export', () => {
  it('preserves formatting, tables, nested blocks and checked items, excluding scripts, controls and content outside the page', async () => {
    document.body.innerHTML = `<aside>Private sibling</aside><section id="page" style="background-color:#fff;color:#222"><input aria-label="Page title" value="Duplicate title"><p data-id="one" style="background-color:rgb(12, 34, 56)">日本語 <strong>strong</strong></p><details><summary>Toggle</summary><p>Nested</p></details><table><tr><th>Name</th></tr><tr><td>Visible row</td></tr></table><input type="checkbox" checked><a href="javascript:alert(1)" onclick="alert(2)">Unsafe</a><button>Delete</button><script>alert(3)</script><div data-export-exclude>Saving…</div></section>`;
    const html = await buildPageExport(
      document.getElementById('page')!,
      '<Project>'
    );
    const result = new DOMParser().parseFromString(html, 'text/html');
    expect(result.title).toBe('<Project>');
    expect(result.querySelector('h1')?.textContent).toBe('<Project>');
    expect(result.querySelector('#block-one')?.getAttribute('style')).toContain(
      'rgb(12, 34, 56)'
    );
    expect(result.querySelector('details')?.open).toBe(true);
    expect(result.querySelector('td')?.textContent).toBe('Visible row');
    expect(result.body.textContent).toContain('☑');
    expect(result.querySelector('a')?.hasAttribute('href')).toBe(false);
    expect(result.querySelector('script,button,[onclick],input')).toBeNull();
    expect(result.body.textContent).not.toMatch(
      /Private sibling|Duplicate title|Delete|Saving/
    );
    expect(
      result.querySelector('meta[http-equiv]')?.getAttribute('content')
    ).toContain("default-src 'none'");
  });

  it('embeds already loaded blob images without exposing temporary URLs or fetching other files', async () => {
    const source = document.createElement('div');
    source.innerHTML =
      '<img src="blob:http://localhost/loaded-image" alt="Design"><a href="/private-file">Attachment link</a>';
    const fetch = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        blob: async () => new Blob(['png'], { type: 'image/png' }),
      });
    vi.stubGlobal('fetch', fetch);
    const html = await buildPageExport(source, 'Images');
    const result = new DOMParser().parseFromString(html, 'text/html');
    expect(result.querySelector('img')?.src).toMatch(
      /^data:image\/png;base64,/
    );
    expect(html).not.toContain('blob:');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('blob:http://localhost/loaded-image', {
      credentials: 'same-origin',
    });
    expect(result.querySelector('a')?.href).toContain('/private-file');
  });

  it('reports a failed image instead of silently producing a partial export', async () => {
    const source = document.createElement('div');
    source.innerHTML = '<img src="blob:http://localhost/missing">';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    await expect(buildPageExport(source, 'Missing')).rejects.toThrow(
      'Load the page images'
    );
  });
});
