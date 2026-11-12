import { eq, useLiveQuery } from '@tanstack/react-db';
import type { Editor } from '@tiptap/core';
import { Database } from 'lucide-react';
import { useState } from 'react';

import type {
  EditorCommand,
  LocalDatabaseViewNode,
} from '@colanode/client/types';
import { generateId, IdType } from '@colanode/core';
import { DatabaseSelect } from '@colanode/ui/components/databases/database-select';
import { Button } from '@colanode/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@colanode/ui/components/ui/dialog';
import { useWorkspace } from '@colanode/ui/contexts/workspace';

export const createLinkedDatabaseCommand = (
  open: (editor: Editor) => void
): EditorCommand => ({
  key: 'linked-database',
  name: 'Linked database view',
  description: 'Embed an existing database view',
  keywords: ['database', 'linked', 'view', '既存', '参照', 'データベース'],
  icon: Database,
  disabled: false,
  handler({ editor, range }) {
    if (editor.isDestroyed || !editor.isEditable) return;
    editor.chain().deleteRange(range).run();
    open(editor);
  },
});

export const LinkedDatabaseDialog = ({
  editor,
  onClose,
}: {
  editor: Editor;
  onClose: () => void;
}) => {
  const { collections } = useWorkspace();
  const [databaseId, setDatabaseId] = useState<string | null>(null);
  const [viewId, setViewId] = useState('');
  const views = useLiveQuery(
    (query) =>
      query
        .from({ nodes: collections.nodes })
        .where(({ nodes }) => eq(nodes.type, 'database_view'))
        .where(({ nodes }) => eq(nodes.parentId, databaseId))
        .orderBy(
          ({ nodes }) => (nodes as unknown as LocalDatabaseViewNode).index,
          'asc'
        ),
    [collections.nodes, databaseId]
  );

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Linked database view</DialogTitle>
          <DialogDescription>
            Choose the database and its initial view.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!databaseId || editor.isDestroyed || !editor.isEditable) return;
            editor
              .chain()
              .focus()
              .insertContent({
                type: 'database',
                attrs: {
                  id: generateId(IdType.Block),
                  inline: true,
                  sourceDatabaseId: databaseId,
                  sourceViewId: viewId || null,
                },
              })
              .run();
            onClose();
          }}
        >
          <DatabaseSelect
            id={databaseId}
            onChange={(id) => {
              setDatabaseId(id);
              setViewId('');
            }}
          />
          {databaseId && views.data.length > 0 && (
            <label className="grid gap-1.5 text-sm">
              Initial view
              <select
                className="h-9 rounded-md border bg-background px-2"
                value={viewId}
                onChange={(event) => setViewId(event.target.value)}
              >
                <option value="">First view</option>
                {views.data.map((view) => (
                  <option key={view.id} value={view.id}>
                    {view.type === 'database_view' ? view.name : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Button type="submit" disabled={!databaseId}>
            Insert view
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
