import { Link } from '@tanstack/react-router';
import { createContext, useContext } from 'react';

import type { SharedPage } from '@colanode/client/mutations';
import { PageLinkContent } from '@colanode/ui/components/pages/page-link-content';
import { useWorkspace } from '@colanode/ui/contexts/workspace';

type ChildPage = SharedPage['pages'][number];

export const SharedChildPagesContext = createContext<ReadonlyMap<
  string,
  ChildPage
> | null>(null);

export const SharedPageLink = ({ id }: { id?: string }) => {
  const pages = useContext(SharedChildPagesContext);
  const { userId, workspaceId } = useWorkspace();
  const page = id ? pages?.get(id) : undefined;
  if (!page) return null;

  return (
    <div data-document-block={page.id}>
      <Link
        to="/workspace/$userId/shared/$pageId"
        params={{ userId, pageId: page.id }}
        mask={{
          to: '/$workspaceId/shared/$pageId',
          params: { workspaceId, pageId: page.id },
        }}
      >
        <PageLinkContent {...page} />
      </Link>
    </div>
  );
};
