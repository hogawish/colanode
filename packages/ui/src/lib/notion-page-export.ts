import { strToU8, zipSync } from 'fflate';

// Consume the same sanitized snapshot as HTML/PDF. Only referenced body images
// are bundled; this layer never traverses pages, databases, or attachment lists.
export const packageNotionHtml = (html: string, imagePrefix = 'image') => {
  const page = new DOMParser().parseFromString(html, 'text/html');
  const files: Record<string, Uint8Array> = {};
  const images = new Map<string, string>();
  const extensions: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/avif': 'avif',
    'image/bmp': 'bmp',
    'image/svg+xml': 'svg',
    'image/tiff': 'tiff',
    'image/x-icon': 'ico',
  };
  for (const image of Array.from(page.images)) {
    const source = image.getAttribute('src') ?? '';
    let path = images.get(source);
    if (!path) {
      const match =
        /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/]*={0,2})$/i.exec(source);
      const extension = match && extensions[match[1]!.toLowerCase()];
      if (!match || !extension || !match[2])
        throw new Error('A page image could not be packaged for Notion.');
      const bytes = Uint8Array.from(atob(match[2]), (character) =>
        character.charCodeAt(0)
      );
      path = `assets/${imagePrefix}-${String(images.size + 1).padStart(3, '0')}.${extension}`;
      files[path] = bytes;
      images.set(source, path);
    }
    image.setAttribute('src', path);
  }
  const csp = page.querySelector('meta[http-equiv="Content-Security-Policy"]');
  csp?.setAttribute(
    'content',
    "default-src 'none'; img-src 'self' file: data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"
  );
  return { html: '<!doctype html>\n' + page.documentElement.outerHTML, files };
};

export const buildNotionPageZip = (html: string, title: string) => {
  const packed = packageNotionHtml(html);
  const files: Record<string, Uint8Array> = Object.fromEntries(
    Object.entries(packed.files).map(([path, bytes]) => [
      `notion-export/${path}`,
      bytes,
    ])
  );
  files[`notion-export/${exportFilename(title)}.html`] = strToU8(packed.html);
  // Images are already compressed. STORE avoids recompression/worker startup
  // and keeps the ZIP compatible with ordinary readers and Notion's importer.
  return zipSync(files, { level: 0 });
};

export const exportFilename = (title: string) =>
  Array.from(
    Array.from(title, (character) =>
      character.charCodeAt(0) < 32 ? '_' : character
    )
      .join('')
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/[. ]+$/g, '')
      .trim()
  )
    .slice(0, 100)
    .join('') || 'page';

export const downloadNotionPageZip = (html: string, title: string) => {
  downloadNotionZip(buildNotionPageZip(html, title), title);
};

export const downloadNotionZip = (bytes: Uint8Array, title: string) => {
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(bytes).buffer], { type: 'application/zip' })
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = exportFilename(title) + '.notion.zip';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};
