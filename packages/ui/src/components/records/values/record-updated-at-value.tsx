// Modified: fall back to creation time when no update exists.
import { UpdatedAtFieldAttributes } from '@colanode/core';
import { useRecord } from '@colanode/ui/contexts/record';

interface RecordUpdatedAtValueProps {
  field: UpdatedAtFieldAttributes;
}

export const RecordUpdatedAtValue = ({ field }: RecordUpdatedAtValueProps) => {
  const record = useRecord();
  const updatedAt = new Date(record.updatedAt ?? record.createdAt);

  return (
    <div className="h-full w-full p-0 text-sm" data-field={field.id}>
      <p>
        {updatedAt?.toLocaleDateString()} {updatedAt?.toLocaleTimeString()}
      </p>
    </div>
  );
};
