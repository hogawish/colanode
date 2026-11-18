import '@colanode/ui/styles/editor.css';

import { useBlocker } from '@tanstack/react-router';
import { UndoRedo } from '@tiptap/extensions';
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react';
import { isEqual } from 'lodash-es';
import { useEffect, useRef, useState } from 'react';

import { buildEditorContent, mapContentsToBlocks } from '@colanode/client/lib';
import type { RichTextContent } from '@colanode/core';
import { DocumentBlockMenu } from '@colanode/ui/components/documents/document-block-menu';
import { Button } from '@colanode/ui/components/ui/button';
import { sharedDocumentEditorClass } from '@colanode/ui/editor/classes';
import {
  BlockquoteCommand,
  BulletListCommand,
  CodeBlockCommand,
  DividerCommand,
  Heading1Command,
  Heading2Command,
  Heading3Command,
  OrderedListCommand,
  ParagraphCommand,
  TableCommand,
  TodoCommand,
  ToggleCommand,
} from '@colanode/ui/editor/commands';
import {
  createExternalReferenceCommand,
  ExternalReferenceDialog,
  type ExternalReferenceRequest,
} from '@colanode/ui/editor/commands/external-reference';
import {
  AutoJoiner,
  BlockquoteNode,
  BoldMark,
  BulletListNode,
  CodeBlockNode,
  CodeMark,
  ColorMark,
  CommanderExtension,
  DividerNode,
  DocumentNode,
  DropcursorExtension,
  HardBreakNode,
  Heading1Node,
  Heading2Node,
  Heading3Node,
  HighlightMark,
  IdExtension,
  ItalicMark,
  LinkMark,
  ListItemNode,
  ListKeymapExtension,
  Markdown,
  OrderedListNode,
  ParserExtension,
  ParagraphNode,
  PlaceholderExtension,
  StrikethroughMark,
  TabKeymapExtension,
  TableCellNode,
  TableHeaderNode,
  TableNode,
  TableRowNode,
  TaskItemNode,
  TaskListNode,
  TextNode,
  ToggleNode,
  UnderlineMark,
} from '@colanode/ui/editor/extensions';
import { sharedPageReferenceNodes } from '@colanode/ui/editor/extensions/shared-page-reference';
import { ActionMenu, ToolbarMenu } from '@colanode/ui/editor/menus';

interface SharedPageEditorProps {
  pageId: string;
  content: RichTextContent;
  onSave: (content: RichTextContent) => Promise<void>;
  onUnsupported: () => void;
}

const referenceTypes = new Set(['page', 'database', 'file']);
export const SharedPageEditor = ({
  pageId,
  content,
  onSave,
  onUnsupported,
}: SharedPageEditorProps) => {
  const [externalReference, setExternalReference] =
    useState<ExternalReferenceRequest | null>(null);
  const [pending, setPending] = useState<JSONContent | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [unsupported, setUnsupported] = useState(false);
  const referencePlacement = useRef(
    Object.values(content.blocks).filter((block) =>
      referenceTypes.has(block.type)
    )
  );
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  const indexes = useRef(
    new Map(Object.values(content.blocks).map(({ id, index }) => [id, index]))
  );
  const [saved, setSaved] = useState<JSONContent | null>(null);
  const lastAttempt = useRef<JSONContent | null>(null);

  const editor = useEditor({
    extensions: [
      IdExtension,
      ParserExtension,
      Markdown,
      DocumentNode,
      ...sharedPageReferenceNodes,
      ToggleNode,
      TextNode,
      ParagraphNode,
      HardBreakNode,
      Heading1Node,
      Heading2Node,
      Heading3Node,
      BlockquoteNode,
      CodeBlockNode,
      BulletListNode,
      TabKeymapExtension,
      ListItemNode,
      ListKeymapExtension,
      OrderedListNode,
      PlaceholderExtension.configure({
        message: "Write something or '/' for commands",
      }),
      TaskListNode,
      TaskItemNode,
      TableNode,
      TableRowNode,
      TableCellNode,
      TableHeaderNode,
      DividerNode,
      LinkMark,
      DropcursorExtension,
      AutoJoiner,
      UndoRedo,
      CommanderExtension.configure({
        commands: [
          ParagraphCommand,
          Heading1Command,
          Heading2Command,
          Heading3Command,
          BlockquoteCommand,
          BulletListCommand,
          CodeBlockCommand,
          OrderedListCommand,
          TableCommand,
          DividerCommand,
          TodoCommand,
          ToggleCommand,
          createExternalReferenceCommand(setExternalReference),
        ],
      }),
      BoldMark,
      ItalicMark,
      UnderlineMark,
      StrikethroughMark,
      CodeMark,
      HighlightMark,
      ColorMark,
    ],
    content: buildEditorContent(pageId, content),
    enableContentCheck: true,
    onContentError: () => setUnsupported(true),
    onCreate: ({ editor }) => {
      const initial = editor.getJSON();
      try {
        const blocks = mapContentsToBlocks(
          pageId,
          initial.content ?? [],
          indexes.current
        );
        if (
          [...indexes.current.keys()].some((id) => !Object.hasOwn(blocks, id))
        ) {
          setUnsupported(true);
          return;
        }
        setSaved(initial);
      } catch {
        setUnsupported(true);
      }
    },
    editorProps: {
      attributes: { class: sharedDocumentEditorClass, spellCheck: 'false' },
    },
    shouldRerenderOnTransaction: false,
    onUpdate: ({ editor, transaction }) => {
      if (transaction.docChanged) setPending(editor.getJSON());
    },
  });

  const dirty = pending !== null && (saving || !isEqual(pending, saved));
  useBlocker({
    enableBeforeUnload: dirty,
    shouldBlockFn: ({ current, next }) =>
      dirty &&
      current.pathname !== next.pathname &&
      !window.confirm('Changes are still unsaved. Leave this page?'),
  });

  useEffect(() => {
    if (unsupported || !saved || !pending || saving) return;
    if (isEqual(pending, saved)) {
      setError('');
      return;
    }
    if (lastAttempt.current === pending) return;

    const timer = window.setTimeout(async () => {
      lastAttempt.current = pending;
      setSaving(true);
      setError('');
      try {
        const blocks = mapContentsToBlocks(
          pageId,
          pending.content ?? [],
          indexes.current
        );
        if (
          referencePlacement.current.some((reference) => {
            const current = blocks[reference.id];
            return (
              !current ||
              current.parentId !== reference.parentId ||
              current.index !== reference.index
            );
          })
        ) {
          throw new Error(
            'Undo the move or removal of the embedded item to save this page.'
          );
        }
        const editable = Object.fromEntries(
          Object.entries(blocks).filter(
            ([, block]) => !referenceTypes.has(block.type)
          )
        );
        await saveRef.current({ type: 'rich_text', blocks: editable });
        indexes.current = new Map(
          Object.values(blocks).map(({ id, index }) => [id, index])
        );
        setSaved(pending);
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : 'Could not save the page.'
        );
      } finally {
        setSaving(false);
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [pageId, pending, saved, saving, unsupported]);

  useEffect(() => {
    if (unsupported) onUnsupported();
  }, [unsupported, onUnsupported]);

  if (unsupported) {
    return (
      <p role="alert" className="text-sm text-destructive">
        This page contains blocks this editor cannot open.
      </p>
    );
  }

  return (
    <>
      {editor && (
        <>
          <ToolbarMenu editor={editor} />
          <ActionMenu editor={editor} documentId={pageId} />
        </>
      )}
      <DocumentBlockMenu editor={editor} documentId={pageId}>
        <EditorContent editor={editor} />
      </DocumentBlockMenu>
      {externalReference && (
        <ExternalReferenceDialog
          request={externalReference}
          onClose={() => setExternalReference(null)}
        />
      )}
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        {error ? (
          <>
            <p role="alert" className="text-destructive">
              {error}
            </p>
            {dirty && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  lastAttempt.current = null;
                  setPending((value) => value && { ...value });
                }}
              >
                Retry save
              </Button>
            )}
          </>
        ) : (
          <p role="status">{dirty ? 'Saving changes…' : 'Changes saved'}</p>
        )}
      </div>
    </>
  );
};
