import { strToU8, zipSync } from 'fflate';

import {
  attachmentFilename,
  attachmentMime,
  attachmentSubtype,
} from '@colanode/ui/lib/notion-attachments';
import {
  exportFilename,
  packageNotionHtml,
} from '@colanode/ui/lib/notion-page-export';

export const packageNotionMediaHtml = async (
  html: string,
  options: {
    resolveFile: (id: string) => Promise<Blob>;
    prefix?: string;
    cache?: Map<string, Promise<Blob>>;
  }
) => {
  const packed = packageNotionHtml(html, options.prefix ?? 'image');
  const page = new DOMParser().parseFromString(packed.html, 'text/html');
  const cache = options.cache ?? new Map<string, Promise<Blob>>();
  const paths = new Map<string, string>();
  const prefix = (options.prefix ?? 'page').replace(/[^a-zA-Z\d_-]/g, '_');
  for (const marker of Array.from(
    page.querySelectorAll<HTMLElement>('[data-export-attachment-id]')
  )) {
    const id = marker.dataset.exportAttachmentId!;
    const name = marker.dataset.exportAttachmentName || 'Attachment';
    const mime = marker.dataset.exportAttachmentMime || attachmentMime(name);
    const subtype =
      marker.dataset.exportAttachmentSubtype || attachmentSubtype(mime);
    let path = paths.get(id);
    if (!path) {
      path = `assets/${prefix}-file-${String(paths.size + 1).padStart(3, '0')}-${attachmentFilename(name, mime)}`;
      paths.set(id, path);
      if (!cache.has(id)) cache.set(id, options.resolveFile(id));
      const blob = await cache.get(id)!;
      packed.files[path] = new Uint8Array(await blob.arrayBuffer());
    }
    const figure = page.createElement('figure');
    const href = path.split('/').map(encodeURIComponent).join('/');
    figure.id = `block-${id}`;
    figure.setAttribute('data-attachment-name', name);
    figure.setAttribute('data-attachment-mime', mime);
    if (subtype === 'image') {
      const image = page.createElement('img');
      image.setAttribute('src', href);
      image.alt = name;
      figure.appendChild(image);
    }
    if (subtype === 'video' || subtype === 'audio') {
      const media = page.createElement(subtype);
      media.controls = true;
      media.preload = 'metadata';
      media.setAttribute('src', href);
      figure.appendChild(media);
    }
    // A relative link preserves PDF/other files and offers a download fallback
    // when Notion's HTML importer does not turn media markup into a block.
    const caption = page.createElement('figcaption'),
      link = page.createElement('a');
    link.setAttribute('href', href);
    link.setAttribute('download', attachmentFilename(name, mime));
    link.textContent = name;
    caption.appendChild(link);
    figure.appendChild(caption);
    marker.replaceWith(figure);
  }
  page
    .querySelector('meta[http-equiv="Content-Security-Policy"]')
    ?.setAttribute(
      'content',
      "default-src 'none'; img-src 'self' file: data:; media-src 'self' file:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"
    );
  return {
    html: '<!doctype html>\n' + page.documentElement.outerHTML,
    files: packed.files,
  };
};

export const buildNotionMediaPageZip = async (
  html: string,
  title: string,
  resolveFile: (id: string) => Promise<Blob>
) => {
  const packed = await packageNotionMediaHtml(html, { resolveFile });
  return zipSync(
    {
      [`notion-export/${exportFilename(title)}.html`]: strToU8(packed.html),
      ...Object.fromEntries(
        Object.entries(packed.files).map(([path, bytes]) => [
          'notion-export/' + path,
          bytes,
        ])
      ),
    },
    { level: 0 }
  );
};
