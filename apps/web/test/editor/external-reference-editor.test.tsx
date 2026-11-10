import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Editor, type JSONContent } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Link from '@tiptap/extension-link';
import Text from '@tiptap/extension-text';
import { EditorContent } from '@tiptap/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { defaultClasses } from '@colanode/ui/editor/classes';
import {
  createExternalReferenceCommand,
  ExternalReferenceDialog,
  type ExternalReferenceRequest,
} from '@colanode/ui/editor/commands/external-reference';
import { BulletListNode } from '@colanode/ui/editor/extensions/bullet-list';
import { IdExtension } from '@colanode/ui/editor/extensions/id';
import { ListItemNode } from '@colanode/ui/editor/extensions/list-item';
import { ParagraphNode } from '@colanode/ui/editor/extensions/paragraph';
import { TableNode } from '@colanode/ui/editor/extensions/table';
import { TableCellNode } from '@colanode/ui/editor/extensions/table-cell';
import { TableHeaderNode } from '@colanode/ui/editor/extensions/table-header';
import { TableRowNode } from '@colanode/ui/editor/extensions/table-row';
import { TaskItemNode } from '@colanode/ui/editor/extensions/task-item';
import { TaskListNode } from '@colanode/ui/editor/extensions/task-list';
import { parseExternalReference } from '@colanode/ui/lib/external-reference';

const source = 'https://drive.google.com/file/d/ExampleFile_123/view';
const editors: Editor[] = [];
const paragraph = (id: string, text: string, reference?: unknown): JSONContent => ({
  type: 'paragraph',
  attrs: { id, ...(reference ? { externalRef: reference } : {}) },
  content: text ? [{ type: 'text', text, ...(reference ? { marks: [{ type: 'link', attrs: { href: text } }] } : {}) }] : [],
});
const positionOf = (editor: Editor, id: string) => {
  let found: number | undefined;
  editor.state.doc.descendants((node, pos) => { if (node.attrs.id === id) found = pos; });
  if (found === undefined) throw new Error(`Missing paragraph ${id}`);
  return found;
};
const mountEditor = (content: JSONContent[]) => {
  let editor!: Editor;
  act(() => {
    editor = new Editor({
      element: document.createElement('div'),
      extensions: [Document, ParagraphNode, Text, Link, IdExtension, BulletListNode, ListItemNode, TaskListNode, TaskItemNode, TableNode, TableRowNode, TableCellNode, TableHeaderNode],
      content: { type: 'doc', content },
      injectCSS: false,
    });
  });
  editors.push(editor);
  const result = render(<EditorContent editor={editor} />);
  return { editor, ...result };
};

beforeEach(() => {
  // JSDOM has no layout; editor behavior still uses the real Tiptap/PM DOM.
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  window.scrollBy = vi.fn();
});
afterEach(async () => {
  await act(async () => {
    for (const editor of editors.splice(0)) if (!editor.isDestroyed) editor.destroy();
    await Promise.resolve();
  });
});

describe('external reference editor integration', () => {
  it('keeps native paragraph DOM, ids, selection and the checked-task CSS selector', async () => {
    const { editor, container } = mountEditor([
      paragraph('plain', 'Normal paragraph'),
      { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph('list-text', 'List paragraph')] }] },
      { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: true }, content: [paragraph('task-text', 'Checked task')] }] },
      { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [paragraph('cell-text', 'Cell paragraph')] }] }] },
    ]);
    const selector = "ul[data-type='taskList'] li[data-checked='true'] > div > p";
    await waitFor(() => expect(container.querySelector('td p[data-id="cell-text"]')).not.toBeNull());
    expect(container.querySelector(selector)).toHaveAttribute('data-id', 'task-text');
    expect(container.querySelector('ul:not([data-type]) li p')).toHaveAttribute('data-id', 'list-text');
    for (const id of ['plain', 'list-text', 'task-text', 'cell-text']) {
      const element = container.querySelector(`[data-id="${id}"]`)!;
      expect(element.tagName).toBe('P');
      expect(element.className).toBe(defaultClasses.paragraph);
    }
    expect(container.querySelector('[data-external-reference-widget]')).toBeNull();
    act(() => { editor.commands.setTextSelection(2); editor.commands.insertContent('!'); });
    expect(editor.view.nodeDOM(0)?.nodeName).toBe('P');
    expect(container.querySelector('p[data-id="plain"]')).toHaveTextContent('N!ormal paragraph');
    expect(editor.state.selection.from).toBe(3);
  });

  it('updates and destroys widgets while keeping a checked task paragraph and mapped removal target', async () => {
    const { editor, container } = mountEditor([
      paragraph('before', 'Before'),
      { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: true }, content: [paragraph('reference', source, parseExternalReference(source))] }] },
      paragraph('after', 'After'),
    ]);
    await waitFor(() => expect(screen.getByTitle('Google Drive media preview')).toBeInTheDocument());
    const firstWidget = container.querySelector('[data-external-reference-widget]')!;
    const nextUrl = 'https://drive.google.com/file/d/SecondFile_456/view';
    act(() => {
      const pos = positionOf(editor, 'reference');
      const current = editor.state.doc.nodeAt(pos)!;
      const replacement = editor.schema.nodeFromJSON(paragraph('reference', nextUrl, parseExternalReference(nextUrl)));
      editor.view.dispatch(editor.state.tr.replaceWith(pos, pos + current.nodeSize, replacement));
    });
    await waitFor(() => expect(screen.getByTitle('Google Drive media preview')).toHaveAttribute('src', 'https://drive.google.com/file/d/SecondFile_456/preview'));
    await waitFor(() => expect(firstWidget).toBeEmptyDOMElement());
    expect(firstWidget.isConnected).toBe(false);
    const secondWidget = container.querySelector('[data-external-reference-widget]')!;
    act(() => { editor.view.dispatch(editor.state.tr.insert(0, editor.schema.nodeFromJSON(paragraph('remote', 'Remote prefix')))); });
    expect(container.querySelector("li[data-checked='true'] > div > p[data-id='reference']")).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Remove preview and keep link' }));
    await waitFor(() => expect(container.querySelector('[data-external-reference-widget]')).toBeNull());
    await waitFor(() => expect(secondWidget).toBeEmptyDOMElement());
    const current = editor.state.doc.nodeAt(positionOf(editor, 'reference'))!;
    expect(current.attrs.externalRef).toBeNull();
    expect(current.textContent).toBe(nextUrl);
    expect(current.firstChild?.marks[0]?.attrs.href).toBe(nextUrl);
    for (const [id, text] of [['before', 'Before'], ['after', 'After'], ['remote', 'Remote prefix']]) {
      expect(editor.state.doc.nodeAt(positionOf(editor, id))?.textContent).toBe(text);
    }
  });

  it('unmounts preview roots when the editor is destroyed', async () => {
    const { editor, container } = mountEditor([paragraph('reference', source, parseExternalReference(source))]);
    await waitFor(() => expect(screen.getByTitle('Google Drive media preview')).toBeInTheDocument());
    const widget = container.querySelector('[data-external-reference-widget]')!;
    await act(async () => { editor.destroy(); await Promise.resolve(); });
    expect(widget).toBeEmptyDOMElement();
  });

  it('consumes the slash token immediately and inserts at the mapped current selection after a remote edit', () => {
    const { editor } = mountEditor([paragraph('before', 'Before'), paragraph('command', '/embed'), paragraph('after', 'After')]);
    let request: ExternalReferenceRequest | undefined;
    const command = createExternalReferenceCommand((value) => { request = value; });
    act(() => {
      const from = positionOf(editor, 'command') + 1;
      editor.commands.setTextSelection(from + 6);
      command.handler({ editor, range: { from, to: from + 6 }, context: null });
    });
    expect(editor.getText()).not.toContain('/embed');
    expect(request).toEqual({ editor });
    const onClose = vi.fn();
    render(<ExternalReferenceDialog request={request!} onClose={onClose} />);
    act(() => { editor.view.dispatch(editor.state.tr.insert(0, editor.schema.nodeFromJSON(paragraph('remote', 'Remote prefix')))); });
    fireEvent.change(screen.getByRole('textbox', { name: 'Source URL' }), { target: { value: source } });
    fireEvent.submit(screen.getByRole('button', { name: 'Embed' }).closest('form')!);
    expect(onClose).toHaveBeenCalledOnce();
    for (const text of ['Before', 'After', 'Remote prefix', source]) expect(editor.getText()).toContain(text);
    const references: JSONContent[] = [];
    editor.state.doc.descendants((node) => { if (node.attrs.externalRef) references.push(node.toJSON()); });
    expect(references).toHaveLength(1);
    expect(references[0]?.attrs?.externalRef.sourceUrl).toBe(source);
  });

  it('cancels without leaving a slash token or deleting surrounding text', () => {
    const { editor } = mountEditor([paragraph('before', 'Before'), paragraph('command', '/embed'), paragraph('after', 'After')]);
    let request: ExternalReferenceRequest | undefined;
    const command = createExternalReferenceCommand((value) => { request = value; });
    act(() => {
      const from = positionOf(editor, 'command') + 1;
      editor.commands.setTextSelection(from + 6);
      command.handler({ editor, range: { from, to: from + 6 }, context: null });
    });
    const expected = editor.getJSON();
    const onClose = vi.fn();
    render(<ExternalReferenceDialog request={request!} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
    expect(editor.getJSON()).toEqual(expected);
    expect(editor.getText()).not.toContain('/embed');
    expect(editor.getText()).toContain('Before');
    expect(editor.getText()).toContain('After');
  });
});
