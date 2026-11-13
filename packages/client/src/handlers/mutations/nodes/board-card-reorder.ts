import { WorkspaceMutationHandlerBase } from '@colanode/client/handlers/mutations/workspace-mutation-handler-base';
import type { MutationHandler } from '@colanode/client/lib/types';
import {
  boardColumnOrderKey,
  moveRecordInOrder,
} from '@colanode/client/lib/view-record-order';
import type { BoardCardReorderMutationInput } from '@colanode/client/mutations/nodes/board-card-reorder';
import type { DatabaseViewAttributes } from '@colanode/core';

export class BoardCardReorderMutationHandler
  extends WorkspaceMutationHandlerBase
  implements MutationHandler<BoardCardReorderMutationInput>
{
  async handleMutation(input: BoardCardReorderMutationInput) {
    const workspace = this.getWorkspace(input.userId);
    const key = boardColumnOrderKey(input.fieldId, input.column);
    const result = await workspace.nodes.updateNode<DatabaseViewAttributes>(
      input.viewId,
      (view) => {
        if (
          view.type !== 'database_view' ||
          view.layout !== 'board' ||
          view.parentId !== input.databaseId ||
          view.groupBy !== input.fieldId
        ) {
          throw new Error(
            'This board has changed. Try dragging the card again.'
          );
        }
        const current = view.boardCardOrder?.[key] ?? [];
        const next = moveRecordInOrder(
          current,
          input.visibleIds,
          input.recordId,
          input.anchorId,
          input.side
        );
        return next
          ? { ...view, boardCardOrder: { ...view.boardCardOrder, [key]: next } }
          : view;
      }
    );
    if (result !== 'success')
      throw new Error(`Could not save the card order: ${result}`);
    return { success: true };
  }
}
