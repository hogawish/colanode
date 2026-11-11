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
