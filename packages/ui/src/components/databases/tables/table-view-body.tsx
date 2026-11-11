import { useRef, useState } from 'react';
import { InView } from 'react-intersection-observer';

import type { LocalRecordNode } from '@colanode/client/types';
import { TableBulkActions } from '@colanode/ui/components/databases/tables/table-bulk-actions';
import { TableSelectionContext } from '@colanode/ui/components/databases/tables/table-selection';
import { TableViewEmptyPlaceholder } from '@colanode/ui/components/databases/tables/table-view-empty-placeholder';
import { TableViewHeader } from '@colanode/ui/components/databases/tables/table-view-header';
import { TableViewRow } from '@colanode/ui/components/databases/tables/table-view-row';
import { Checkbox } from '@colanode/ui/components/ui/checkbox';
import { useDatabaseView } from '@colanode/ui/contexts/database-view';
import { useRecordsQuery } from '@colanode/ui/hooks/use-records-query';

export const TableViewBody = () => {
  const view = useDatabaseView();
  return (
    <SelectableTableBody
      key={JSON.stringify([view.id, view.filters, view.sorts])}
    />
  );
};

const SelectableTableBody = () => {
  const view = useDatabaseView();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useRecordsQuery(view.filters, view.sorts);

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
          <TableViewRow key={record.id} index={index} record={record} />
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
