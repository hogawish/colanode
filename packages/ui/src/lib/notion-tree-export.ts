import { strToU8, zipSync } from 'fflate';

import type { FieldAttributes, PageExportSnapshot } from '@colanode/core';
import {
  exportBodyText,
  renderNotionExportDocument,
} from '@colanode/ui/lib/notion-export-document';
import {
  exportFilename,
  packageNotionHtml,
} from '@colanode/ui/lib/notion-page-export';
import { buildPageExport } from '@colanode/ui/lib/page-export';

const dirname = (path: string) => path.slice(0, path.lastIndexOf('/') + 1);
const relative = (from: string, to: string) => {
  const base = dirname(from).split('/').filter(Boolean),
    target = to.split('/');
  while (base.length && target.length && base[0] === target[0]) {
    base.shift();
    target.shift();
  }
  return '../'.repeat(base.length) + target.map(encodeURIComponent).join('/');
};
const valueText = (
  record: PageExportSnapshot,
  field: FieldAttributes,
  items: ReadonlyMap<string, PageExportSnapshot>
) => {
  const metadataKey = (
    {
      created_at: 'createdAt',
      updated_at: 'updatedAt',
      created_by: 'createdBy',
      updated_by: 'updatedBy',
    } as const
  )[field.type as 'created_at'];
  if (metadataKey) return record.metadata?.[metadataKey] ?? '';
  const value = record.values?.[field.id]?.value;
  const single = (entry: string | number | boolean) => {
    if (
      (field.type === 'select' || field.type === 'multi_select') &&
      typeof entry === 'string'
    )
      return field.options?.[entry]?.name ?? entry;
    if (field.type === 'relation' && typeof entry === 'string')
      return items.get(entry)?.name ?? entry;
    return String(entry);
  };
  return value === undefined
    ? ''
    : Array.isArray(value)
      ? value.map(single).join(', ')
      : single(value);
};
const csv = (rows: string[][]) =>
  rows
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\r\n') + '\r\n';

export const buildNotionTreeZip = async (
  rootId: string,
  options: {
    read: (id: string, offset: number) => Promise<PageExportSnapshot>;
    resolveImage: (id: string) => Promise<Blob>;
    sourceUrl: (id: string) => string;
    onProgress?: (count: number) => void;
  }
) => {
  const items = new Map<string, PageExportSnapshot>();
  const parents = new Map<string, string>();
  const pending = [rootId];
  for (let position = 0; position < pending.length; position++) {
    const id = pending[position]!;
    if (items.has(id)) continue;
    const item = await options.read(id, 0);
    if (item.id !== id)
      throw new Error(
        'Export returned a different page. Please reload and try again.'
      );
    let offset = item.nextOffset;
    const children = [...item.children];
    while (offset !== null) {
      const page = await options.read(id, offset);
      if (
        page.id !== id ||
        (page.nextOffset !== null && page.nextOffset <= offset)
      )
        throw new Error('Export pagination could not be completed.');
      children.push(...page.children);
      offset = page.nextOffset;
    }
    item.children = [
      ...new Map(children.map((child) => [child.id, child])).values(),
    ];
    items.set(id, item);
    for (const child of item.children) {
      if (child.id === rootId || parents.has(child.id)) continue;
      parents.set(child.id, id);
      pending.push(child.id);
    }
    options.onProgress?.(items.size);
  }
  const paths = new Map<string, string>();
  const usedNames = new Map<string, Set<string>>();
  for (const [id, item] of items) {
    const parentPath = paths.get(parents.get(id) ?? '');
    const folder = parentPath
      ? parentPath.replace(/\.(html|csv)$/, '') + '/'
      : 'notion-export/';
    const used = usedNames.get(folder) ?? new Set<string>();
    usedNames.set(folder, used);
    const base = Array.from(exportFilename(item.name)).slice(0, 60).join('');
    let name = base,
      suffix = 2;
    while (used.has(name.normalize('NFC').toLowerCase()))
      name = `${base} (${suffix++})`;
    used.add(name.normalize('NFC').toLowerCase());
    paths.set(
      id,
      folder + name + (item.kind === 'database' ? '.csv' : '.html')
    );
  }
  const files: Record<string, Uint8Array> = {};
  const sourcePaths = new Map(
    [...paths].map(([id, path]) => {
      const url = new URL(options.sourceUrl(id));
      return [url.origin + url.pathname, path];
    })
  );
  const images = new Map<string, Promise<Blob>>();
  const resolveImage = (id: string) => {
    if (!images.has(id)) images.set(id, options.resolveImage(id));
    return images.get(id)!;
  };
  for (const [id, item] of items) {
    const path = paths.get(id)!;
    if (item.kind === 'database') {
      const fields = Object.values(item.fields ?? {}).sort(
        (a, b) => a.index.localeCompare(b.index) || a.id.localeCompare(b.id)
      );
      const records = item.children
        .map((child) => items.get(child.id))
        .filter(
          (child): child is PageExportSnapshot => child?.kind === 'record'
        );
      const used = new Set<string>();
      const unique = (name: string) => {
        let value = name || 'Property',
          index = 2;
        while (used.has(value)) value = `${name} (${index++})`;
        used.add(value);
        return value;
      };
      const headers = [
        unique(item.nameField ?? 'Name'),
        ...fields.map((field) => unique(field.name)),
        unique('Body'),
        unique('Body page'),
      ];
      files[path] = strToU8(
        csv([
          headers,
          ...records.map((record) => [
            record.name,
            ...fields.map((field) => valueText(record, field, items)),
            exportBodyText(record),
            relative(path, paths.get(record.id)!),
          ]),
        ])
      );
      continue;
    }
    const source = renderNotionExportDocument(item, items, options.sourceUrl);
    const parent = items.get(parents.get(id) ?? '');
    if (item.kind === 'record' && parent?.kind === 'database') {
      const properties = document.createElement('dl');
      for (const field of Object.values(parent.fields ?? {}).sort((a, b) =>
        a.index.localeCompare(b.index)
      )) {
        const name = document.createElement('dt'),
          value = document.createElement('dd');
        name.textContent = field.name;
        value.textContent = valueText(item, field, items);
        properties.append(name, value);
      }
      source.prepend(properties);
    }
    const html = await buildPageExport(source, item.name, { resolveImage });
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    for (const link of Array.from(parsed.querySelectorAll('a[href]'))) {
      const href = link.getAttribute('href')!;
      const url = new URL(href);
      const targetPath = sourcePaths.get(url.origin + url.pathname);
      if (targetPath) {
        const block = new URLSearchParams(url.hash.slice(1)).get('block');
        link.setAttribute(
          'href',
          relative(path, targetPath) +
            (block ? '#block-' + encodeURIComponent(block) : '')
        );
      }
    }
    const packed = packageNotionHtml(
      '<!doctype html>\n' + parsed.documentElement.outerHTML,
      id.replace(/[^a-zA-Z0-9-]/g, '_')
    );
    files[path] = strToU8(packed.html);
    for (const [asset, data] of Object.entries(packed.files))
      files[dirname(path) + asset] = data;
  }
  return { bytes: zipSync(files, { level: 0 }), count: items.size, paths };
};
