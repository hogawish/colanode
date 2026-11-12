import { useMemo } from 'react';
import { toast } from 'sonner';

import { boardColumnOrderKey, orderBoardCardIds } from '@colanode/client/lib';
import { extractNodeRole } from '@colanode/core';
import { BoardViewRecordCard } from '@colanode/ui/components/databases/boards/board-view-record-card';
import { BoardViewRecordCreateCard } from '@colanode/ui/components/databases/boards/board-view-record-create-card';
import { RecordProvider } from '@colanode/ui/components/records/record-provider';
import { useBoardView } from '@colanode/ui/contexts/board-view';
import { useDatabase } from '@colanode/ui/contexts/database';
import { useDatabaseView } from '@colanode/ui/contexts/database-view';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { useRecordsQuery } from '@colanode/ui/hooks/use-records-query';

export const BoardViewColumnRecords = () => {
  const workspace = useWorkspace();
  const database = useDatabase();
  const view = useDatabaseView();
  const boardView = useBoardView();

  const filters = useMemo(
    () => [...view.filters, boardView.filter],
    [view.filters, boardView.filter]
  );

  const { data } = useRecordsQuery(filters, view.sorts);
  const key = boardColumnOrderKey(boardView.field.id, boardView.columnValue);
  const savedOrder = view.boardCardOrder?.[key];
  const records = useMemo(() => {
    if (!savedOrder?.length) return data;
    const byId = new Map(data.map((record) => [record.id, record]));
    return orderBoardCardIds([...byId.keys()], savedOrder).map((id) =>
      byId.get(id)!
    );
  }, [data, savedOrder]);

  const reorder = async (
    recordId: string,
    anchorId: string,
    side: 'before' | 'after'
  ) => {
    try {
      const result = await window.colanode.executeMutation({
        type: 'board.card.reorder',
        userId: workspace.userId,
        databaseId: database.id,
        viewId: view.id,
        fieldId: boardView.field.id,
        column: boardView.columnValue,
        visibleIds: records.map((record) => record.id),
        recordId,
        anchorId,
        side,
      });
      if (!result.success) throw new Error(result.error.message);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not save the card order.'
      );
    }
  };

  return (
    <div className="mt-3 flex flex-col gap-2">
      {records.map((record) => {
        const role = extractNodeRole(record, workspace.userId) ?? database.role;

        return (
          <RecordProvider key={record.id} record={record} role={role}>
            <BoardViewRecordCard
              onReorder={
                database.canEdit && !database.isLocked ? reorder : undefined
              }
            />
          </RecordProvider>
        );
      })}
      <BoardViewRecordCreateCard filters={filters} />
    </div>
  );
};
