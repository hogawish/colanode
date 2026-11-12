import { useRouterState } from '@tanstack/react-router';
import { Link2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { buildEditorContent } from '@colanode/client/lib';
import type { RichTextContent } from '@colanode/core';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@colanode/ui/components/ui/context-menu';
import { DocumentRenderer } from '@colanode/ui/editor/renderers/document';
import { useCopyBlockLink } from '@colanode/ui/hooks/use-copy-block-link';
import { highlightBlock, readBlockHash } from '@colanode/ui/lib/block-links';

export const SharedPageDocument = ({
  pageId,
  content,
}: {
  pageId: string;
  content: RichTextContent | null;
}) => {
  const document = useMemo(
    () => buildEditorContent(pageId, content),
    [pageId, content]
  );
  const root = useRef<HTMLDivElement>(null);
  const [blockId, setBlockId] = useState<string | null>(null);
  const copyBlockLink = useCopyBlockLink(pageId);
  const hash = useRouterState({
    select: (state) =>
      state.location.maskedLocation?.hash || state.location.hash,
  });

  useEffect(() => {
    const targetId = readBlockHash(hash);
    if (!targetId) return;
    const target = root.current?.querySelector<HTMLElement>(
      `[data-document-block="${CSS.escape(targetId)}"]`
    );
    if (!target) return;
    let details = target.parentElement?.closest('details');
    while (details) {
      details.open = true;
      details = details.parentElement?.closest('details');
    }
    let highlight: Animation | undefined;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        highlight = highlightBlock(target);
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      highlight?.cancel();
    };
  }, [document, hash]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={root}
          className="space-y-2 wrap-anywhere"
          onContextMenu={(event) => {
            const target = event.target;
            setBlockId(
              target instanceof Element
                ? (target.closest<HTMLElement>('[data-document-block]')?.dataset
                    .documentBlock ?? null)
                : null
            );
          }}
        >
          <DocumentRenderer node={document} keyPrefix={pageId} />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          disabled={!blockId}
          onSelect={() => void copyBlockLink(blockId)}
        >
          <Link2 className="size-4" /> Copy link to block
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
