import '@colanode/ui/styles/editor.css';

import { UndoRedo } from '@tiptap/extensions';
import { EditorContent, useEditor } from '@tiptap/react';
import { useState } from 'react';

import { buildEditorContent, mapContentsToBlocks } from '@colanode/client/lib';
import type { RichTextContent } from '@colanode/core';
import { Button } from '@colanode/ui/components/ui/button';
import {
  BlockquoteNode,
  BoldMark,
  BulletListNode,
  CodeBlockNode,
  CodeMark,
  ColorMark,
  DividerNode,
  DocumentNode,
  HardBreakNode,
  Heading1Node,
  Heading2Node,
  Heading3Node,
  HighlightMark,
  IdExtension,
  ItalicMark,
  LinkMark,
  ListItemNode,
  OrderedListNode,
  ParagraphNode,
  StrikethroughMark,
  TableCellNode,
  TableHeaderNode,
  TableNode,
  TableRowNode,
  TaskItemNode,
  TaskListNode,
  TextNode,
  UnderlineMark,
} from '@colanode/ui/editor/extensions';
import { ToolbarMenu } from '@colanode/ui/editor/menus';

interface SharedPageEditorProps {
  pageId: string;
  content: RichTextContent | null;
  onSave: (content: RichTextContent) => Promise<void>;
  onCancel: () => void;
}

export const SharedPageEditor = ({
  pageId,
  content,
  onSave,
  onCancel,
}: SharedPageEditorProps) => {
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const editor = useEditor({
    extensions: [
      IdExtension,
      DocumentNode,
      TextNode,
      ParagraphNode,
      HardBreakNode,
      Heading1Node,
      Heading2Node,
      Heading3Node,
      BlockquoteNode,
      BulletListNode,
      OrderedListNode,
      ListItemNode,
      CodeBlockNode,
      TaskListNode,
      TaskItemNode,
      TableNode,
      TableRowNode,
      TableCellNode,
      TableHeaderNode,
      DividerNode,
      UndoRedo,
      LinkMark,
      BoldMark,
      ItalicMark,
      UnderlineMark,
      StrikethroughMark,
      CodeMark,
      ColorMark,
      HighlightMark,
    ],
    content: buildEditorContent(pageId, content),
    editorProps: { attributes: { class: 'min-h-32 focus:outline-none' } },
    onUpdate: () => setDirty(true),
  });

  const save = async () => {
    if (!editor || !dirty || busy) return;
    setBusy(true);
    setError('');
    editor.setEditable(false);
    try {
      const indexMap = new Map(
        Object.entries(content?.blocks ?? {}).map(([id, block]) => [
          id,
          block.index,
        ])
      );
      const blocks = mapContentsToBlocks(
        pageId,
        editor.getJSON().content ?? [],
        indexMap
      );
      await onSave({ type: 'rich_text', blocks });
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Could not save the page.'
      );
      editor.setEditable(true);
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {editor && <ToolbarMenu editor={editor} />}
      <div className="rounded-md border p-3">
        <EditorContent editor={editor} />
      </div>
      <div className="flex gap-2">
        <Button disabled={!dirty || busy} onClick={() => void save()}>
          Save changes
        </Button>
        <Button disabled={busy} variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
};
