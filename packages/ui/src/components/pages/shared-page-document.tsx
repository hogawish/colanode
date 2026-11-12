import { useRouterState } from '@tanstack/react-router';
import { GripVertical, Link2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { buildEditorContent } from '@colanode/client/lib';
import type { SharedPage } from '@colanode/client/mutations';
import type { RichTextContent } from '@colanode/core';
import { SharedDatabasesContext } from '@colanode/ui/components/pages/shared-database';
import { SharedFilesContext } from '@colanode/ui/components/pages/shared-file';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@colanode/ui/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@colanode/ui/components/ui/dropdown-menu';
import { DocumentRenderer } from '@colanode/ui/editor/renderers/document';
import { SharedChildPagesContext } from '@colanode/ui/editor/renderers/shared-page-link';
import { useCopyBlockLink } from '@colanode/ui/hooks/use-copy-block-link';
import { isInBlockHandleCorridor } from '@colanode/ui/lib/block-handle';
import { highlightBlock, readBlockHash } from '@colanode/ui/lib/block-links';

const findBlock = (target: EventTarget | null) =>
  target instanceof Element
    ? target.closest<HTMLElement>('[data-document-block]')
    : null;

export const SharedPageDocument = ({
  pageId,
  content,
  pages,
  pagePlacements,
  databases,
  databasePlacements,
  files,
  filePlacements,
}: {
  pageId: string;
  content: RichTextContent | null;
  pages?: SharedPage['pages'];
  pagePlacements?: SharedPage['pagePlacements'];
  databases?: SharedPage['databases'];
  databasePlacements?: SharedPage['databasePlacements'];
  files?: SharedPage['files'];
  filePlacements?: SharedPage['filePlacements'];
}) => {
  const childPages = useMemo(
    () => new Map(pages?.map((page) => [page.id, page])),
    [pages]
  );
  const childDatabases = useMemo(
    () => new Map(databases?.map((database) => [database.id, database])),
    [databases]
  );
  const childFiles = useMemo(
    () => new Map(files?.map((file) => [file.id, file])),
    [files]
  );
  const document = useMemo(() => {
    const blocks = { ...content?.blocks };
    for (const placement of pagePlacements ?? []) {
      if (childPages.has(placement.id)) {
        blocks[placement.id] = { ...placement, type: 'page' };
      }
    }
    for (const { inline, ...placement } of databasePlacements ?? []) {
      if (childDatabases.has(placement.id)) {
        blocks[placement.id] = {
          ...placement,
          type: 'database',
          attrs: { inline },
        };
      }
    }
    for (const placement of filePlacements ?? []) {
      if (childFiles.has(placement.id)) {
        blocks[placement.id] = { ...placement, type: 'file' };
      }
    }
    return buildEditorContent(pageId, { type: 'rich_text', blocks });
  }, [
    pageId,
    content,
    pagePlacements,
    childPages,
    databasePlacements,
    childDatabases,
    filePlacements,
    childFiles,
  ]);
  const root = useRef<HTMLDivElement>(null);
  const handle = useRef<HTMLButtonElement>(null);
  const [blockId, setBlockId] = useState<string | null>(null);
  const [hovered, setHovered] = useState<{
    block: HTMLElement;
    left: number;
    top: number;
  } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
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
          className="relative wrap-anywhere [&_p[data-document-block]]:py-1 [&_p[data-document-block]:empty]:min-h-[calc(1lh+0.5rem)] [&_[data-shared-block-selected]]:outline-2 [&_[data-shared-block-selected]]:outline-blue-500/40"
          onContextMenu={(event) =>
            setBlockId(findBlock(event.target)?.dataset.documentBlock ?? null)
          }
          onMouseMove={(event) => {
            if (menuOpen) return;
            if (
              hovered &&
              isInBlockHandleCorridor(
                { x: event.clientX, y: event.clientY },
                hovered.block.getBoundingClientRect(),
                handle.current?.getBoundingClientRect()
              )
            )
              return;
            let block = findBlock(event.target);
            // The editor's handle targets the toggle or list item from its first line.
            if (block?.matches('summary, li > p:first-child')) {
              block = findBlock(block.parentElement);
            }
            if (!block?.dataset.documentBlock) {
              setHovered(null);
              return;
            }
            const bounds = block.getBoundingClientRect();
            const origin = event.currentTarget.getBoundingClientRect();
            const left = bounds.left - origin.left - 24;
            const top =
              bounds.top - origin.top + (Math.min(bounds.height, 28) - 24) / 2;
            if (
              hovered?.block !== block ||
              hovered.left !== left ||
              hovered.top !== top
            )
              setHovered({ block, left, top });
          }}
          onMouseLeave={() => {
            if (!menuOpen) setHovered(null);
          }}
        >
          <SharedChildPagesContext.Provider value={childPages}>
            <SharedDatabasesContext.Provider
              value={{ pageId, databases: childDatabases }}
            >
              <SharedFilesContext.Provider value={childFiles}>
                <DocumentRenderer node={document} keyPrefix={pageId} />
              </SharedFilesContext.Provider>
            </SharedDatabasesContext.Provider>
          </SharedChildPagesContext.Provider>
          {hovered && (
            <DropdownMenu
              open={menuOpen}
              onOpenChange={(open) => {
                hovered.block.toggleAttribute(
                  'data-shared-block-selected',
                  open
                );
                setMenuOpen(open);
              }}
            >
              <DropdownMenuTrigger asChild>
                <button
                  ref={handle}
                  type="button"
                  aria-label="Block actions"
                  title="Block actions"
                  className="absolute z-10 flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2"
                  style={{ left: hovered.left, top: hovered.top }}
                >
                  <GripVertical className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start">
                <DropdownMenuItem
                  onSelect={() =>
                    void copyBlockLink(
                      hovered.block.dataset.documentBlock ?? null
                    )
                  }
                >
                  <Link2 className="size-4" /> Copy link to block
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
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
