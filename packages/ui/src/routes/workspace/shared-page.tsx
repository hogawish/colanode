import { createRoute, redirect } from '@tanstack/react-router';

import { SharedPageView } from '@colanode/ui/components/pages/shared-page';
import { getWorkspaceUserId } from '@colanode/ui/routes/utils';
import {
  workspaceMaskRoute,
  workspaceRoute,
} from '@colanode/ui/routes/workspace';

export const sharedPageRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/shared/$pageId',
  component: () => {
    const { pageId, userId } = sharedPageRoute.useParams();
    return <SharedPageView key={`${userId}/${pageId}`} pageId={pageId} />;
  },
});

export const sharedPageMaskRoute = createRoute({
  getParentRoute: () => workspaceMaskRoute,
  path: '/shared/$pageId',
  beforeLoad: ({ params, location }) => {
    const userId = getWorkspaceUserId(params.workspaceId);
    if (userId) {
      throw redirect({
        to: '/workspace/$userId/shared/$pageId',
        params: { userId, pageId: params.pageId },
        replace: true,
        hash: location.hash,
        mask: {
          to: '/$workspaceId/shared/$pageId',
          params,
          hash: location.hash,
        },
      });
    }
  },
});
