import { useCallback, useRef, useState } from 'react';
import { useDrag, useDrop } from 'react-dnd';

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

export const BoardViewRecordCard = ({
  onReorder,
}: {
  onReorder?: (
    recordId: string,
    anchorId: string,
    side: 'before' | 'after'
  ) => void;
}) => {
  const view = useDatabaseView();
  const boardView = useBoardView();
  const record = useRecord();
  const workspace = useWorkspace();
  const canMoveBetweenColumns =
    record.canEdit && isEditableBoardGroup(boardView.field.type);
  const canReorder = !!onReorder;
  const canDrag = canMoveBetweenColumns || canReorder;
  const card = useRef<HTMLDivElement | null>(null);
  const [side, setSide] = useState<'before' | 'after'>('before');
  const { columnValue, field } = boardView;

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
        canMoveBetweenColumns,
      },
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    }),
    [
      canDrag,
      canMoveBetweenColumns,
      record.id,
      record.databaseId,
      workspace.userId,
      view.id,
      boardView.field.id,
      boardView.columnValue,
    ]
  );

  const getSide = (y: number | undefined) => {
    const bounds = card.current?.getBoundingClientRect();
    return bounds && y !== undefined && y > bounds.top + bounds.height / 2
      ? 'after'
      : 'before';
  };
  const [{ isDropTarget }, drop] = useDrop<
    BoardRecordDrag,
    object,
    { isDropTarget: boolean }
  >(
    () => ({
      accept: boardRecordDragType,
      canDrop: (item) =>
        !!onReorder &&
        item.recordId !== record.id &&
        item.userId === workspace.userId &&
        item.databaseId === record.databaseId &&
        item.viewId === view.id &&
        item.fieldId === field.id &&
        item.column === columnValue,
      hover: (_, monitor) => {
        if (monitor.canDrop()) setSide(getSide(monitor.getClientOffset()?.y));
      },
      drop: (item, monitor) => {
        onReorder?.(
          item.recordId,
          record.id,
          getSide(monitor.getClientOffset()?.y)
        );
        return {};
      },
      collect: (monitor) => ({
        isDropTarget: monitor.isOver({ shallow: true }) && monitor.canDrop(),
      }),
    }),
    [
      onReorder,
      record.id,
      record.databaseId,
      workspace.userId,
      view.id,
      field.id,
      columnValue,
    ]
  );

  const setCardRef = useCallback(
    (node: HTMLDivElement | null) => {
      card.current = node;
      drag(canDrag ? node : null);
      drop(canReorder ? node : null);
    },
    [canDrag, canReorder, drag, drop]
  );
  const name = record.name;
  const hasName = name !== null && name !== '';

  return (
    <div
      ref={setCardRef}
      role="presentation"
      key={record.id}
      onDragStart={(event) => {
        if (canDrag) event.dataTransfer.setData(boardRecordDragMime, '1');
      }}
      className={cn(
        'relative animate-fade-in flex cursor-pointer flex-col gap-1 rounded-md border p-2 text-left hover:bg-accent',
        canDrag && 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-50'
      )}
    >
      {isDropTarget && (
        <div
          className={cn(
            'pointer-events-none absolute inset-x-0 z-10 border-t-2 border-primary',
            side === 'before' ? '-top-1' : '-bottom-1'
          )}
        />
      )}
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
