import { fireEvent, render, screen } from '@testing-library/react';
import { Editor, JSONContent } from '@tiptap/core';
import TiptapBold from '@tiptap/extension-bold';
import TiptapDocument from '@tiptap/extension-document';
import TiptapText from '@tiptap/extension-text';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildEditorContent,
  mapContentsToBlocks,
} from '@colanode/client/lib/editor';
import { richTextContentSchema } from '@colanode/core';
import { encodeState, YDoc } from '@colanode/crdt';
import { BulletListNode } from '@colanode/ui/editor/extensions/bullet-list';
import { ColorMark } from '@colanode/ui/editor/extensions/color';
import { Heading1Node } from '@colanode/ui/editor/extensions/heading1';
import { Heading2Node } from '@colanode/ui/editor/extensions/heading2';
import { Heading3Node } from '@colanode/ui/editor/extensions/heading3';
import { IdExtension } from '@colanode/ui/editor/extensions/id';
import { ListItemNode } from '@colanode/ui/editor/extensions/list-item';
import { OrderedListNode } from '@colanode/ui/editor/extensions/ordered-list';
import { ParagraphNode } from '@colanode/ui/editor/extensions/paragraph';
import { TaskItemNode } from '@colanode/ui/editor/extensions/task-item';
import { TaskListNode } from '@colanode/ui/editor/extensions/task-list';
import { BlockFormatControls } from '@colanode/ui/editor/menus/block-format-controls';
import {
  convertBlock,
  findFormattingBlock,
  formatBlockText,
  setBlockBackground,
} from '@colanode/ui/lib/block-formatting';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
const editors: Editor[] = [];
const paragraph = (id: string, text: string): JSONContent => ({
  type: 'paragraph',
  attrs: { id },
  content: [{ type: 'text', text }],
});
const create = (content: JSONContent[]) => {
  const editor = new Editor({
    extensions: [
      TiptapDocument,
      TiptapText,
      ParagraphNode,
      Heading1Node,
      Heading2Node,
      Heading3Node,
      BulletListNode,
      OrderedListNode,
      ListItemNode,
      TaskListNode,
      TaskItemNode,
      TiptapBold,
      ColorMark,
      IdExtension,
    ],
    content: { type: 'doc', content },
  });
  editors.push(editor);
  editor.view.dom.scrollIntoView = vi.fn();
  return editor;
};
afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
});

describe('block actions', () => {
  it('exposes background and type conversion from the block menu', () => {
    const editor = create([paragraph('a', 'alpha')]);
    const done = vi.fn();
    render(
      <BlockFormatControls editor={editor} blockId="a" onApplied={done} />
    );
    fireEvent.click(screen.getByText('Background color'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Background: Blue' }));
    expect(findFormattingBlock(editor, 'a')!.node.attrs.blockBackground).toBe(
      'blue'
    );
    fireEvent.change(screen.getByRole('combobox', { name: 'Turn into' }), {
      target: { value: 'heading1' },
    });
    expect(findFormattingBlock(editor, 'a')!.node.type.name).toBe('heading1');
    expect(done).toHaveBeenCalledTimes(2);
  });

  it('keeps preview metadata when changing a linked paragraph into a heading and back', () => {
    const linked = paragraph('a', 'https://example.com');
    linked.attrs!.externalRef = { url: 'https://example.com', type: 'link' };
    const editor = create([linked]);
    const reference = findFormattingBlock(editor, 'a')!.node.attrs.externalRef;
    expect(convertBlock(editor, 'a', 'heading1')).toBe(true);
    expect(convertBlock(editor, 'a', 'paragraph')).toBe(true);
    expect(findFormattingBlock(editor, 'a')!.node.attrs.externalRef).toEqual(
      reference
    );
  });
  it('menu applies bold to the targeted block, retaining its ID and its neighbour', () => {
    const editor = create([paragraph('a', 'alpha'), paragraph('b', 'beta')]);
    const done = vi.fn();
    render(
      <BlockFormatControls editor={editor} blockId="b" onApplied={done} />
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Bold' }));
    expect(
      findFormattingBlock(editor, 'a')!.node.firstChild!.marks
    ).toHaveLength(0);
    expect(
      findFormattingBlock(editor, 'b')!.node.firstChild!.marks[0]!.type.name
    ).toBe('bold');
    expect(done).toHaveBeenCalledOnce();
    expect(formatBlockText(editor, 'b', 'bold')).toBe(true);
    expect(
      findFormattingBlock(editor, 'b')!.node.firstChild!.marks
    ).toHaveLength(0);
  });

  it('preserves formatting, background and ID through type changes and the actual CRDT save/reopen path', () => {
    const editor = create([paragraph('a', 'alpha')]);
    formatBlockText(editor, 'a', 'color', 'blue');
    setBlockBackground(editor, 'a', 'yellow');
    expect(convertBlock(editor, 'a', 'heading2')).toBe(true);
    const blocks = mapContentsToBlocks(
      'page',
      editor.getJSON().content!,
      new Map()
    );
    const ydoc = new YDoc();
    ydoc.update(richTextContentSchema, { type: 'rich_text', blocks });
    const reopened = new YDoc(encodeState(ydoc.getState()));
    const content = buildEditorContent('page', reopened.getObject());
    const next = create(content.content!);
    const saved = findFormattingBlock(next, 'a')!.node;
    expect(saved.type.name).toBe('heading2');
    expect(saved.textContent).toBe('alpha');
    expect(saved.attrs.blockBackground).toBe('yellow');
    expect(saved.firstChild!.marks[0]!.attrs.color).toBe('blue');
    expect(next.getHTML()).toContain('data-block-background="yellow"');
    expect(setBlockBackground(next, 'a', 'default')).toBe(true);
    expect(
      findFormattingBlock(next, 'a')!.node.attrs.blockBackground
    ).toBeNull();
  });

  it('converts only one item, keeps its nested list and does not change sibling items', () => {
    const editor = create([
      {
        type: 'bulletList',
        attrs: { id: 'list' },
        content: ['a', 'b', 'c'].map((id) => ({
          type: 'listItem',
          attrs: { id },
          content: [
            paragraph(id + '-text', id),
            ...(id === 'b'
              ? [
                  {
                    type: 'bulletList',
                    attrs: { id: 'nested' },
                    content: [
                      {
                        type: 'listItem',
                        attrs: { id: 'child' },
                        content: [paragraph('child-text', 'nested text')],
                      },
                    ],
                  },
                ]
              : []),
          ],
        })),
      },
    ]);
    expect(convertBlock(editor, 'b', 'taskList')).toBe(true);
    expect(findFormattingBlock(editor, 'a')!.node.type.name).toBe('listItem');
    expect(findFormattingBlock(editor, 'b')!.node.type.name).toBe('taskItem');
    expect(findFormattingBlock(editor, 'c')!.node.type.name).toBe('listItem');
    expect(findFormattingBlock(editor, 'nested')!.node.textContent).toBe(
      'nested text'
    );
    expect(convertBlock(editor, 'b', 'heading1')).toBe(true);
    expect(findFormattingBlock(editor, 'b')!.node.textContent).toBe('b');
    expect(findFormattingBlock(editor, 'child')!.node.textContent).toBe(
      'nested text'
    );
    const ids: string[] = [];
    editor.state.doc.descendants((node) => {
      if (node.attrs.id) ids.push(node.attrs.id);
    });
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps the link target when converting a paragraph into a list and back', () => {
    const editor = create([paragraph('a', 'alpha')]);
    expect(convertBlock(editor, 'a', 'orderedList')).toBe(true);
    expect(findFormattingBlock(editor, 'a')!.node.type.name).toBe('listItem');
    expect(convertBlock(editor, 'a', 'paragraph')).toBe(true);
    expect(findFormattingBlock(editor, 'a')!.node.type.name).toBe('paragraph');
    expect(editor.state.doc.textContent).toBe('alpha');
  });

  it('resolves a moved block by ID and refuses deleted or read-only targets', () => {
    const editor = create([paragraph('a', 'alpha'), paragraph('b', 'beta')]);
    editor.commands.insertContentAt(0, paragraph('new', 'before'));
    expect(setBlockBackground(editor, 'b', 'green')).toBe(true);
    expect(
      findFormattingBlock(editor, 'a')!.node.attrs.blockBackground
    ).toBeNull();
    expect(setBlockBackground(editor, 'missing', 'blue')).toBe(false);
    editor.setEditable(false);
    expect(convertBlock(editor, 'a', 'heading1')).toBe(false);
    expect(setBlockBackground(editor, 'a', 'blue')).toBe(false);
    expect(formatBlockText(editor, 'a', 'bold')).toBe(false);
  });
});
