import { WorkspaceMutationHandlerBase } from '@colanode/client/handlers/mutations/workspace-mutation-handler-base';
import { MutationHandler } from '@colanode/client/lib/types';
import {
  MutationError,
  MutationErrorCode,
  SpaceChildArchiveMutationInput,
} from '@colanode/client/mutations';
import { SpaceAttributes } from '@colanode/core';

export class SpaceChildArchiveMutationHandler
  extends WorkspaceMutationHandlerBase
  implements MutationHandler<SpaceChildArchiveMutationInput>
{
  async handleMutation(input: SpaceChildArchiveMutationInput) {
    const workspace = this.getWorkspace(input.userId);
    const child = await workspace.database
      .selectFrom('nodes')
      .where('id', '=', input.childId)
      .where('root_id', '=', input.spaceId)
      .where('type', 'in', ['page', 'database', 'folder', 'channel'])
      .select('id')
      .executeTakeFirst();

    if (!child) {
      throw new MutationError(
        MutationErrorCode.NodeNotFound,
        'This item is no longer in the space.'
      );
    }

    const result = await workspace.nodes.updateNode<SpaceAttributes>(
      input.spaceId,
      (attributes) => {
        const children = attributes.children ?? {};
        const current = children[child.id];
        if (Boolean(current?.archived) === input.archived) {
          return attributes;
        }

        const updated = { ...current, id: child.id };
        if (input.archived) {
          updated.archived = true;
        } else {
          delete updated.archived;
        }

        return {
          ...attributes,
          children: { ...children, [child.id]: updated },
        };
      }
    );

    if (result === 'unauthorized') {
      throw new MutationError(
        MutationErrorCode.SpaceUpdateForbidden,
        'A space admin can archive or restore this item.'
      );
    }
    if (result !== 'success') {
      throw new MutationError(
        MutationErrorCode.SpaceUpdateFailed,
        'Could not save the archive status.'
      );
    }
    return { success: true };
  }
}
