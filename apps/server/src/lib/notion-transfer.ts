import type { Block, BlockLeaf, PageExportSnapshot } from '@colanode/core';

type Json = Record<string, unknown>;
type Result = {
  id: string;
  url?: string;
  results?: { id: string }[];
  data_sources?: { id: string }[];
  status?: string;
};
export type NotionTransferResult = {
  url: string | null;
  complete: boolean;
  pages: number;
  warnings: string[];
  error?: string;
};
const richText = (text: string) => {
  const result: Json[] = [];
  for (let i = 0; i < text.length; i += 1900)
    result.push({ type: 'text', text: { content: text.slice(i, i + 1900) } });
  return result;
};
const text = (leaves: BlockLeaf[] | null | undefined): Json[] =>
  (leaves ?? []).flatMap((leaf) => {
    const annotations: Json = {};
    let link: string | undefined;
    for (const mark of leaf.marks ?? []) {
      const name = (
        {
          bold: 'bold',
          italic: 'italic',
          underline: 'underline',
          strike: 'strikethrough',
          code: 'code',
        } as Record<string, string>
      )[mark.type];
      if (name) annotations[name] = true;
      if (
        mark.type === 'link' &&
        /^https?:|^mailto:|^tel:/i.test(String(mark.attrs?.href))
      )
        link = mark.attrs!.href;
      if (
        mark.type === 'highlight' &&
        /^(gray|brown|orange|yellow|green|blue|purple|pink|red)$/.test(
          String(mark.attrs?.highlight)
        )
      )
        annotations.color = `${mark.attrs!.highlight}_background`;
      if (
        mark.type === 'color' &&
        /^(gray|brown|orange|yellow|green|blue|purple|pink|red)$/.test(
          String(mark.attrs?.color)
        )
      )
        annotations.color = mark.attrs!.color;
    }
    return richText(leaf.type === 'hardBreak' ? '\n' : (leaf.text ?? '')).map(
      (entry) => ({
        ...entry,
        annotations,
        ...(link
          ? { text: { ...(entry.text as Json), link: { url: link } } }
          : {}),
      })
    );
  });
export const notionParentId = (value: string) => {
  const match = value
    .trim()
    .match(
      /(?:^|\/|[-])([a-f\d]{32}|[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12})(?:$|[?#])/i
    );
  if (!match) throw new Error('Enter a Notion page URL or page ID.');
  return match[1]!.replaceAll('-', '');
};

// A connection token lives only for this request. Never persist it, include it
// in errors, follow redirects, or accept a caller-supplied API host.
export const transferToNotion = async (options: {
  token: string;
  parent: string;
  rootId: string;
  read: (id: string, offset: number) => Promise<PageExportSnapshot | null>;
  image: (file: PageExportSnapshot['files'][number]) => Promise<Blob>;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}): Promise<NotionTransferResult> => {
  const parent = notionParentId(options.parent);
  const items = new Map<string, PageExportSnapshot>();
  const queue = [options.rootId];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]!;
    if (items.has(id)) continue;
    if (items.size >= 200)
      throw new Error(
        'Direct transfer supports up to 200 pages and rows at a time. Use ZIP for larger exports.'
      );
    const snapshot = await options.read(id, 0);
    if (!snapshot || snapshot.id !== id)
      throw new Error('Export content is unavailable.');
    let offset = snapshot.nextOffset;
    const offsets = new Set<number>();
    while (offset !== null) {
      if (offsets.has(offset))
        throw new Error('Export pagination did not advance.');
      offsets.add(offset);
      const next = await options.read(id, offset);
      if (!next || next.id !== id)
        throw new Error('Export content is unavailable.');
      snapshot.children.push(...next.children);
      offset = next.nextOffset;
    }
    items.set(id, snapshot);
    for (const child of snapshot.children)
      if (!queue.includes(child.id)) queue.push(child.id);
    if (queue.length > 200)
      throw new Error(
        'Direct transfer supports up to 200 pages and rows at a time. Use ZIP for larger exports.'
      );
  }
  const warnings = new Set<string>([
    'Views, relations, permissions and history are not transferred. Database properties are transferred as text.',
  ]);
  const root = items.get(options.rootId)!;
  if (
    [...items.values()].reduce(
      (count, item) => count + Object.keys(item.content?.blocks ?? {}).length,
      0
    ) > 3000
  )
    throw new Error(
      'Direct transfer supports up to 3,000 blocks at a time. Use ZIP for larger exports.'
    );
  const done = new Map<string, string>();
  const result: NotionTransferResult = {
    url: null,
    complete: false,
    pages: 0,
    warnings: [],
  };
  const wait =
    options.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const request = async (
    path: string,
    payload: Json | FormData,
    method = 'POST'
  ): Promise<Result> => {
    for (let attempt = 0; attempt < 4; attempt++) {
      await wait(350);
      let response: Response;
      try {
        response = await (options.fetch ?? fetch)(
          `https://api.notion.com/v1/${path}`,
          {
            method,
            headers: {
              Authorization: `Bearer ${options.token}`,
              'Notion-Version': '2025-09-03',
              ...(payload instanceof FormData
                ? {}
                : { 'Content-Type': 'application/json' }),
            },
            body:
              payload instanceof FormData ? payload : JSON.stringify(payload),
            redirect: 'error',
            signal: AbortSignal.timeout(45000),
          }
        );
      } catch {
        throw new Error(
          'Notion connection failed. Check the destination before retrying; the last operation may have completed.'
        );
      }
      if (response.status === 429 && attempt < 3) {
        await wait(
          Math.min(
            10000,
            Math.max(
              1000,
              Number(response.headers.get('retry-after')) * 1000 || 1000
            )
          )
        );
        continue;
      }
      if (!response.ok)
        throw new Error(
          `Notion returned ${response.status}. Check connection access and the partially created page before retrying.`
        );
      return (await response.json()) as Result;
    }
    throw new Error('Notion is rate limited. Please retry later.');
  };
  const append = async (parentId: string, type: string, value: Json) => {
    const response = await request(
      `blocks/${encodeURIComponent(parentId)}/children`,
      { children: [{ object: 'block', type, [type]: value }] },
      'PATCH'
    );
    const id = response.results?.[0]?.id;
    if (!id) throw new Error('Notion did not return the created block.');
    return id;
  };
  const sorted = (snapshot: PageExportSnapshot, parentId: string) =>
    Object.values(snapshot.content?.blocks ?? {})
      .filter((block) => block.parentId === parentId)
      .sort((a, b) => (a.index < b.index ? -1 : a.index > b.index ? 1 : 0));
  const writeBody = async (snapshot: PageExportSnapshot, parentId: string) => {
    const written = new Set<string>();
    const render = async (
      blocks: Block[],
      target: string,
      depth = 0
    ): Promise<void> => {
      if (depth > 30) throw new Error('Document nesting exceeds 30 levels.');
      for (const block of blocks) {
        const children = sorted(snapshot, block.id);
        if (
          block.type === 'database' ||
          block.type === 'page' ||
          block.type === 'folder'
        ) {
          const id = String(block.attrs?.sourceDatabaseId ?? block.id);
          const child = items.get(id);
          if (!child) {
            warnings.add(
              'References outside the exported hierarchy are not transferred.'
            );
            continue;
          }
          written.add(id);
          if (target !== parentId) {
            warnings.add(
              'Nested page/database placements are moved to the containing page.'
            );
          }
          if (!done.has(id))
            await create(
              child,
              parentId,
              block.type === 'database' && block.attrs?.inline === true
            );
          else
            await append(target, 'link_to_page', {
              type: child.kind === 'database' ? 'database_id' : 'page_id',
              [child.kind === 'database' ? 'database_id' : 'page_id']:
                done.get(id),
            });
          continue;
        }
        if (block.type === 'file') {
          const file = snapshot.files.find((file) => file.id === block.id);
          if (!file) throw new Error('A referenced file is unavailable.');
          const blob = await options.image(file);
          const partSize = 20 * 1024 * 1024;
          const parts = Math.ceil(blob.size / partSize) || 1;
          const upload = await request('file_uploads', {
            mode: parts > 1 ? 'multi_part' : 'single_part',
            ...(parts > 1 ? { number_of_parts: parts } : {}),
            filename: file.name,
            content_type:
              blob.type || file.mimeType || 'application/octet-stream',
          });
          let sent: Result | undefined;
          for (let part = 0; part < parts; part++) {
            const form = new FormData();
            form.set(
              'file',
              parts > 1
                ? blob.slice(
                    part * partSize,
                    Math.min(blob.size, (part + 1) * partSize),
                    blob.type
                  )
                : blob,
              file.name
            );
            if (parts > 1) form.set('part_number', String(part + 1));
            sent = await request(
              `file_uploads/${encodeURIComponent(upload.id)}/send`,
              form
            );
          }
          if (parts > 1)
            sent = await request(
              `file_uploads/${encodeURIComponent(upload.id)}/complete`,
              {}
            );
          if (sent?.status && sent.status !== 'uploaded')
            throw new Error('Notion did not finish the file upload.');
          const mediaType = (
            {
              image: 'image',
              video: 'video',
              audio: 'audio',
              pdf: 'pdf',
              other: 'file',
            } as const
          )[file.subtype];
          await append(target, mediaType, {
            type: 'file_upload',
            file_upload: { id: upload.id },
            ...(mediaType === 'file' ? { name: file.name } : {}),
          });
          continue;
        }
        if (block.type === 'table') {
          const rows = children.map((row) => ({
            object: 'block',
            type: 'table_row',
            table_row: {
              cells: sorted(snapshot, row.id).map((cell) =>
                text(
                  sorted(snapshot, cell.id).flatMap(
                    (child) => child.content ?? []
                  )
                )
              ),
            },
          }));
          const width = Math.max(
            0,
            ...rows.map((row) => row.table_row.cells.length)
          );
          if (width && rows.length) {
            for (const row of rows)
              while (row.table_row.cells.length < width)
                row.table_row.cells.push([]);
            const table = await append(target, 'table', {
              table_width: width,
              has_column_header: false,
              has_row_header: false,
              children: rows.slice(0, 100),
            });
            for (let i = 100; i < rows.length; i += 100)
              await request(
                `blocks/${table}/children`,
                { children: rows.slice(i, i + 100) },
                'PATCH'
              );
          }
          continue;
        }
        if (['bulletList', 'orderedList', 'taskList'].includes(block.type)) {
          for (const child of children) {
            const parts = sorted(snapshot, child.id),
              first = parts[0];
            const type =
              block.type === 'taskList'
                ? 'to_do'
                : block.type === 'orderedList'
                  ? 'numbered_list_item'
                  : 'bulleted_list_item';
            const id = await append(target, type, {
              rich_text: text(first?.content),
              ...(type === 'to_do'
                ? { checked: child.attrs?.checked === true }
                : {}),
            });
            await render(parts.slice(1), id, depth + 1);
          }
          continue;
        }
        let type = (
          {
            heading1: 'heading_1',
            heading2: 'heading_2',
            heading3: 'heading_3',
            paragraph: 'paragraph',
            blockquote: 'quote',
            toggle: 'toggle',
            codeBlock: 'code',
            horizontalRule: 'divider',
          } as Record<string, string>
        )[block.type];
        if (!type) {
          type = 'paragraph';
          warnings.add(
            `Unsupported block “${block.type}” was reduced to text.`
          );
        }
        const first = block.type === 'toggle' ? children[0] : null;
        const value: Json =
          type === 'divider'
            ? {}
            : { rich_text: text(first?.content ?? block.content) };
        if (type === 'code') value.language = 'plain text';
        else if (
          type !== 'divider' &&
          /^(gray|brown|orange|yellow|green|blue|purple|pink|red)$/.test(
            String(block.attrs?.blockBackground)
          )
        )
          value.color = `${block.attrs!.blockBackground}_background`;
        const id = await append(target, type, value);
        await render(first ? children.slice(1) : children, id, depth + 1);
      }
    };
    await render(sorted(snapshot, snapshot.id), parentId);
    for (const child of snapshot.children)
      if (!written.has(child.id) && !done.has(child.id))
        await create(items.get(child.id)!, parentId, false);
  };
  const create = async (
    snapshot: PageExportSnapshot,
    parentId: string,
    inline: boolean,
    dataSource?: string
  ): Promise<string> => {
    if (done.has(snapshot.id)) return done.get(snapshot.id)!;
    if (snapshot.kind === 'database') {
      const fields = Object.values(snapshot.fields ?? {}).sort((a, b) =>
        a.index.localeCompare(b.index)
      );
      const names = new Map<string, string>();
      const used = new Set(['Name']);
      for (const field of fields) {
        let name = field.name.slice(0, 150) || 'Property';
        while (used.has(name)) name += ' (copy)';
        used.add(name);
        names.set(field.id, name);
      }
      const db = await request('databases', {
        parent: { type: 'page_id', page_id: parentId },
        title: richText(snapshot.name),
        is_inline: inline,
        initial_data_source: {
          properties: {
            Name: { title: {} },
            ...Object.fromEntries(
              [...names.values()].map((name) => [name, { rich_text: {} }])
            ),
          },
        },
      });
      done.set(snapshot.id, db.id);
      result.pages++;
      const source = db.data_sources?.[0]?.id;
      if (!source)
        throw new Error('Notion did not return a database data source.');
      for (const child of snapshot.children) {
        const record = items.get(child.id)!;
        if (record.kind !== 'record') continue;
        const properties: Json = { Name: { title: richText(record.name) } };
        for (const field of fields) {
          const value = record.values?.[field.id]?.value;
          const label = (value: unknown) =>
            (field.type === 'select' || field.type === 'multi_select') &&
            typeof value === 'string'
              ? (field.options?.[value]?.name ?? value)
              : String(value ?? '');
          properties[names.get(field.id)!] = {
            rich_text: richText(
              Array.isArray(value) ? value.map(label).join(', ') : label(value)
            ),
          };
        }
        const page = await request('pages', {
          parent: { type: 'data_source_id', data_source_id: source },
          properties,
        });
        done.set(record.id, page.id);
        result.pages++;
        await writeBody(record, page.id);
      }
      return db.id;
    }
    const page = await request('pages', {
      parent: dataSource
        ? { type: 'data_source_id', data_source_id: dataSource }
        : { type: 'page_id', page_id: parentId },
      properties: { title: { title: richText(snapshot.name) } },
    });
    done.set(snapshot.id, page.id);
    result.pages++;
    if (snapshot.id === root.id)
      result.url =
        page.url ?? `https://www.notion.so/${page.id.replaceAll('-', '')}`;
    await writeBody(snapshot, page.id);
    return page.id;
  };
  try {
    // Database roots get a containing page so a destination page remains a
    // fresh, inspectable boundary even if a later transfer operation fails.
    if (root.kind === 'database') {
      const wrapper = await request('pages', {
        parent: { type: 'page_id', page_id: parent },
        properties: { title: { title: richText(root.name) } },
      });
      result.url =
        wrapper.url ??
        `https://www.notion.so/${wrapper.id.replaceAll('-', '')}`;
      await create(root, wrapper.id, true);
    } else await create(root, parent, false);
    result.complete = true;
  } catch (cause) {
    result.error = cause instanceof Error ? cause.message : 'Transfer failed.';
  }
  result.warnings = [...warnings];
  return result;
};
