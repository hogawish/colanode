// Modified: preserve unrelated fields and the existing node permission checks.
import { WorkspaceMutationHandlerBase } from '@colanode/client/handlers/mutations/workspace-mutation-handler-base';
import type { MutationHandler } from '@colanode/client/lib/types';
import type { RecordFieldSetMutationInput } from '@colanode/client/mutations/nodes/record-field-set';
import { fieldValueSchema, type RecordAttributes } from '@colanode/core';

export const setRecordField = (
  attributes: RecordAttributes,
  input: Pick<RecordFieldSetMutationInput, 'databaseId' | 'fieldId' | 'value'>
): RecordAttributes => {
  if (
    attributes.type !== 'record' ||
    attributes.databaseId !== input.databaseId
  ) {
    throw new Error('The record is no longer in this database.');
  }
  const fields = { ...attributes.fields };
  if (input.value === null) delete fields[input.fieldId];
  else fields[input.fieldId] = fieldValueSchema.parse(input.value);
  return { ...attributes, fields };
};

export class RecordFieldSetMutationHandler
  extends WorkspaceMutationHandlerBase
  implements MutationHandler<RecordFieldSetMutationInput>
{
  async handleMutation(input: RecordFieldSetMutationInput) {
    const workspace = this.getWorkspace(input.userId);
    const result = await workspace.nodes.updateNode<RecordAttributes>(
      input.recordId,
      (attributes) => setRecordField(attributes, input)
    );
    if (result !== 'success')
      throw new Error(`Could not update record: ${result}`);
    return { success: true };
  }
}
