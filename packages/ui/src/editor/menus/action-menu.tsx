import { useFloating, shift, offset, FloatingPortal } from '@floating-ui/react';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { Editor } from '@tiptap/react';
import { GripVertical, Link2, Plus } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@colanode/ui/components/ui/popover';
import { BlockFormatControls } from '@colanode/ui/editor/menus/block-format-controls';
import { useCopyBlockLink } from '@colanode/ui/hooks/use-copy-block-link';
import { isInBlockHandleCorridor } from '@colanode/ui/lib/block-handle';

interface ActionMenuProps {
  editor: Editor | null;
  documentId: string;
}

const LEFT_MARGIN = 45;

// Blocks that are handled as one unit (the handle never goes inside them).
const ATOMIC_UNITS = ['table', 'blockquote'];
// For these containers the first text line stands for the container itself.
const FIRST_LINE_HOLDERS = ['listItem', 'taskItem', 'toggle'];

/**
 * Pick the block the handle belongs to: the innermost block under the mouse
 * that is a sensible unit to move (list item, toggle, child of a toggle...),
 * instead of always the outermost one.
 */
const findHandleTarget = (
  doc: ProseMirrorNode,
  coords: { pos: number; inside: number }
): { node: ProseMirrorNode; pos: number; depth: number } | null => {
  // A block without text under the mouse (page, database, file, divider...)
  if (coords.inside >= 0) {
    const inside = doc.nodeAt(coords.inside);
    if (inside && inside.isBlock && inside.isAtom) {
      return {
        node: inside,
        pos: coords.inside,
        depth: doc.resolve(coords.inside).depth + 1,
      };
    }
  }

  const $pos = doc.resolve(coords.pos);

  // Inside a table or a quote: the whole table / quote is the unit.
  for (let depth = 1; depth <= $pos.depth; depth++) {
    if (ATOMIC_UNITS.includes($pos.node(depth).type.name)) {
      return {
        node: $pos.node(depth),
        pos: $pos.before(depth),
        depth,
      };
    }
  }

  for (let depth = $pos.depth; depth >= 1; depth--) {
    const node = $pos.node(depth);
    const parent = $pos.node(depth - 1);

    if (!node.isBlock) {
      continue;
    }

    if (
      node.isTextblock &&
      FIRST_LINE_HOLDERS.includes(parent.type.name) &&
      $pos.index(depth - 1) === 0
    ) {
      continue;
    }

    return { node, pos: $pos.before(depth), depth };
  }

  return null;
};

type MenuState = {
  show: boolean;
  pmNode?: ProseMirrorNode;
  domNode?: HTMLElement;
  pos?: number;
  rect?: DOMRect;
};

export const ActionMenu = ({ editor, documentId }: ActionMenuProps) => {
  const copyBlockLink = useCopyBlockLink(documentId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const dragging = useRef(false);
  const view = useRef(editor!.view!);
  const [menuState, setMenuState] = useState<MenuState>({
    show: false,
  });
  const hovered = useRef<MenuState>({ show: false });
  const updateMenuState = (next: MenuState) => {
    hovered.current = next;
    setMenuState(next);
  };

  const { refs, floatingStyles } = useFloating({
    placement: 'left',
    middleware: [offset(-10), shift()],
  });

  useEffect(() => {
    if (menuState.rect) {
      refs.setPositionReference({
        getBoundingClientRect: () => menuState.rect!,
        contextElement: menuState.domNode!,
      });
    }
  }, [menuState.rect, menuState.domNode]);

  useEffect(() => {
    if (editor == null) {
      return;
    }
    const editorDom = editor.view.dom;

    const handleMouseMove = (event: MouseEvent) => {
      if (menuOpen) return;
      const current = hovered.current;
      if (
        current.show &&
        current.domNode?.isConnected &&
        isInBlockHandleCorridor(
          { x: event.clientX, y: event.clientY },
          current.domNode.getBoundingClientRect(),
          refs.floating.current?.getBoundingClientRect()
        )
      )
        return;
      const editorBounds = view.current.dom.getBoundingClientRect();
      const mouseOverEditor =
        event.clientX > editorBounds.left - LEFT_MARGIN &&
        event.clientX < editorBounds.right &&
        event.clientY > editorBounds.top &&
        event.clientY < editorBounds.bottom;

      if (!mouseOverEditor) {
        updateMenuState({
          show: false,
        });
        return;
      }

      // Resolve by coordinates (not by the event target) so that moving the
      // mouse sideways towards the handle keeps the same block selected.
      const coords = view.current.posAtCoords({
        left: Math.max(event.clientX, editorBounds.left + 1),
        top: event.clientY,
      });
      if (!coords) {
        updateMenuState({
          show: false,
        });
        return;
      }

      const target = findHandleTarget(view.current.state.doc, coords);
      if (!target) {
        updateMenuState({
          show: false,
        });
        return;
      }

      const nodeDOM = view.current.nodeDOM(target.pos) as HTMLElement;
      const domNode =
        nodeDOM instanceof HTMLElement
          ? nodeDOM
          : ((nodeDOM as Node)?.parentElement as HTMLElement);

      if (!domNode) {
        updateMenuState({
          show: false,
        });
        return;
      }

      const nodeRect = domNode.getBoundingClientRect();
      const editorRect = editor.view.dom.getBoundingClientRect();
      // Top-level blocks keep the handle at the editor's left edge; nested
      // blocks (list items, children of a toggle, ...) get it next to them.
      const x = target.depth <= 1 ? editorRect.x - 10 : nodeRect.x - 34;
      const menuRect = DOMRect.fromRect({
        x,
        y: nodeRect.y,
        width: 0,
        height: Math.min(nodeRect.height, 32),
      });

      updateMenuState({
        show: true,
        pmNode: target.node,
        domNode,
        pos: target.pos,
        rect: menuRect,
      });
    };

    const handleScroll = () => {
      updateMenuState({
        show: false,
      });
    };

    editorDom.addEventListener('mousemove', handleMouseMove);
    editorDom.addEventListener('scroll', handleScroll, true);

    return () => {
      editorDom.removeEventListener('mousemove', handleMouseMove);
      editorDom.removeEventListener('scroll', handleScroll, true);
    };
  }, [editor, menuOpen]);

  if (editor == null || (!menuState.show && !menuOpen)) {
    return null;
  }

  return (
    <FloatingPortal>
      <div
        ref={refs.setFloating}
        style={{ ...floatingStyles, zIndex: 50 }}
        className="flex items-center text-muted-foreground p-1 mr-2"
      >
        <Plus
          className="size-4 cursor-pointer hover:text-foreground"
          onClick={() => {
            if (menuState.pos === undefined || !menuState.domNode) {
              return;
            }

            // Insert a sibling of the same kind in front of the block: a new
            // list item for list items, a paragraph for everything else.
            const typeName = menuState.pmNode?.type.name;
            const content =
              typeName === 'listItem' || typeName === 'taskItem'
                ? { type: typeName, content: [{ type: 'paragraph' }] }
                : { type: 'paragraph' };

            editor
              .chain()
              .insertContentAt(menuState.pos, content)
              .focus()
              .run();
          }}
        />
        <Popover
          open={menuOpen}
          onOpenChange={(open) => {
            if (open && menuState.pos !== undefined) {
              view.current.dispatch(
                view.current.state.tr.setSelection(
                  NodeSelection.create(view.current.state.doc, menuState.pos)
                )
              );
            }
            if (open)
              setSelectedBlockId(
                typeof menuState.pmNode?.attrs.id === 'string'
                  ? menuState.pmNode.attrs.id
                  : null
              );
            setMenuOpen(open);
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Block actions"
              title="Click for block actions; drag to move"
              className="rounded-sm hover:bg-accent focus-visible:outline-2"
              draggable={true}
              onPointerDown={() => {
                dragging.current = false;
              }}
              onKeyDown={() => {
                dragging.current = false;
              }}
              onClick={(event) => {
                if (dragging.current) event.preventDefault();
              }}
              onDragStart={(event) => {
                if (menuState.pos === undefined || !menuState.domNode) {
                  return;
                }

                dragging.current = true;
                setMenuOpen(false);

                view.current.focus();
                view.current.dispatch(
                  view.current.state.tr.setSelection(
                    NodeSelection.create(view.current.state.doc, menuState.pos)
                  )
                );

                const slice = view.current.state.selection.content();
                const { dom, text } = view.current.serializeForClipboard(slice);

                event.dataTransfer.clearData();
                event.dataTransfer.effectAllowed = 'copyMove';
                event.dataTransfer.setData('text/html', dom.innerHTML);
                event.dataTransfer.setData('text/plain', text);
                event.dataTransfer.setDragImage(menuState.domNode, 0, 0);

                view.current.dragging = { slice, move: true };
              }}
              onDragEnd={() => {
                view.current.dispatch(
                  view.current.state.tr.setSelection(
                    TextSelection.create(view.current.state.doc, 1)
                  )
                );

                view.current.dom.blur();
              }}
            >
              <GripVertical className="size-4 cursor-pointer hover:text-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-56 p-1"
            side="right"
            align="start"
            role="menu"
            aria-label="Block actions"
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            <BlockFormatControls
              editor={editor}
              blockId={selectedBlockId}
              onApplied={() => setMenuOpen(false)}
            />
            <button
              type="button"
              role="menuitem"
              disabled={!selectedBlockId}
              className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent focus:bg-accent disabled:opacity-50"
              onClick={() => {
                void copyBlockLink(selectedBlockId);
                setMenuOpen(false);
              }}
            >
              <Link2 className="size-4" />
              Copy link to block
            </button>
          </PopoverContent>
        </Popover>
      </div>
    </FloatingPortal>
  );
};
