import { useCallback } from 'react';
import { useDrag } from 'react-dnd';

import { RecordFieldValue } from '@colanode/ui/components/records/record-field-value';
import { Link } from '@colanode/ui/components/ui/link';
import { useBoardView } from '@colanode/ui/contexts/board-view';
import { useDatabaseView } from '@colanode/ui/contexts/database-view';
import { useRecord } from '@colanode/ui/contexts/record';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import {
  boardRecordDragMime,
  boardRecordDragType,
  isEditableBoardGroup,
  type BoardRecordDrag,
} from '@colanode/ui/lib/board-drag';
import { cn } from '@colanode/ui/lib/utils';

export const BoardViewRecordCard = () => {
  const view = useDatabaseView();
  const boardView = useBoardView();
  const record = useRecord();
  const workspace = useWorkspace();
  const canDrag = record.canEdit && isEditableBoardGroup(boardView.field.type);

  const [{ isDragging }, drag] = useDrag<
    BoardRecordDrag,
    unknown,
    { isDragging: boolean }
  >(
    () => ({
      type: boardRecordDragType,
      canDrag,
      item: {
        recordId: record.id,
        userId: workspace.userId,
        databaseId: record.databaseId,
        viewId: view.id,
        fieldId: boardView.field.id,
        column: boardView.columnValue,
      },
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    }),
    [
      canDrag,
      record.id,
      record.databaseId,
      workspace.userId,
      view.id,
      boardView.field.id,
      boardView.columnValue,
    ]
  );

  const setCardRef = useCallback(
    (node: HTMLDivElement | null) => {
      drag(node);
    },
    [drag]
  );
  const name = record.name;
  const hasName = name !== null && name !== '';

  return (
    <div
      ref={canDrag ? setCardRef : null}
      role="presentation"
      key={record.id}
      onDragStart={(event) => {
        if (canDrag) event.dataTransfer.setData(boardRecordDragMime, '1');
      }}
      className={cn(
        'animate-fade-in flex cursor-pointer flex-col gap-1 rounded-md border p-2 text-left hover:bg-accent',
        canDrag && 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-50'
      )}
    >
      <Link
        from="/workspace/$userId/$nodeId"
        to="modal/$modalNodeId"
        params={{ modalNodeId: record.id }}
        draggable={false}
      >
        <p className={hasName ? '' : 'text-muted-foreground'}>
          {hasName ? name : 'Unnamed'}
        </p>
        {view.fields.length > 0 && (
          <div className="flex flex-col gap-1 mt-2">
            {view.fields.map((viewField) => {
              if (!viewField.display) {
                return null;
              }

              return (
                <div key={viewField.field.id}>
                  <RecordFieldValue field={viewField.field} readOnly={true} />
                </div>
              );
            })}
          </div>
        )}
      </Link>
    </div>
  );
};
