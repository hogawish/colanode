import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { Editor, Node as TiptapNode } from '@tiptap/core';
import TiptapDocument from '@tiptap/extension-document';
import TiptapText from '@tiptap/extension-text';
import { NodeSelection } from '@tiptap/pm/state';
import { EditorContent } from '@tiptap/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DocumentBlockMenu } from '@colanode/ui/components/documents/document-block-menu';
import { IdExtension } from '@colanode/ui/editor/extensions/id';
import { ParagraphNode } from '@colanode/ui/editor/extensions/paragraph';
import { ActionMenu } from '@colanode/ui/editor/menus/action-menu';
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
  HTMLElement.prototype.getBoundingClientRect = () =>
    new DOMRect(0, 0, 200, 20);
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
  const mountHandle = () => {
    const editor = createEditor();
    render(
      <>
        <EditorContent editor={editor} />
        <ActionMenu editor={editor} documentId="page" />
      </>
    );
    editor.view.dom.getBoundingClientRect = () => new DOMRect(100, 0, 400, 400);
    const target = findBlockElement(editor, 'second')!;
    target.getBoundingClientRect = () => new DOMRect(100, 40, 400, 20);
    let position = 0;
    editor.state.doc.descendants((node, pos) => {
      if (node.attrs.id === 'second') position = pos;
    });
    vi.spyOn(editor.view, 'posAtCoords').mockReturnValue({
      pos: position + 1,
      inside: position,
    });
    fireEvent.mouseMove(target, { clientX: 120, clientY: 50 });
    return editor;
  };

  it('opens the block menu by clicking the handle and copies that block', async () => {
    const editor = mountHandle();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Block actions' })
    );
    expect(editor.state.selection).toBeInstanceOf(NodeSelection);
    expect((editor.state.selection as NodeSelection).node.attrs.id).toBe(
      'second'
    );
    expect(findBlockElement(editor, 'second')).toHaveClass(
      'ProseMirror-selectednode'
    );
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Copy link to block' })
    );
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        buildBlockLink(window.location.origin, 'workspace', 'page', 'second')
      )
    );
  });

  it('keeps a toggle child targeted while moving sideways to its handle, then can target the parent header', async () => {
    const Toggle = TiptapNode.create({
      name: 'toggle',
      group: 'block',
      content: 'paragraph block*',
      addAttributes: () => ({ id: { default: null } }),
      renderHTML: ({ HTMLAttributes }) => [
        'section',
        { 'data-id': HTMLAttributes.id },
        0,
      ],
    });
    const editor = new Editor({
      extensions: [
        TiptapDocument,
        ParagraphNode,
        TiptapText,
        IdExtension,
        Toggle,
      ],
      content: {
        type: 'doc',
        content: [
          {
            type: 'toggle',
            attrs: { id: 'parent' },
            content: ['summary', 'child'].map((id) => ({
              type: 'paragraph',
              attrs: { id },
              content: [{ type: 'text', text: id }],
            })),
          },
        ],
      },
    });
    editors.push(editor);
    render(
      <>
        <EditorContent editor={editor} />
        <ActionMenu editor={editor} documentId="page" />
      </>
    );
    editor.view.dom.getBoundingClientRect = () => new DOMRect(100, 0, 400, 400);
    const positions: Record<string, number> = {};
    editor.state.doc.descendants((node, pos) => {
      if (node.attrs.id) positions[node.attrs.id] = pos;
    });
    const parent = findBlockElement(editor, 'parent')!;
    const child = findBlockElement(editor, 'child')!;
    parent.getBoundingClientRect = () => new DOMRect(120, 40, 380, 100);
    child.getBoundingClientRect = () => new DOMRect(150, 70, 350, 20);
    vi.spyOn(editor.view, 'posAtCoords').mockImplementation(({ left }) =>
      left >= 150
        ? { pos: positions.child! + 1, inside: positions.child! }
        : { pos: positions.summary! + 1, inside: positions.summary! }
    );
    fireEvent.mouseMove(child, { clientX: 160, clientY: 80 });
    const handle = await screen.findByRole('button', { name: 'Block actions' });
    handle.parentElement!.getBoundingClientRect = () =>
      new DOMRect(95, 68, 40, 24);
    fireEvent.mouseMove(parent, { clientX: 125, clientY: 80 });
    fireEvent.click(handle);
    expect((editor.state.selection as NodeSelection).node.attrs.id).toBe(
      'child'
    );
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Copy link to block' })
    );
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(
        buildBlockLink(window.location.origin, 'workspace', 'page', 'child')
      )
    );
    fireEvent.mouseMove(parent, { clientX: 125, clientY: 45 });
    fireEvent.click(screen.getByRole('button', { name: 'Block actions' }));
    expect((editor.state.selection as NodeSelection).node.attrs.id).toBe(
      'parent'
    );
  });

  it('keeps handle dragging separate from clicking and allows the next click', async () => {
    const editor = mountHandle();
    const handle = await screen.findByRole('button', { name: 'Block actions' });
    const transfer = {
      clearData: vi.fn(),
      setData: vi.fn(),
      setDragImage: vi.fn(),
      effectAllowed: '',
    };
    fireEvent.dragStart(handle, { dataTransfer: transfer });
    expect(transfer.setData).toHaveBeenCalledWith('text/plain', 'second');
    expect(editor.view.dragging).not.toBeNull();
    fireEvent.dragEnd(handle);
    fireEvent.click(handle);
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
    fireEvent.pointerDown(handle);
    fireEvent.click(handle);
    expect(
      await screen.findByRole('menuitem', { name: 'Copy link to block' })
    ).toBeInTheDocument();
  });

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

  it('waits for a pending NodeView to have layout before scrolling', async () => {
    let ready = false;
    let notifyResize = () => {};
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          notifyResize = callback;
        }
        observe() {}
        disconnect() {}
      }
    );
    const editor = createEditor();
    state.hash = 'block=second';
    const target = findBlockElement(editor, 'second')!;
    target.getBoundingClientRect = () =>
      new DOMRect(0, 500, 200, ready ? 20 : 0);
    render(
      <DocumentBlockMenu editor={editor} documentId="page">
        <EditorContent editor={editor} />
      </DocumentBlockMenu>
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
    act(() => {
      ready = true;
      notifyResize();
    });
    await waitFor(() =>
      expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledTimes(1)
    );
    expect(
      vi.mocked(HTMLElement.prototype.scrollIntoView).mock.contexts[0]
    ).toBe(target);
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
