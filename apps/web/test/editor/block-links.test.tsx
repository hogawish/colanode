import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { Editor } from '@tiptap/core';
import TiptapDocument from '@tiptap/extension-document';
import TiptapText from '@tiptap/extension-text';
import { EditorContent } from '@tiptap/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DocumentBlockMenu } from '@colanode/ui/components/documents/document-block-menu';
import { IdExtension } from '@colanode/ui/editor/extensions/id';
import { ParagraphNode } from '@colanode/ui/editor/extensions/paragraph';
import {
  blockAtTarget,
  buildBlockLink,
  findBlockElement,
  readBlockHash,
} from '@colanode/ui/lib/block-links';

const state = vi.hoisted(() => ({ hash: '' }));
vi.mock('@tanstack/react-router', () => ({ useRouterState: () => state.hash }));
vi.mock('@colanode/ui/contexts/workspace', () => ({
  useWorkspace: () => ({ workspaceId: 'workspace' }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const editors: Editor[] = [];
const createEditor = () => {
  const editor = new Editor({
    extensions: [TiptapDocument, ParagraphNode, TiptapText, IdExtension],
    content: {
      type: 'doc',
      content: ['first', 'second'].map((id) => ({
        type: 'paragraph',
        attrs: { id },
        content: [{ type: 'text', text: id }],
      })),
    },
  });
  editors.push(editor);
  return editor;
};
beforeEach(() => {
  state.hash = '';
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.animate = vi.fn().mockReturnValue({ cancel: vi.fn() });
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
  window.scrollBy = vi.fn();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
    setTimeout(() => cb(0), 0)
  );
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});
afterEach(() => {
  act(() => {
    for (const editor of editors.splice(0)) editor.destroy();
  });
});

describe('stable block links', () => {
  it('copies the right-clicked block rather than the previous caret position', async () => {
    const editor = createEditor();
    render(
      <DocumentBlockMenu editor={editor} documentId="page">
        <EditorContent editor={editor} />
      </DocumentBlockMenu>
    );
    act(() => {
      editor.commands.setTextSelection(2);
    });
    fireEvent.contextMenu(findBlockElement(editor, 'second')!);
    fireEvent.click(await screen.findByText('Copy link to block'));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        buildBlockLink(window.location.origin, 'workspace', 'page', 'second')
      )
    );
  });

  it('retains the block target after editing and moving the block, including reload', () => {
    const editor = createEditor();
    render(<EditorContent editor={editor} />);
    const blocks = editor.getJSON().content!;
    act(() => {
      editor.commands.setContent({
        type: 'doc',
        content: [blocks[1]!, blocks[0]!],
      });
      editor.commands.insertContentAt(1, 'changed ');
    });
    expect(findBlockElement(editor, 'second')).toHaveTextContent(
      'changed second'
    );
    const restored = new Editor({
      extensions: [TiptapDocument, ParagraphNode, TiptapText, IdExtension],
      content: editor.getJSON(),
    });
    editors.push(restored);
    render(<EditorContent editor={restored} />);
    expect(findBlockElement(restored, 'second')).toHaveTextContent(
      'changed second'
    );
    expect(blockAtTarget(restored, findBlockElement(restored, 'second'))).toBe(
      'second'
    );
  });

  it('scrolls to the block on a direct link and on same-page navigation', async () => {
    const editor = createEditor();
    state.hash = 'block=second';
    const view = render(
      <DocumentBlockMenu editor={editor} documentId="page">
        <EditorContent editor={editor} />
      </DocumentBlockMenu>
    );
    await waitFor(() =>
      expect(HTMLElement.prototype.animate).toHaveBeenCalledTimes(1)
    );
    expect(vi.mocked(HTMLElement.prototype.animate).mock.contexts[0]).toBe(
      findBlockElement(editor, 'second')
    );
    state.hash = 'block=first';
    view.rerender(
      <DocumentBlockMenu editor={editor} documentId="page">
        <EditorContent editor={editor} />
      </DocumentBlockMenu>
    );
    await waitFor(() =>
      expect(HTMLElement.prototype.animate).toHaveBeenCalledTimes(2)
    );
    expect(vi.mocked(HTMLElement.prototype.animate).mock.contexts[1]).toBe(
      findBlockElement(editor, 'first')
    );
    expect(editor.getJSON().content?.[0]?.attrs?.id).toBe('first');
  });

  it('handles malformed links and removed blocks without jumping to another block', () => {
    expect(readBlockHash('#block=%ZZ')).toBeNull();
    expect(readBlockHash('#other=second')).toBeNull();
    expect(readBlockHash('#block=second')).toBe('second');
    const editor = createEditor();
    render(<EditorContent editor={editor} />);
    expect(findBlockElement(editor, 'deleted')).toBeNull();
  });
});
