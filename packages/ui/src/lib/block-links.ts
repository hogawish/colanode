// Modified: stable, single-block links using the existing document block IDs.
import type { Editor } from '@tiptap/core';

export const buildBlockLink = (
  origin: string,
  workspaceId: string,
  documentId: string,
  blockId: string
) => {
  const url = new URL(
    `/${encodeURIComponent(workspaceId)}/${encodeURIComponent(documentId)}`,
    origin
  );
  url.hash = `block=${encodeURIComponent(blockId)}`;
  return url.href;
};

export const readBlockHash = (hash: string): string | null => {
  if (!hash.replace(/^#/, '').startsWith('block=')) return null;
  try {
    return decodeURIComponent(hash.replace(/^#/, '').slice(6)) || null;
  } catch {
    return null;
  }
};

export const readLocalBlockLink = (href: string, base: string) => {
  try {
    const url = new URL(href, base);
    if (url.origin !== new URL(base).origin || !readBlockHash(url.hash)) {
      return null;
    }
    const path = /^\/([a-z0-9]+wc)\/(?:(shared)\/)?([a-z0-9]+)\/?$/.exec(
      url.pathname
    );
    if (!path) return null;
    return {
      workspaceId: path[1]!,
      documentId: path[3]!,
      shared: path[2] === 'shared',
      hash: url.hash.slice(1),
    };
  } catch {
    return null;
  }
};

export const blockAtTarget = (editor: Editor, target: EventTarget | null) => {
  if (!(target instanceof Node) || !editor.view.dom.contains(target))
    return null;
  try {
    const pos = editor.view.posAtDOM(target, 0);
    const resolved = editor.state.doc.resolve(pos);
    const after = resolved.nodeAfter;
    if (after?.isBlock && after.isAtom && typeof after.attrs.id === 'string') {
      return after.attrs.id;
    }
    for (let depth = resolved.depth; depth > 0; depth--) {
      const node = resolved.node(depth);
      if (node.isBlock && typeof node.attrs.id === 'string')
        return node.attrs.id;
    }
  } catch {
    // A nested editor or a widget outside the document has no block target.
  }
  return null;
};

export const findBlockElement = (
  editor: Editor,
  blockId: string
): HTMLElement | null => {
  let element: HTMLElement | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (node.attrs.id !== blockId) return;
    const dom = editor.view.nodeDOM(pos);
    if (dom instanceof HTMLElement) element = dom;
    return false;
  });
  return element;
};

export const highlightBlock = (element: HTMLElement) => {
  let details = element.parentElement?.closest('details');
  while (details) {
    details.open = true;
    details = details.parentElement?.closest('details');
  }
  element.scrollIntoView({ block: 'center', behavior: 'auto' });
  // Avoid DOM class/style mutations that ProseMirror can interpret as edits.
  return element.animate?.(
    [
      { outline: '2px solid #3b82f6', outlineOffset: '3px' },
      { outline: '2px solid #3b82f6', outlineOffset: '3px', offset: 0.8 },
      { outline: '2px solid transparent', outlineOffset: '3px' },
    ],
    { duration: 2000 }
  );
};
