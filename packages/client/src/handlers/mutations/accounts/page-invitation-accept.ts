import { parseApiError } from '@colanode/client/lib/ky';
import type { MutationHandler } from '@colanode/client/lib/types';
import {
  MutationError,
  MutationErrorCode,
  type PageInvitationAcceptInput,
  type PageInvitationAcceptOutput,
} from '@colanode/client/mutations';
import type { AppService } from '@colanode/client/services/app-service';

export class PageInvitationAcceptHandler implements MutationHandler<PageInvitationAcceptInput> {
  constructor(private readonly app: AppService) {}

  async handleMutation(
    input: PageInvitationAcceptInput
  ): Promise<PageInvitationAcceptOutput> {
    const account = this.app.getAccount(input.accountId);
    if (!account || account.server.domain !== input.server) {
      throw new MutationError(
        MutationErrorCode.AccountNotFound,
        'Sign in to the server that issued the invitation.'
      );
    }
    try {
      const result = await account.client
        .post('v1/workspaces/page-invitations/accept', {
          json: { token: input.token },
        })
        .json<PageInvitationAcceptOutput>();
      await account.sync();
      return result;
    } catch (error) {
      const apiError = await parseApiError(error);
      throw new MutationError(MutationErrorCode.ApiError, apiError.message);
    }
  }
}
