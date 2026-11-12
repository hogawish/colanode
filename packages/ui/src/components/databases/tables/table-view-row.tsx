import { useRef } from 'react';

import { LocalRecordNode } from '@colanode/client/types';
import { extractNodeRole } from '@colanode/core';
import { TableRowDragHandle } from '@colanode/ui/components/databases/tables/table-row-drag-handle';
import { useTableSelection } from '@colanode/ui/components/databases/tables/table-selection';
import { TableViewNameCell } from '@colanode/ui/components/databases/tables/table-view-name-cell';
import { RecordFieldValue } from '@colanode/ui/components/records/record-field-value';
import { RecordProvider } from '@colanode/ui/components/records/record-provider';
import { Checkbox } from '@colanode/ui/components/ui/checkbox';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@colanode/ui/components/ui/context-menu';
import { useDatabase } from '@colanode/ui/contexts/database';
import { useDatabaseView } from '@colanode/ui/contexts/database-view';
import { useWorkspace } from '@colanode/ui/contexts/workspace';

interface TableViewRowProps {
  index: number;
  record: LocalRecordNode;
  onReorder?: (
    recordId: string,
    anchorId: string,
    side: 'before' | 'after'
  ) => void;
}

export const TableViewRow = ({
  index,
  record,
  onReorder,
}: TableViewRowProps) => {
  const workspace = useWorkspace();
  const database = useDatabase();
  const view = useDatabaseView();
  const role = extractNodeRole(record, workspace.userId) ?? database.role;
  const selection = useTableSelection();
  const row = useRef<HTMLDivElement>(null);

  return (
    <RecordProvider record={record} role={role}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={row}
            data-selected={selection.selected.has(record.id)}
            className="relative animate-fade-in flex flex-row items-center gap-0.5 border-b data-[selected=true]:bg-accent/50"
          >
            {onReorder && (
              <TableRowDragHandle
                row={row}
                recordId={record.id}
                name={record.name || `row ${index + 1}`}
                onReorder={onReorder}
              />
            )}
            <span
              className="flex cursor-pointer items-center justify-center text-sm text-muted-foreground"
              style={{ width: '30px', minWidth: '30px' }}
            >
              <Checkbox
                aria-label={`Select ${record.name || `row ${index + 1}`}`}
                checked={selection.selected.has(record.id)}
                onClick={(event) => {
                  event.preventDefault();
                  selection.toggle(record, event.shiftKey);
                }}
              />
            </span>
            <div
              className="h-8 border-r overflow-hidden"
              style={{ width: `${view.nameWidth}px`, minWidth: '300px' }}
            >
              <TableViewNameCell record={record} />
            </div>
            {view.fields.map((field) => {
              return (
                <div
                  key={`row-${record.id}-${field.field.id}`}
                  className="h-8 border-r p-1 overflow-hidden"
                  style={{ width: `${field.width}px` }}
                >
                  <RecordFieldValue field={field.field} />
                </div>
              );
            })}
            <div className="w-8" />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            onSelect={() => selection.openAction(record, 'edit')}
          >
            Edit{' '}
            {selection.selected.has(record.id) ? 'selected rows' : 'this row'}
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => selection.openAction(record, 'delete')}
          >
            Delete{' '}
            {selection.selected.has(record.id) ? 'selected rows' : 'this row'}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </RecordProvider>
  );
};
