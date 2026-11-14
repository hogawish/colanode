import { eq, useLiveQuery } from '@tanstack/react-db';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Link2 } from 'lucide-react';
import { useState } from 'react';

import type { LocalSpaceNode } from '@colanode/client/types';
import { Button } from '@colanode/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@colanode/ui/components/ui/dialog';
import { useWorkspace } from '@colanode/ui/contexts/workspace';

export const SpacePageReferenceLinks = ({
  space,
  onOpen,
}: {
  space: LocalSpaceNode;
  onOpen?: () => void;
}) => {
  const { userId, workspaceId } = useWorkspace();
  const ids = Object.keys(space.pageReferences ?? {}).sort();
  const query = useQuery({
    queryKey: ['space-page-references', userId, space.id, ids],
    enabled: ids.length > 0,
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: 'always',
    queryFn: async () => {
      const result = await window.colanode.executeMutation({
        type: 'page.share',
        action: 'list-space-references',
        userId,
        spaceId: space.id,
      });
      if (!result.success || result.output.action !== 'list-space-references') {
        throw new Error('Could not load page references.');
      }
      return result.output.pages;
    },
  });
  if (!ids.length) return null;
  return query.data?.map((page) => (
    <li key={page.id}>
      <Link
        to="/workspace/$userId/shared/$pageId"
        params={{ userId, pageId: page.id }}
        mask={{
          to: '/$workspaceId/shared/$pageId',
          params: { workspaceId, pageId: page.id },
        }}
        className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-sidebar-accent"
        aria-label={page.name + ' (page reference)'}
        onClick={onOpen}
      >
        <Link2 className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{page.name}</span>
      </Link>
    </li>
  ));
};

export const ManageSpacePageReferences = ({
  space,
  onClose,
}: {
  space: LocalSpaceNode;
  onClose: () => void;
}) => {
  const { collections } = useWorkspace();
  const [selected, setSelected] = useState('');
  const pages = useLiveQuery(
    (q) =>
      q
        .from({ nodes: collections.nodes })
        .where(({ nodes }) => eq(nodes.type, 'page')),
    [collections.nodes]
  ).data;
  const references = Object.keys(space.pageReferences ?? {});
  const pageLabel = (id: string) => {
    const node = collections.nodes.get(id);
    if (node?.type !== 'page') return 'Unavailable page';
    const root = collections.nodes.get(node.rootId);
    return root?.type === 'space' ? root.name + ' › ' + node.name : node.name;
  };
  const changeReference = (pageId: string, add: boolean) => {
    collections.nodes.update(space.id, (draft) => {
      if (draft.type !== 'space') return;
      const updated = { ...draft.pageReferences };
      if (add) updated[pageId] = true;
      else delete updated[pageId];
      draft.pageReferences = updated;
    });
    setSelected('');
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Page references</DialogTitle>
          <DialogDescription>
            Add a page to the Space sidebar. People can open it with their
            existing page access.
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-40 overflow-auto">
          {references.map((id) => (
            <li
              key={id}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span>{pageLabel(id)}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => changeReference(id, false)}
              >
                Remove reference
              </Button>
            </li>
          ))}
        </ul>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (selected) changeReference(selected, true);
          }}
        >
          <select
            aria-label="Select a page"
            className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
          >
            <option value="">Select a page…</option>
            {pages
              .filter(
                (page) =>
                  page.rootId !== space.id && !references.includes(page.id)
              )
              .map((page) => (
                <option key={page.id} value={page.id}>
                  {pageLabel(page.id)}
                </option>
              ))}
          </select>
          <Button type="submit" disabled={!selected}>
            Add reference
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
