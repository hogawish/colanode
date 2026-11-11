// Modified: update one record field using the latest local attributes.
import type { FieldValue } from '@colanode/core';

export type RecordFieldSetMutationInput = {
  type: 'record.field.set';
  userId: string;
  recordId: string;
  databaseId: string;
  fieldId: string;
  value: FieldValue | null;
};

declare module '@colanode/client/mutations' {
  interface MutationMap {
    'record.field.set': {
      input: RecordFieldSetMutationInput;
      output: { success: boolean };
    };
  }
}
