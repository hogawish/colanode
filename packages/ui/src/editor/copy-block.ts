import type { Editor } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { toast } from 'sonner';

import { findNodePosById } from '@colanode/client/lib';

const referenceTypes = new Set([
  'page',
  'database',
  'folder',
  'file',
  'tempFile',
]);

export const copyBlock = async (editor: Editor, blockId: string | null) => {
  if (!blockId) return;
  const { state, view } = editor;
  const pos = findNodePosById(state.doc, blockId);
  if (pos == null) return;

  const selection = NodeSelection.create(state.doc, pos);
  let hasReference = referenceTypes.has(selection.node.type.name);
  selection.node.descendants((node) => {
    if (referenceTypes.has(node.type.name)) hasReference = true;
    return !hasReference;
  });
  if (hasReference) {
    toast.error('Use Copy link to block to reference the original.');
    return;
  }

  try {
    const { dom, text } = view.serializeForClipboard(selection.content());
    dom
      .querySelectorAll('[data-id]')
      .forEach((node) => node.removeAttribute('data-id'));
    if (navigator.clipboard.write && typeof ClipboardItem !== 'undefined') {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([dom.innerHTML], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        }),
      ]);
    } else {
      await navigator.clipboard.writeText(text);
    }
    toast.success('Block copied');
  } catch {
    toast.error('Could not copy the block.');
  }
};
