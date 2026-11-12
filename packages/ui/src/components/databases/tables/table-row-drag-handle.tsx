import { GripVertical } from 'lucide-react';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { useDrag, useDrop } from 'react-dnd';

import { useDatabase } from '@colanode/ui/contexts/database';
import { useDatabaseView } from '@colanode/ui/contexts/database-view';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import {
  databaseRecordDragMime,
  getRecordDropSide,
} from '@colanode/ui/lib/database-drag';
import { cn } from '@colanode/ui/lib/utils';

const dragType = 'table-record';
type RowDrag = {
  recordIds: string[];
  userId: string;
  databaseId: string;
  viewId: string;
};

export const TableRowDragHandle = ({
  row,
  recordId,
  selectedIds,
  name,
  onReorder,
}: {
  row: RefObject<HTMLDivElement | null>;
  recordId: string;
  selectedIds?: string[];
  name: string;
  onReorder: (
    recordIds: string[],
    anchorId: string,
    side: 'before' | 'after'
  ) => void;
}) => {
  const { userId } = useWorkspace();
  const { id: databaseId } = useDatabase();
  const { id: viewId } = useDatabaseView();
  const [side, setSide] = useState<'before' | 'after'>('before');
  const handle = useRef<HTMLButtonElement>(null);
  const [, drag] = useDrag<RowDrag>(
    () => ({
      type: dragType,
      item: {
        recordIds: selectedIds ?? [recordId],
        userId,
        databaseId,
        viewId,
      },
    }),
    [recordId, selectedIds, userId, databaseId, viewId]
  );
  const [{ isOver }, drop] = useDrop<RowDrag, object, { isOver: boolean }>(
    () => ({
      accept: dragType,
      canDrop: (item) =>
        !item.recordIds.includes(recordId) &&
        item.userId === userId &&
        item.databaseId === databaseId &&
        item.viewId === viewId,
      hover: (_, monitor) => {
        if (monitor.canDrop())
          setSide(getRecordDropSide(row.current, monitor.getClientOffset()?.y));
      },
      drop: (item, monitor) => {
        onReorder(
          item.recordIds,
          recordId,
          getRecordDropSide(row.current, monitor.getClientOffset()?.y)
        );
        return {};
      },
      collect: (monitor) => ({
        isOver: monitor.isOver({ shallow: true }) && monitor.canDrop(),
      }),
    }),
    [row, recordId, userId, databaseId, viewId, onReorder]
  );

  drag(handle);
  useEffect(() => {
    drop(row.current);
    return () => {
      drop(null);
    };
  }, [drop, row]);

  return (
    <>
      <button
        type="button"
        ref={handle}
        className="flex h-8 w-7 shrink-0 cursor-grab items-center justify-center text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label={`Reorder ${name}`}
        title={
          selectedIds && selectedIds.length > 1
            ? 'Drag to reorder selected rows'
            : 'Drag to reorder'
        }
        onDragStart={(event) =>
          event.dataTransfer.setData(databaseRecordDragMime, '1')
        }
      >
        <GripVertical className="size-4" />
      </button>
      {isOver && (
        <div
          className={cn(
            'pointer-events-none absolute inset-x-0 z-10 border-t-2 border-primary',
            side === 'before' ? 'top-0' : 'bottom-0'
          )}
        />
      )}
    </>
  );
};
