import { ArrowDownAz } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { ViewSortAddPopover } from '@colanode/ui/components/databases/search/view-sort-add-popover';
import { ViewSortFields } from '@colanode/ui/components/databases/search/view-sorts';
import { Button } from '@colanode/ui/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@colanode/ui/components/ui/popover';
import { useDatabase } from '@colanode/ui/contexts/database';
import { useDatabaseView } from '@colanode/ui/contexts/database-view';
import { useWorkspace } from '@colanode/ui/contexts/workspace';

export const ViewSortButton = () => {
  const view = useDatabaseView();

  if (view.layout === 'table') return <TableSortButton />;

  if (view.sorts.length > 0) {
    return (
      <button
        className="flex cursor-pointer items-center rounded-md p-1.5 hover:bg-accent"
        onClick={() => view.openSearchBar()}
      >
        <ArrowDownAz className="size-4" />
      </button>
    );
  }

  return (
    <ViewSortAddPopover>
      <button className="flex cursor-pointer items-center rounded-md p-1.5 hover:bg-accent">
        <ArrowDownAz className="size-4" />
      </button>
    </ViewSortAddPopover>
  );
};

const TableSortButton = () => {
  const view = useDatabaseView();
  const database = useDatabase();
  const { userId } = useWorkspace();
  const [pending, setPending] = useState(false);
  const canEdit = database.canEdit && !database.isLocked;
  const manual = view.manualSort === true;
  const setManual = async (value: boolean) => {
    if (!canEdit || value === manual || pending) return;
    setPending(true);
    try {
      const result = await window.colanode.executeMutation({
        type: 'table.order.update',
        action: 'set-mode',
        userId,
        databaseId: database.id,
        viewId: view.id,
        manual: value,
      });
      if (!result.success) throw new Error(result.error.message);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not change the sort mode.'
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Sort"
          title={manual ? 'Manual order' : 'Sort'}
          className="flex cursor-pointer items-center gap-1 rounded-md p-1.5 hover:bg-accent"
        >
          <ArrowDownAz className="size-4" />
          {manual && <span className="text-xs">Manual order</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="flex w-80 flex-col gap-2 p-2">
        <div role="group" aria-label="Sort mode" className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={manual ? 'outline' : 'secondary'}
            aria-pressed={!manual}
            disabled={!canEdit || pending}
            onClick={() => void setManual(false)}
          >
            Sort by property
          </Button>
          <Button
            type="button"
            size="sm"
            variant={manual ? 'secondary' : 'outline'}
            aria-pressed={manual}
            disabled={!canEdit || pending}
            onClick={() => void setManual(true)}
          >
            Manual order
          </Button>
        </div>
        {!manual && <ViewSortFields />}
      </PopoverContent>
    </Popover>
  );
};
