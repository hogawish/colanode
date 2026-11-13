import { createRoute, redirect } from '@tanstack/react-router';

import { SharedDatabasePage } from '@colanode/ui/components/pages/shared-database';
import { getWorkspaceUserId } from '@colanode/ui/routes/utils';
import {
  workspaceMaskRoute,
  workspaceRoute,
} from '@colanode/ui/routes/workspace';

const path = '/shared/$pageId/database/$databaseId';

export const sharedDatabaseRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path,
  component: () => {
    const { userId, pageId, databaseId } = sharedDatabaseRoute.useParams();
    return (
      <SharedDatabasePage
        key={`${userId}/${pageId}/${databaseId}`}
        pageId={pageId}
        databaseId={databaseId}
      />
    );
  },
});

export const sharedDatabaseMaskRoute = createRoute({
  getParentRoute: () => workspaceMaskRoute,
  path,
  beforeLoad: ({ params }) => {
    const { workspaceId, pageId, databaseId } = params;
    const userId = getWorkspaceUserId(workspaceId);
    if (userId) {
      throw redirect({
        to: '/workspace/$userId/shared/$pageId/database/$databaseId',
        params: { userId, pageId, databaseId },
        replace: true,
        mask: {
          to: '/$workspaceId/shared/$pageId/database/$databaseId',
          params,
        },
      });
    }
  },
});
