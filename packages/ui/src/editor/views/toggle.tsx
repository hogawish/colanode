import { type NodeViewProps } from '@tiptap/core';
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import { ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';

import { defaultClasses } from '@colanode/ui/editor/classes';
import { cn } from '@colanode/ui/lib/utils';

export const ToggleNodeView = ({ node, editor }: NodeViewProps) => {
  // Kept per viewer (not saved in the document). Open by default.
  const [open, setOpen] = useState(true);
  const hasBody = node.childCount > 1;
  const id: string | null = node.attrs.id ?? null;

  // The editor asks us to open (Enter on the summary, Tab into this toggle).
  useEffect(() => {
    const storage = editor.storage as unknown as Record<
      string,
      { listeners?: Set<(toggleId: string) => void> } | undefined
    >;
    const listeners = storage.toggle?.listeners;
    if (!listeners || !id) {
      return;
    }

    const listener = (toggleId: string) => {
      if (toggleId === id) {
        setOpen(true);
      }
    };

    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [editor, id]);

  return (
    <NodeViewWrapper
      data-id={node.attrs.id}
      data-type="toggle"
      data-open={open ? 'true' : 'false'}
      className={defaultClasses.toggle}
    >
      <button
        type="button"
        contentEditable={false}
        aria-label={open ? 'Collapse' : 'Expand'}
        aria-expanded={open}
        className={cn(
          'absolute left-0 top-1 flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted',
          !hasBody && 'opacity-40'
        )}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronRight
          className={cn('size-4 transition-transform', open && 'rotate-90')}
        />
      </button>
      <NodeViewContent
        className={cn(
          'pl-7',
          // TipTap wraps the children in an inner div[data-node-view-content-react]
          !open &&
            '[&>[data-node-view-content-react]>*:not(:first-child)]:hidden'
        )}
      />
    </NodeViewWrapper>
  );
};
