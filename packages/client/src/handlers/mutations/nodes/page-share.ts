import { WorkspaceMutationHandlerBase } from '@colanode/client/handlers/mutations/workspace-mutation-handler-base';
import { parseApiError } from '@colanode/client/lib/ky';
import type { MutationHandler } from '@colanode/client/lib/types';
import { MutationError, MutationErrorCode } from '@colanode/client/mutations';
import type {
  PageShareInvitation,
  PageShareMutationInput,
  PageShareMutationOutput,
  PageShareViewer,
  SharedDatabase,
  SharedPage,
} from '@colanode/client/mutations/nodes/page-share';

export class PageShareMutationHandler
  extends WorkspaceMutationHandlerBase
  implements MutationHandler<PageShareMutationInput>
{
  async handleMutation(
    input: PageShareMutationInput
  ): Promise<PageShareMutationOutput> {
    const workspace = this.getWorkspace(input.userId);
    const client = workspace.account.client;
    const path = `v1/workspaces/${workspace.workspaceId}/page-shares/${encodeURIComponent(input.pageId)}`;

    try {
      switch (input.action) {
        case 'read':
          return {
            action: 'read',
            page: await client.get(path).json<SharedPage>(),
          };
        case 'read-database':
          return {
            action: 'read-database',
            database: await client
              .get(`${path}/databases/${encodeURIComponent(input.databaseId)}`)
              .json<SharedDatabase>(),
          };
        case 'read-linked-database':
          return {
            action: 'read-database',
            database: await client
              .get(
                `${path}/linked-databases/${encodeURIComponent(input.blockId)}`
              )
              .json<SharedDatabase>(),
          };
        case 'list': {
          const { viewers, invitations } = await client
            .get(`${path}/viewers`)
            .json<{
              viewers: PageShareViewer[];
              invitations: PageShareInvitation[];
            }>();
          return { action: 'list', viewers, invitations };
        }
        case 'set':
          await client.put(`${path}/viewers`, {
            json: { viewerId: input.viewerId, enabled: input.enabled },
          });
          return { action: 'set' };
        case 'invite': {
          const result = await client
            .post(`${path}/invitations`, {
              json: { email: input.email, role: input.role },
            })
            .json<{ token?: string }>();
          return { action: 'invite', token: result.token };
        }
        case 'cancel-invitation':
          await client.delete(`${path}/invitations`, {
            json: { email: input.email },
          });
          return { action: 'cancel-invitation' };
        case 'edit':
          await client.put(path, {
            json: { revision: input.revision, content: input.content },
          });
          return { action: 'edit' };
      }
    } catch (error) {
      const apiError = await parseApiError(error);
      throw new MutationError(MutationErrorCode.ApiError, apiError.message);
    }
  }
}
