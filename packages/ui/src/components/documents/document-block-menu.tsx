// Modified: right-click block links without editing the document or its permissions.
import { useRouterState } from '@tanstack/react-router';
import type { Editor } from '@tiptap/core';
import { Link2 } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@colanode/ui/components/ui/context-menu';
import { useCopyBlockLink } from '@colanode/ui/hooks/use-copy-block-link';
import {
  blockAtTarget,
  findBlockElement,
  readBlockHash,
} from '@colanode/ui/lib/block-links';

export const DocumentBlockMenu = ({
  editor,
  documentId,
  children,
}: {
  editor: Editor | null;
  documentId: string;
  children: ReactNode;
}) => {
  const copyBlockLink = useCopyBlockLink(documentId);
  const hash = useRouterState({ select: (state) => state.location.hash });
  const [blockId, setBlockId] = useState<string | null>(null);

  useEffect(() => {
    if (!editor) return;
    const targetId = readBlockHash(hash);
    if (!targetId) return;
    let reached: HTMLElement | null = null;
    let highlight: Animation | undefined;
    const locate = () => {
      if (reached || editor.isDestroyed) return;
      const element = findBlockElement(editor, targetId);
      if (!element) return;
      reached = element;
      element.scrollIntoView({ block: 'center', behavior: 'auto' });
      // DOM class/style mutations inside ProseMirror can be interpreted as edits.
      highlight = element.animate?.(
        [
          { outline: '2px solid #3b82f6', outlineOffset: '3px' },
          { outline: '2px solid #3b82f6', outlineOffset: '3px', offset: 0.8 },
          { outline: '2px solid transparent', outlineOffset: '3px' },
        ],
        { duration: 2000 }
      );
    };
    const frame = requestAnimationFrame(locate);
    editor.on('update', locate);
    return () => {
      cancelAnimationFrame(frame);
      editor.off('update', locate);
      highlight?.cancel();
    };
  }, [editor, documentId, hash]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          onContextMenu={(event) =>
            setBlockId(editor ? blockAtTarget(editor, event.target) : null)
          }
        >
          {children}
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
