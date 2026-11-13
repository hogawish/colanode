import { Plus } from 'lucide-react';

import { FieldCreatePopover } from '@colanode/ui/components/databases/fields/field-create-popover';
import { TableViewFieldHeader } from '@colanode/ui/components/databases/tables/table-view-field-header';
import { TableViewNameHeader } from '@colanode/ui/components/databases/tables/table-view-name-header';
import { useDatabase } from '@colanode/ui/contexts/database';
import { useDatabaseView } from '@colanode/ui/contexts/database-view';

export const TableViewHeader = ({
  selection,
  showDragHandle,
}: {
  selection?: React.ReactNode;
  showDragHandle?: boolean;
}) => {
  const database = useDatabase();
  const view = useDatabaseView();

  return (
    <div className="flex flex-row items-center gap-0.5">
      {showDragHandle && <div className="w-7 shrink-0" />}
      <div
        className="flex justify-center"
        style={{ width: '30px', minWidth: '30px' }}
      >
        {selection}
      </div>
      <TableViewNameHeader />
      {view.fields.map((field) => {
        return <TableViewFieldHeader viewField={field} key={field.field.id} />;
      })}
      {database.canEdit && !database.isLocked && (
        <FieldCreatePopover
          button={<Plus className="ml-2 size-4 cursor-pointer" />}
        />
      )}
    </div>
  );
};
