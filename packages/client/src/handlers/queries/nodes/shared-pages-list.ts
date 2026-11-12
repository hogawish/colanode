import { WorkspaceQueryHandlerBase } from '@colanode/client/handlers/queries/workspace-query-handler-base';
import type {
  ChangeCheckResult,
  QueryHandler,
} from '@colanode/client/lib/types';
import type {
  SharedPageListItem,
  SharedPagesListQueryInput,
} from '@colanode/client/queries/nodes/shared-pages-list';

export class SharedPagesListQueryHandler
  extends WorkspaceQueryHandlerBase
  implements QueryHandler<SharedPagesListQueryInput>
{
  public async handleQuery(
    input: SharedPagesListQueryInput
  ): Promise<SharedPageListItem[]> {
    const workspace = this.getWorkspace(input.userId);
    const { pages } = await workspace.account.client
      .get(`v1/workspaces/${workspace.workspaceId}/page-shares/mine`)
      .json<{ pages: SharedPageListItem[] }>();
    return pages;
  }

  public async checkForChanges(): Promise<
    ChangeCheckResult<SharedPagesListQueryInput>
  > {
    return { hasChanges: false };
  }
}
