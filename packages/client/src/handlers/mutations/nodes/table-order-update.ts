import { WorkspaceMutationHandlerBase } from '@colanode/client/handlers/mutations/workspace-mutation-handler-base';
import type { MutationHandler } from '@colanode/client/lib/types';
import { moveRecordInOrder } from '@colanode/client/lib/view-record-order';
import type { TableOrderUpdateMutationInput } from '@colanode/client/mutations/nodes/table-order-update';
import type { DatabaseViewAttributes } from '@colanode/core';

export class TableOrderUpdateMutationHandler
  extends WorkspaceMutationHandlerBase
  implements MutationHandler<TableOrderUpdateMutationInput>
{
  async handleMutation(input: TableOrderUpdateMutationInput) {
    const workspace = this.getWorkspace(input.userId);
    const result = await workspace.nodes.updateNode<DatabaseViewAttributes>(
      input.viewId,
      (view) => {
        if (
          view.type !== 'database_view' ||
          view.layout !== 'table' ||
          view.parentId !== input.databaseId
        ) {
          throw new Error('This view has changed.');
        }
        if (input.action === 'set-mode') {
          return { ...view, manualSort: input.manual };
        }
        if (!view.manualSort) {
          throw new Error('Choose Manual order before moving rows.');
        }
        const order = moveRecordInOrder(
          view.manualRowOrder ?? [],
          input.visibleIds,
          input.recordId,
          input.anchorId,
          input.side
        );
        return order ? { ...view, manualRowOrder: order } : view;
      }
    );
    if (result !== 'success')
      throw new Error(`Could not save the row order: ${result}`);
    return { success: true };
  }
}
