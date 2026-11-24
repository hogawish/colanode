import type { JSONContent } from '@tiptap/core';

import { buildEditorContent } from '@colanode/client/lib';
import type { PageExportSnapshot } from '@colanode/core';
import { readExternalReference } from '@colanode/ui/lib/external-reference';
import { markExportAttachment } from '@colanode/ui/lib/notion-attachments';

const backgrounds: Record<string, string> = {
  gray: '#f3f4f6',
  brown: '#efebe9',
  orange: '#ffedd5',
  yellow: '#fef9c3',
  green: '#dcfce7',
  blue: '#dbeafe',
  purple: '#f3e8ff',
  pink: '#fce7f3',
  red: '#fee2e2',
};
const colors: Record<string, string> = {
  gray: '#4b5563',
  brown: '#795548',
  orange: '#c2410c',
  yellow: '#a16207',
  green: '#15803d',
  blue: '#1d4ed8',
  purple: '#7e22ce',
  pink: '#be185d',
  red: '#b91c1c',
};
const safeHref = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value, window.location.href);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)
      ? url.href
      : null;
  } catch {
    return null;
  }
};

// Serialize stored blocks, not a mounted/paginated view. This deliberately has
// no React hooks, SQLite cache reads, UI controls, or fetching side effects.
export const renderNotionExportDocument = (
  snapshot: PageExportSnapshot,
  items: ReadonlyMap<string, PageExportSnapshot>,
  sourceUrl: (id: string) => string
) => {
  const source = document.createElement('section');
  source.style.color = '#222';
  source.style.backgroundColor = 'white';
  const files = new Map(snapshot.files.map((file) => [file.id, file]));
  const referenced = new Set<string>();
  const reference = (id: string, fallback: string) => {
    referenced.add(id);
    const link = document.createElement('a');
    link.textContent = items.get(id)?.name ?? fallback;
    link.href = sourceUrl(id);
    return link;
  };
  const render = (node: JSONContent): Node => {
    if (node.type === 'text') {
      let result: Node = document.createTextNode(node.text ?? '');
      for (const mark of node.marks ?? []) {
        const tag =
          (
            {
              bold: 'strong',
              italic: 'em',
              underline: 'u',
              strike: 's',
              code: 'code',
            } as Record<string, string>
          )[mark.type] ?? 'span';
        const wrapper = document.createElement(
          mark.type === 'link' ? 'a' : tag
        );
        if (mark.type === 'link') {
          const href = safeHref(mark.attrs?.href);
          if (href) wrapper.setAttribute('href', href);
        }
        if (mark.type === 'color')
          wrapper.style.color = colors[String(mark.attrs?.color)] ?? '';
        if (mark.type === 'highlight')
          wrapper.style.backgroundColor =
            backgrounds[String(mark.attrs?.highlight)] ?? '';
        wrapper.appendChild(result);
        result = wrapper;
      }
      return result;
    }
    const id = String(node.attrs?.id ?? '');
    if (node.type === 'file') {
      const file = files.get(id);
      const element = document.createElement('div');
      element.dataset.id = id;
      if (file) markExportAttachment(element, file);
      if (!file) element.dataset.exportFileUnavailable = 'true';
      else if (file.subtype === 'image') {
        element.dataset.exportImageId = id;
        element.dataset.exportImageName = file.name;
      } else {
        markExportAttachment(element, file);
        element.appendChild(reference(id, file.name));
      }
      return element;
    }
    if (
      node.type === 'page' ||
      node.type === 'folder' ||
      node.type === 'database'
    ) {
      return reference(
        String(node.attrs?.sourceDatabaseId ?? id),
        node.type === 'database' ? 'Database' : 'Page'
      );
    }
    const tag =
      (
        {
          doc: 'div',
          paragraph: 'p',
          heading1: 'h1',
          heading2: 'h2',
          heading3: 'h3',
          bulletList: 'ul',
          orderedList: 'ol',
          listItem: 'li',
          taskList: 'ul',
          taskItem: 'li',
          blockquote: 'blockquote',
          codeBlock: 'pre',
          horizontalRule: 'hr',
          hardBreak: 'br',
          table: 'table',
          tableRow: 'tr',
          tableHeader: 'th',
          tableCell: 'td',
          toggle: 'details',
          mention: 'span',
        } as Record<string, string>
      )[node.type ?? ''] ?? 'div';
    const element = document.createElement(tag);
    if (id) element.dataset.id = id;
    element.style.backgroundColor =
      backgrounds[String(node.attrs?.blockBackground)] ?? '';
    for (const attr of ['colspan', 'rowspan', 'start']) {
      if (node.attrs?.[attr] !== undefined)
        element.setAttribute(attr, String(node.attrs[attr]));
    }
    if (node.type === 'taskItem')
      element.appendChild(
        document.createTextNode(node.attrs?.checked ? '☑ ' : '☐ ')
      );
    let children = node.content ?? [];
    if (node.type === 'toggle') {
      const summary = document.createElement('summary');
      const first = children[0];
      if (first?.attrs?.id) summary.dataset.id = first.attrs.id;
      for (const child of first?.content ?? [])
        summary.appendChild(render(child));
      element.appendChild(summary);
      children = children.slice(1);
      element.setAttribute('open', '');
    }
    if (node.type === 'mention')
      element.textContent = String(
        node.attrs?.label ?? node.attrs?.name ?? node.attrs?.id ?? 'Mention'
      );
    for (const child of children) element.appendChild(render(child));
    const external = readExternalReference(node.attrs?.externalRef);
    if (external?.provider === 'direct-image') {
      const image = document.createElement('img');
      image.src = external.sourceUrl;
      image.alt = 'External image';
      element.prepend(image);
    } else if (
      external?.provider === 'drive' &&
      !element.textContent?.includes(external.sourceUrl)
    ) {
      const link = document.createElement('a');
      link.href = external.sourceUrl;
      link.textContent = external.sourceUrl;
      element.appendChild(link);
    }
    return element;
  };
  source.appendChild(render(buildEditorContent(snapshot.id, snapshot.content)));
  // Some children exist only in the sidebar. Give those the same portable
  // hierarchy without pretending they were embedded blocks in the original.
  const unplaced = snapshot.children.filter(
    (child) => !referenced.has(child.id) && items.has(child.id)
  );
  if (unplaced.length) {
    const list = document.createElement('ul');
    for (const child of unplaced) {
      const row = document.createElement('li');
      row.appendChild(reference(child.id, child.name));
      list.appendChild(row);
    }
    source.appendChild(list);
  }
  return source;
};

export const exportBodyText = (snapshot: PageExportSnapshot) => {
  const walk = (node: JSONContent): string =>
    node.type === 'text'
      ? (node.text ?? '')
      : (node.content ?? [])
          .map(walk)
          .join(
            ['paragraph', 'heading1', 'heading2', 'heading3'].includes(
              node.type ?? ''
            )
              ? ''
              : '\n'
          );
  return walk(buildEditorContent(snapshot.id, snapshot.content));
};
