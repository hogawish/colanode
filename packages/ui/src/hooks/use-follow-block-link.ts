import { useRouter } from '@tanstack/react-router';
import type { MouseEvent } from 'react';

import { useWorkspace } from '@colanode/ui/contexts/workspace';
import {
  highlightBlock,
  readBlockHash,
  readLocalDocumentLink,
} from '@colanode/ui/lib/block-links';

export const useFollowBlockLink = () => {
  const router = useRouter();
  const workspace = useWorkspace();
  return (event: MouseEvent<HTMLElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      !(event.target instanceof Element)
    ) {
      return;
    }
    const anchor = event.target.closest<HTMLAnchorElement>('a[href]');
    if (
      !anchor ||
      !event.currentTarget.contains(anchor) ||
      anchor.hasAttribute('download') ||
      anchor.dataset.routerLink === 'true'
    ) {
      return;
    }
    const link = readLocalDocumentLink(anchor.href, window.location.href);
    if (!link) return;

    event.preventDefault();
    event.stopPropagation();
    const { workspaceId, documentId, hash } = link;
    const { userId } = workspace;
    const inWorkspace = workspaceId === workspace.workspaceId;
    const shared =
      link.shared ||
      (inWorkspace &&
        router.state.location.pathname ===
          `/workspace/${userId}/shared/${documentId}`);
    const current = router.state.location;
    const currentBlock = readBlockHash(
      current.maskedLocation?.hash || current.hash
    );
    if (
      inWorkspace &&
      currentBlock &&
      currentBlock === readBlockHash(hash) &&
      current.pathname ===
        `/workspace/${userId}/${shared ? 'shared/' : ''}${documentId}`
    ) {
      const id = CSS.escape(currentBlock);
      const block = event.currentTarget.querySelector<HTMLElement>(
        `[data-document-block="${id}"], [data-id="${id}"]`
      );
      if (block) highlightBlock(block);
      return;
    }
    const options = { hash, resetScroll: !hash, hashScrollIntoView: false };

    if (shared) {
      const to = '/$workspaceId/shared/$pageId';
      const params = { workspaceId, pageId: documentId };
      void router.navigate(
        inWorkspace
          ? {
              ...options,
              to: '/workspace/$userId/shared/$pageId',
              params: { userId, pageId: documentId },
              mask: { to, params, hash },
            }
          : { ...options, to, params }
      );
    } else {
      const to = '/$workspaceId/$nodeId';
      const params = { workspaceId, nodeId: documentId };
      void router.navigate(
        inWorkspace
          ? {
              ...options,
              to: '/workspace/$userId/$nodeId',
              params: { userId, nodeId: documentId },
              mask: { to, params, hash },
            }
          : { ...options, to, params }
      );
    }
  };
};
