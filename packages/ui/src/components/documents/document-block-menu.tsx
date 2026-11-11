// Modified: right-click block links without editing the document or its permissions.
import { useRouterState } from '@tanstack/react-router';
import type { Editor } from '@tiptap/core';
import { Link2 } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { toast } from 'sonner';

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@colanode/ui/components/ui/context-menu';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import {
  blockAtTarget,
  buildBlockLink,
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
  const workspace = useWorkspace();
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
          onSelect={async () => {
            if (!blockId) return;
            try {
              await navigator.clipboard.writeText(
                buildBlockLink(
                  window.location.origin,
                  workspace.workspaceId,
                  documentId,
                  blockId
                )
              );
              toast.success('Block link copied');
            } catch {
              toast.error(
                'Could not copy the block link. Please allow clipboard access.'
              );
            }
          }}
        >
          <Link2 className="size-4" /> Copy link to block
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
