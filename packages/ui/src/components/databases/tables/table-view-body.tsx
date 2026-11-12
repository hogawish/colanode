import { useRef, useState } from 'react';
import { InView } from 'react-intersection-observer';
import { toast } from 'sonner';

import { orderRecordIds } from '@colanode/client/lib';
import type { LocalRecordNode } from '@colanode/client/types';
import { TableBulkActions } from '@colanode/ui/components/databases/tables/table-bulk-actions';
import { TableSelectionContext } from '@colanode/ui/components/databases/tables/table-selection';
import { TableViewEmptyPlaceholder } from '@colanode/ui/components/databases/tables/table-view-empty-placeholder';
import { TableViewHeader } from '@colanode/ui/components/databases/tables/table-view-header';
import { TableViewRow } from '@colanode/ui/components/databases/tables/table-view-row';
import { Checkbox } from '@colanode/ui/components/ui/checkbox';
import { useDatabase } from '@colanode/ui/contexts/database';
import { useDatabaseView } from '@colanode/ui/contexts/database-view';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { useRecordsQuery } from '@colanode/ui/hooks/use-records-query';

export const TableViewBody = () => {
  const view = useDatabaseView();
  const key = JSON.stringify([view.id, view.filters, view.sorts]);
  return view.manualSort ? (
    <ManualTableBody key={key} />
  ) : (
    <SortedTableBody key={key} />
  );
};

const SortedTableBody = () => {
  const view = useDatabaseView();
  const query = useRecordsQuery(view.filters, view.sorts);
  return <SelectableTableBody query={query} />;
};

const EMPTY_ORDER: readonly string[] = [];

const ManualTableBody = () => {
  const view = useDatabaseView();
  const workspace = useWorkspace();
  const database = useDatabase();
  const order = view.manualRowOrder ?? EMPTY_ORDER;
  // Fetch saved rows separately so a row moved above page one stays there
  // after reload, even when the property sort would put it on a later page.
  const ranked = useRecordsQuery(view.filters, view.sorts, order.length + 1, {
    mode: 'include',
    values: order,
  });
  const unranked = useRecordsQuery(view.filters, view.sorts, undefined, {
    mode: 'exclude',
    values: order,
  });
  const byId = new Map(ranked.data.map((record) => [record.id, record]));
  const records = [
    ...orderRecordIds([...byId.keys()], order).map((id) => byId.get(id)!),
    ...unranked.data.filter((record) => !byId.has(record.id)),
  ];
  const reorder = async (
    recordId: string,
    anchorId: string,
    side: 'before' | 'after'
  ) => {
    try {
      const result = await window.colanode.executeMutation({
        type: 'table.order.update',
        action: 'reorder',
        userId: workspace.userId,
        databaseId: database.id,
        viewId: view.id,
        visibleIds: records.map((record) => record.id),
        recordId,
        anchorId,
        side,
      });
      if (!result.success) throw new Error(result.error.message);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not save the row order.'
      );
    }
  };
  return (
    <SelectableTableBody
      query={{
        ...unranked,
        data: records,
        isLoading: ranked.isLoading || unranked.isLoading,
        isError: ranked.isError || unranked.isError,
      }}
      onReorder={database.canEdit && !database.isLocked ? reorder : undefined}
    />
  );
};

const SelectableTableBody = ({
  query,
  onReorder,
}: {
  query: ReturnType<typeof useRecordsQuery>;
  onReorder?: (
    recordId: string,
    anchorId: string,
    side: 'before' | 'after'
  ) => void;
}) => {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = query;
  const records = data;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [request, setRequest] = useState<{
    action: 'edit' | 'delete';
    serial: number;
  } | null>(null);
  const anchor = useRef<string | null>(null);
  const selectedRecords = records.filter((record) => selected.has(record.id));
  const toggle = (record: LocalRecordNode, shift = false) => {
    const start = records.findIndex((item) => item.id === anchor.current);
    const end = records.findIndex((item) => item.id === record.id);
    setSelected((current) => {
      const next = new Set(current);
      if (shift && start >= 0 && end >= 0) {
        for (const item of records.slice(
          Math.min(start, end),
          Math.max(start, end) + 1
        ))
          next.add(item.id);
      } else if (next.has(record.id)) next.delete(record.id);
      else next.add(record.id);
      return next;
    });
    anchor.current = record.id;
  };

  return (
    <TableSelectionContext.Provider
      value={{
        selected,
        toggle,
        openAction: (record, action) => {
          if (!selected.has(record.id)) setSelected(new Set([record.id]));
          setRequest((previous) => ({
            action,
            serial: (previous?.serial ?? 0) + 1,
          }));
        },
      }}
    >
      <TableBulkActions
        records={selectedRecords}
        request={request}
        clearSelection={(completed) =>
          setSelected((current) =>
            completed
              ? new Set([...current].filter((id) => !completed.has(id)))
              : new Set()
          )
        }
      />
      <TableViewHeader
        showDragHandle={!!onReorder}
        selection={
          <Checkbox
            aria-label="Select loaded rows"
            checked={
              records.length > 0 && selectedRecords.length === records.length
                ? true
                : selectedRecords.length > 0
                  ? 'indeterminate'
                  : false
            }
            disabled={records.length === 0}
            onCheckedChange={(checked) =>
              setSelected(
                checked
                  ? new Set(records.map((record) => record.id))
                  : new Set()
              )
            }
          />
        }
      />
      <div className="border-t">
        {records.length === 0 && <TableViewEmptyPlaceholder />}
        {records.map((record, index) => (
          <TableViewRow
            key={record.id}
            index={index}
            record={record}
            onReorder={onReorder}
          />
        ))}
        <InView
          rootMargin="200px"
          onChange={(inView) => {
            if (inView && hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
        ></InView>
      </div>
    </TableSelectionContext.Provider>
  );
};
