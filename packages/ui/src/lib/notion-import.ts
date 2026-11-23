import type { JSONContent } from '@tiptap/core';
import { strFromU8, unzipSync } from 'fflate';
import { marked } from 'marked';

import { mapContentsToBlocks } from '@colanode/client/lib';
import {
  generateId,
  generateFractionalIndex,
  IdType,
  richTextContentSchema,
  type NodeAttributes,
} from '@colanode/core';
import { encodeState, YDoc } from '@colanode/crdt';

export type NotionImportItem = {
  path: string;
  name: string;
  kind: 'page' | 'database' | 'record';
  parent?: string;
  body: JSONContent[];
  columns?: string[];
  values?: string[];
};
export type NotionImportPlan = {
  items: NotionImportItem[];
  files: Record<string, Uint8Array>;
  images: string[];
  warnings: string[];
};
const LIMIT = 256 * 1024 * 1024;
const cleanName = (path: string) =>
  path
    .split('/')
    .at(-1)!
    .replace(/\.(html?|md|csv)$/i, '')
    .replace(/ [a-f\d]{32}$/i, '') || 'Untitled';
const stem = (path: string) => path.replace(/\.(html?|md|csv)$/i, '');
const dir = (path: string) => path.slice(0, path.lastIndexOf('/') + 1);
const imageType = (path: string) =>
  ({
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    avif: 'image/avif',
    bmp: 'image/bmp',
  })[path.split('.').at(-1)!.toLowerCase()];

// Archive paths never become filesystem paths. Reject aliases before unzip so
// traversal, duplicate names and oversized entries cannot bypass the preview.
const archivePath = (path: string) => {
  if (
    /^[/\\]|^[a-z]:|\\/i.test(path) ||
    Array.from(path).some((c) => c.charCodeAt(0) < 32)
  )
    throw new Error('Unsafe ZIP path.');
  const parts = path.normalize('NFC').split('/');
  if (parts.some((part) => part === '..' || part === '.'))
    throw new Error('Unsafe ZIP path.');
  return parts.join('/');
};
const localPath = (base: string, href: string): string | null => {
  if (/^[a-z][a-z\d+.-]*:|^\/\//i.test(href) || href.startsWith('#'))
    return null;
  try {
    const value = decodeURIComponent(href.split(/[?#]/)[0]!).replaceAll(
      '\\',
      '/'
    );
    if (
      value.startsWith('/') ||
      Array.from(value).some((c) => c.charCodeAt(0) < 32)
    )
      return null;
    const parts = dir(base).split('/').filter(Boolean);
    for (const part of value.split('/')) {
      if (part === '..') {
        if (!parts.length) return null;
        parts.pop();
      } else if (part && part !== '.') parts.push(part);
    }
    return parts.join('/').normalize('NFC');
  } catch {
    return null;
  }
};
const safeLink = (value: string) =>
  /^(https?:|mailto:|tel:)/i.test(value) ? value : null;

export const parseNotionCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (quoted || cell === '') quoted = !quoted;
      else cell += c;
    } else if (!quoted && (c === ',' || c === '\r' || c === '\n')) {
      row.push(cell);
      cell = '';
      if (c !== ',') {
        if (row.some(Boolean)) rows.push(row);
        row = [];
        if (c === '\r' && text[i + 1] === '\n') i++;
      }
    } else cell += c;
  }
  if (quoted) throw new Error('A CSV has an unterminated quoted field.');
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
};

export const previewNotionZip = (bytes: Uint8Array): NotionImportPlan => {
  if (bytes.length > LIMIT) throw new Error('ZIP must be smaller than 256 MB.');
  const seen = new Set<string>();
  let total = 0,
    count = 0;
  const files = unzipSync(bytes, {
    filter: (entry) => {
      const name = archivePath(entry.name);
      if (seen.has(name)) throw new Error('ZIP contains duplicate paths.');
      seen.add(name);
      total += entry.originalSize;
      if (++count > 10000 || total > LIMIT)
        throw new Error('ZIP expands beyond 256 MB or 10,000 files.');
      return (
        !name.endsWith('/') &&
        !name.startsWith('__MACOSX/') &&
        !name.split('/').at(-1)?.startsWith('.')
      );
    },
  });
  const normalized: Record<string, Uint8Array> = {};
  for (const [path, value] of Object.entries(files))
    normalized[archivePath(path)] = value;
  const warnings = new Set<string>([
    'CSV properties are imported as text. Views, relations, permissions and history are not imported.',
  ]);
  const items: NotionImportItem[] = [];
  const bodies = new Map<string, DocumentFragment>();
  const csvs = new Map<string, string[][]>();
  for (const [path, value] of Object.entries(normalized)) {
    if (/\.csv$/i.test(path)) {
      csvs.set(path, parseNotionCsv(strFromU8(value)));
      continue;
    }
    if (!/\.(html?|md)$/i.test(path)) continue;
    // Inert template: never insert untrusted HTML into a live document, and
    // never fetch remote images/resources while inspecting an import.
    const template = document.createElement('template');
    const text = strFromU8(value);
    template.innerHTML = /\.md$/i.test(path)
      ? marked.parse(text, { async: false })
      : text;
    template.content
      .querySelectorAll('script,style,iframe,object,embed,link,meta,nav')
      .forEach((node) => node.remove());
    const title =
      template.content
        .querySelector('h1.page-title,header h1,title')
        ?.textContent?.trim() || cleanName(path);
    const body =
      template.content.querySelector('.page-body,main,article') ??
      template.content;
    if (
      /\.md$/i.test(path) &&
      body.querySelector('h1')?.textContent?.trim() === cleanName(path)
    )
      body.querySelector('h1')?.remove();
    body
      .querySelectorAll('header,.page-title,head,title')
      .forEach((node) => node.remove());
    if (
      body.firstElementChild?.tagName === 'H1' &&
      body.firstElementChild.textContent?.trim() === title
    )
      body.firstElementChild.remove();
    const fragment = document.createDocumentFragment();
    fragment.append(...Array.from(body.childNodes));
    bodies.set(path, fragment);
    items.push({ path, name: title, kind: 'page', body: [] });
  }
  for (const [path, rows] of csvs) {
    // Notion sometimes includes an additional _all CSV beside the main CSV.
    if (
      /_all\.csv$/i.test(path) &&
      csvs.has(path.replace(/_all\.csv$/i, '.csv'))
    )
      continue;
    const html = items.find((item) => stem(item.path) === stem(path));
    const database = html ?? {
      path,
      name: cleanName(path),
      kind: 'database' as const,
      body: [],
    };
    database.kind = 'database';
    database.columns = rows[0] ?? [];
    if (!html) items.push(database);
    const bodyColumn = database.columns.indexOf('Body page');
    for (const [index, values] of rows.slice(1).entries()) {
      const explicitPath =
        bodyColumn >= 0 ? localPath(path, values[bodyColumn] ?? '') : null;
      const candidates = items.filter(
        (item) =>
          item.kind === 'page' &&
          dir(item.path) === `${stem(path)}/` &&
          cleanName(item.path) === values[0]
      );
      const record =
        items.find((item) => item.path === explicitPath) ??
        (candidates.length === 1 ? candidates[0] : undefined);
      if (record) {
        record.kind = 'record';
        record.parent = database.path;
        record.values = values;
      } else
        items.push({
          path: `${path}#row-${index}`,
          name: values[0] || 'Untitled',
          kind: 'record',
          parent: database.path,
          values,
          body: [],
        });
    }
  }
  // HTML-only Notion exports can carry a native collection table rather than
  // a separate CSV. Convert it to the same preview model as CSV databases.
  for (const item of [...items]) {
    const body = bodies.get(item.path);
    const tables = Array.from(
      body?.querySelectorAll('table.collection-content') ?? []
    );
    if (!body || !tables.length || item.kind === 'database') continue;
    const remainder = body.cloneNode(true) as DocumentFragment;
    remainder
      .querySelectorAll('table.collection-content')
      .forEach((table) => table.remove());
    const wholeDatabase =
      tables.length === 1 &&
      !remainder.textContent?.trim() &&
      !remainder.querySelector('img,video,audio,iframe');
    for (const [tableIndex, table] of tables.entries()) {
      const sourceRows = Array.from(table.querySelectorAll('tr'));
      const rows = sourceRows.map((row) =>
        Array.from(row.querySelectorAll('th,td')).map(
          (cell) => cell.textContent?.trim() ?? ''
        )
      );
      if (!rows.length) continue;
      const database: NotionImportItem = wholeDatabase
        ? item
        : {
            path: `${item.path}#inline-db-${tableIndex}`,
            name:
              table.querySelector('caption')?.textContent?.trim() ||
              `${item.name} database ${tableIndex + 1}`,
            kind: 'database',
            parent: item.path,
            body: [],
          };
      database.kind = 'database';
      database.columns = rows[0];
      if (!wholeDatabase) {
        items.push(database);
        table.setAttribute('data-notion-import-database', database.path);
      }
      for (const [index, values] of rows.slice(1).entries()) {
        const link = sourceRows[index + 1]?.querySelector('a');
        const target = link
          ? localPath(item.path, link.getAttribute('href') ?? '')
          : null;
        const record = items.find((candidate) => candidate.path === target);
        if (record) {
          record.kind = 'record';
          record.parent = database.path;
          record.values = values;
        } else
          items.push({
            path: `${database.path}#row-${index}`,
            kind: 'record',
            parent: database.path,
            name: values[0] || 'Untitled',
            values,
            body: [],
          });
      }
    }
  }
  if (!items.length)
    throw new Error(
      'No HTML, Markdown or CSV documents were found in this ZIP.'
    );
  if (items.length > 2000)
    throw new Error('Import supports up to 2,000 pages and rows at a time.');
  const byPath = new Map(items.map((item) => [item.path, item]));
  for (const [path] of csvs) {
    const paired = items.find(
      (item) => item.kind === 'database' && stem(item.path) === stem(path)
    );
    if (paired) byPath.set(path, paired);
  }
  const references = new Set<string>();
  const inline = (
    nodes: NodeListOf<ChildNode> | ChildNode[],
    base: string,
    marks: NonNullable<JSONContent['marks']> = []
  ): JSONContent[] =>
    Array.from(nodes).flatMap((node): JSONContent[] => {
      if (node.nodeType === 3)
        return node.textContent
          ? [
              {
                type: 'text',
                text: node.textContent,
                ...(marks.length ? { marks } : {}),
              },
            ]
          : [];
      if (!(node instanceof Element)) return [];
      const tags: Record<string, string> = {
        STRONG: 'bold',
        B: 'bold',
        EM: 'italic',
        I: 'italic',
        U: 'underline',
        S: 'strike',
        DEL: 'strike',
        CODE: 'code',
      };
      let next = marks;
      if (tags[node.tagName]) next = [...marks, { type: tags[node.tagName]! }];
      if (node.tagName === 'A') {
        const href = node.getAttribute('href') ?? '';
        const target = localPath(base, href);
        const item = target ? byPath.get(target) : null;
        if (item)
          next = [
            ...marks,
            { type: 'link', attrs: { href: `import:${item.path}` } },
          ];
        else if (safeLink(href))
          next = [...marks, { type: 'link', attrs: { href } }];
        else if (href && !href.startsWith('#'))
          warnings.add(
            'Some local links are missing from the ZIP and were kept as text.'
          );
      }
      if (node.tagName === 'BR') return [{ type: 'hardBreak' }];
      return inline(node.childNodes, base, next);
    });
  const blocks = (
    nodes: NodeListOf<ChildNode> | ChildNode[],
    base: string,
    depth = 0
  ): JSONContent[] => {
    if (depth > 30) throw new Error('Document nesting exceeds 30 levels.');
    const grouped: ChildNode[] = [];
    let run: ChildNode[] = [];
    const flush = () => {
      if (
        run.some(
          (node) =>
            node.textContent?.trim() ||
            (node instanceof Element && node.tagName === 'BR')
        )
      ) {
        const p = document.createElement('p');
        p.append(...run.map((node) => node.cloneNode(true)));
        grouped.push(p);
      }
      run = [];
    };
    for (const node of Array.from(nodes)) {
      const isReference =
        node instanceof Element &&
        node.tagName === 'A' &&
        byPath.has(localPath(base, node.getAttribute('href') ?? '') ?? '');
      if (
        node.nodeType === 3 ||
        (node instanceof Element &&
          node.matches('strong,b,em,i,u,s,del,code,span,a,br') &&
          !isReference)
      )
        run.push(node);
      else {
        flush();
        grouped.push(node);
      }
    }
    flush();
    return grouped.flatMap((node): JSONContent[] => {
      if (node.nodeType === 3)
        return node.textContent?.trim()
          ? [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: node.textContent }],
              },
            ]
          : [];
      if (!(node instanceof Element)) return [];
      if (node.matches('script,style,iframe,object,embed,link,meta')) return [];
      const inlineDatabase = node.getAttribute('data-notion-import-database');
      if (inlineDatabase && byPath.get(inlineDatabase)?.kind === 'database')
        return [
          {
            type: 'database',
            attrs: { importTarget: inlineDatabase, inline: true },
          },
        ];
      if (node.tagName === 'IMG') {
        const path = localPath(base, node.getAttribute('src') ?? '');
        if (path && normalized[path] && imageType(path)) {
          references.add(path);
          return [{ type: 'file', attrs: { importImagePath: path } }];
        }
        warnings.add(
          'An external, missing or unsupported image was kept as a text link; it was not downloaded.'
        );
        const href = safeLink(node.getAttribute('src') ?? '');
        return [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: node.getAttribute('alt') || href || '[Image unavailable]',
                ...(href ? { marks: [{ type: 'link', attrs: { href } }] } : {}),
              },
            ],
          },
        ];
      }
      if (node.matches('figure') && node.querySelector('img'))
        return blocks(node.childNodes, base, depth + 1);
      if (node.tagName === 'A') {
        const target = localPath(base, node.getAttribute('href') ?? '');
        const item = target ? byPath.get(target) : null;
        if (item)
          return [
            {
              type: item.kind === 'database' ? 'database' : 'page',
              attrs: {
                importTarget: item.path,
                inline: node.getAttribute('data-inline') === 'true',
              },
            },
          ];
      }
      if (node.tagName === 'DETAILS') {
        const summary = Array.from(node.children).find(
          (child) => child.tagName === 'SUMMARY'
        );
        return [
          {
            type: 'toggle',
            content: [
              {
                type: 'paragraph',
                content: summary ? inline(summary.childNodes, base) : [],
              },
              ...blocks(
                Array.from(node.childNodes).filter(
                  (child) => child !== summary
                ),
                base,
                depth + 1
              ),
            ],
          },
        ];
      }
      if (node.matches('h1,h2,h3,p,pre,hr')) {
        // Image-only paragraphs must remain image blocks.
        if (node.querySelector('img'))
          return blocks(node.childNodes, base, depth + 1);
        const only = node.children.length === 1 ? node.children[0] : null;
        if (
          node.tagName === 'P' &&
          only?.tagName === 'A' &&
          node.textContent?.trim() === only.textContent?.trim()
        ) {
          const target = localPath(base, only.getAttribute('href') ?? '');
          if (target && byPath.has(target))
            return blocks([only as ChildNode], base, depth + 1);
        }
        const type =
          (
            {
              H1: 'heading1',
              H2: 'heading2',
              H3: 'heading3',
              PRE: 'codeBlock',
              HR: 'horizontalRule',
            } as Record<string, string>
          )[node.tagName] ?? 'paragraph';
        const color = Array.from(node.classList)
          .find((name) => /^block-color-\w+_background$/.test(name))
          ?.replace('block-color-', '')
          .replace('_background', '');
        return [
          {
            type,
            content:
              type === 'horizontalRule' ? [] : inline(node.childNodes, base),
            ...(color ? { attrs: { blockBackground: color } } : {}),
          },
        ];
      }
      const container = (
        {
          UL: 'bulletList',
          OL: 'orderedList',
          LI: 'listItem',
          BLOCKQUOTE: 'blockquote',
          TABLE: 'table',
          TR: 'tableRow',
          TH: 'tableHeader',
          TD: 'tableCell',
        } as Record<string, string>
      )[node.tagName];
      if (container) {
        let content = blocks(node.childNodes, base, depth + 1);
        if (
          ['listItem', 'tableCell', 'tableHeader'].includes(container) &&
          !content.length
        )
          content = [{ type: 'paragraph' }];
        return [{ type: container, content }];
      }
      if (node.tagName === 'INPUT') {
        warnings.add('Checkbox inputs are imported as text/list content.');
        return [];
      }
      return blocks(node.childNodes, base, depth + 1);
    });
  };
  for (const item of items) {
    if (!item.parent) {
      const parents = items
        .filter(
          (candidate) =>
            candidate !== item &&
            item.path.startsWith(`${stem(candidate.path)}/`) &&
            candidate.kind !== 'record' &&
            (item.kind !== 'page' || candidate.kind !== 'database')
        )
        .sort((a, b) => b.path.length - a.path.length);
      item.parent = parents[0]?.path;
      if (
        item.kind === 'page' &&
        items.some(
          (candidate) =>
            candidate.kind === 'database' &&
            item.path.startsWith(`${stem(candidate.path)}/`)
        )
      )
        warnings.add(
          'A row body could not be matched uniquely to CSV data and is retained as a separate page.'
        );
    }
    const body = bodies.get(item.path);
    if (body && item.kind !== 'database')
      item.body = blocks(body.childNodes, item.path);
    else if (item.kind === 'record' && !body) {
      const db = byPath.get(item.parent!);
      const position = db?.columns?.indexOf('Body') ?? -1;
      if (position >= 0 && item.values?.[position])
        item.body = [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: item.values[position]! }],
          },
        ];
    }
  }
  return {
    items,
    files: normalized,
    images: [...references],
    warnings: [...warnings],
  };
};

export const importNotionPlan = async (
  plan: NotionImportPlan,
  options: {
    parentId: string;
    userId: string;
    workspaceId: string;
    onProgress?: (done: number, total: number) => void;
    onRoot?: (id: string) => void;
  }
) => {
  const { userId } = options;
  const create = async (nodeId: string, attributes: NodeAttributes) => {
    const result = await window.colanode.executeMutation({
      type: 'node.create',
      userId,
      nodeId,
      attributes,
    });
    if (!result.success) throw new Error(result.error.message);
  };
  const rootId = generateId(IdType.Page);
  await create(rootId, {
    type: 'page',
    parentId: options.parentId,
    name: 'Notion import',
  });
  options.onRoot?.(rootId);
  const ids = new Map(
    plan.items.map((item) => [
      item.path,
      generateId(
        item.kind === 'database'
          ? IdType.Database
          : item.kind === 'record'
            ? IdType.Record
            : IdType.Page
      ),
    ])
  );
  const columns = new Map<string, string[]>();
  const pending = [...plan.items];
  const created = new Set<string>();
  while (pending.length) {
    const index = pending.findIndex(
      (item) => !item.parent || created.has(item.parent)
    );
    if (index < 0)
      throw new Error('The import hierarchy has an unresolved parent.');
    const item = pending.splice(index, 1)[0]!;
    const nodeId = ids.get(item.path)!;
    const parentId = ids.get(item.parent ?? '') ?? rootId;
    if (item.kind === 'database') {
      const fields = (item.columns ?? []).map((_, index) =>
        index === 0 ? 'name' : generateId(IdType.Field)
      );
      columns.set(item.path, fields);
      let previousIndex: string | null = null;
      const definitions = fields.slice(1).map((id, index) => {
        previousIndex = generateFractionalIndex(previousIndex, null);
        return [
          id,
          {
            id,
            type: 'text' as const,
            name: item.columns![index + 1] || `Column ${index + 2}`,
            index: previousIndex,
          },
        ] as const;
      });
      await create(nodeId, {
        type: 'database',
        name: item.name,
        parentId,
        nameField: { name: item.columns?.[0] || 'Name' },
        fields: Object.fromEntries(definitions),
      });
      await create(generateId(IdType.DatabaseView), {
        type: 'database_view',
        parentId: nodeId,
        name: 'Default',
        layout: 'table',
        index: 'a0',
      });
    } else if (item.kind === 'record') {
      const fields = columns.get(item.parent!) ?? [];
      await create(nodeId, {
        type: 'record',
        name: item.name,
        parentId,
        databaseId: parentId,
        fields: Object.fromEntries(
          fields
            .slice(1)
            .map((id, index) => [
              id,
              { type: 'text', value: item.values?.[index + 1] ?? '' },
            ])
        ),
      });
    } else await create(nodeId, { type: 'page', name: item.name, parentId });
    created.add(item.path);
  }
  let done = 0;
  for (const item of plan.items) {
    if (item.kind !== 'database') {
      const nodeId = ids.get(item.path)!;
      const convert = async (source: JSONContent): Promise<JSONContent> => {
        const node: JSONContent = structuredClone(source);
        if (node.attrs?.importImagePath) {
          const path = String(node.attrs.importImagePath);
          let id: string;
          {
            const bytes = plan.files[path]!;
            const file = new File(
              [new Uint8Array(bytes)],
              path.split('/').at(-1)!,
              { type: imageType(path) }
            );
            const temp = await window.colanode.saveTempFile(file);
            const result = await window.colanode.executeMutation({
              type: 'file.create',
              userId,
              parentId: nodeId,
              tempFileId: temp.id,
            });
            if (!result.success) throw new Error(result.error.message);
            if (!result.output.id)
              throw new Error('An image could not be created.');
            id = result.output.id;
          }
          node.attrs = { id };
        } else if (node.attrs?.importTarget) {
          node.attrs = {
            id: ids.get(node.attrs.importTarget),
            inline: node.attrs.inline,
          };
        } else if (node.type !== 'text' && node.type !== 'hardBreak')
          node.attrs = { ...node.attrs, id: generateId(IdType.Block) };
        node.marks = node.marks?.map((mark) => {
          if (
            mark.type !== 'link' ||
            !String(mark.attrs?.href).startsWith('import:')
          )
            return mark;
          const target = ids.get(String(mark.attrs!.href).slice(7));
          return {
            ...mark,
            attrs: { href: `/${options.workspaceId}/${target}` },
          };
        });
        if (node.content)
          node.content = await Promise.all(node.content.map(convert));
        return node;
      };
      const content = await Promise.all(item.body.map(convert));
      const blocks = mapContentsToBlocks(nodeId, content, new Map());
      const ydoc = new YDoc();
      const update = ydoc.update(richTextContentSchema, {
        type: 'rich_text',
        blocks,
      });
      if (update) {
        const result = await window.colanode.executeMutation({
          type: 'document.update',
          userId,
          documentId: nodeId,
          update: encodeState(update),
        });
        if (!result.success) throw new Error(result.error.message);
      }
    }
    options.onProgress?.(++done, plan.items.length);
  }
  return rootId;
};
