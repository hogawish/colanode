import { useRef } from 'react';
import { useDrop } from 'react-dnd';
import { toast } from 'sonner';

import { BoardViewColumnRecords } from '@colanode/ui/components/databases/boards/board-view-column-records';
import { useBoardView } from '@colanode/ui/contexts/board-view';
import { useDatabase } from '@colanode/ui/contexts/database';
import { useDatabaseView } from '@colanode/ui/contexts/database-view';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import {
  boardRecordDragType,
  getBoardMoveValue,
  isEditableBoardGroup,
  type BoardRecordDrag,
} from '@colanode/ui/lib/board-drag';
import { cn } from '@colanode/ui/lib/utils';

export const BoardViewColumn = () => {
  const boardView = useBoardView();
  const { field, columnValue } = boardView;
  const workspace = useWorkspace();
  const database = useDatabase();
  const view = useDatabaseView();

  const moveRecord = async (item: BoardRecordDrag) => {
    const record = workspace.collections.nodes.get(item.recordId);
    if (record?.type !== 'record' || record.databaseId !== database.id) return;
    const value = getBoardMoveValue(
      field.type,
      record.fields[field.id],
      item.column,
      columnValue
    );
    if (value === undefined) return;
    try {
      const result = await window.colanode.executeMutation({
        type: 'record.field.set',
        userId: workspace.userId,
        recordId: item.recordId,
        databaseId: database.id,
        fieldId: field.id,
        value,
      });
      if (!result.success) throw new Error(result.error.message);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not move the card.'
      );
    }
  };

  const [{ isOver }, drop] = useDrop<
    BoardRecordDrag,
    object,
    { isOver: boolean }
  >(
    () => ({
      accept: boardRecordDragType,
      canDrop: (item) =>
        isEditableBoardGroup(field.type) &&
        item.canMoveBetweenColumns !== false &&
        item.userId === workspace.userId &&
        item.databaseId === database.id &&
        item.viewId === view.id &&
        item.fieldId === field.id &&
        item.column !== columnValue,
      drop: (item, monitor) => {
        if (!monitor.didDrop()) void moveRecord(item);
        return {};
      },
      collect: (monitor) => ({
        isOver: monitor.isOver() && monitor.canDrop(),
      }),
    }),
    [workspace, database.id, view.id, field, columnValue]
  );

  const divRef = useRef<HTMLDivElement>(null);
  drop(divRef);
  const dragOverClass = boardView.dragOverClass ?? 'bg-muted';

  return (
    <div
      ref={divRef}
      className={cn('min-h-[400px] border-r p-1', isOver ? dragOverClass : '')}
      style={{
        minWidth: '250px',
        maxWidth: '250px',
        width: '250px',
      }}
    >
      <div className="flex flex-row items-center gap-2">{boardView.header}</div>
      <BoardViewColumnRecords />
    </div>
  );
};
