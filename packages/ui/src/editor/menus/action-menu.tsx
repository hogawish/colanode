import { useFloating, shift, offset, FloatingPortal } from '@floating-ui/react';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { Editor } from '@tiptap/react';
import { GripVertical, Link2, Plus } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

import { isDescendantNode } from '@colanode/client/lib';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@colanode/ui/components/ui/popover';
import { useCopyBlockLink } from '@colanode/ui/hooks/use-copy-block-link';

interface ActionMenuProps {
  editor: Editor | null;
  documentId: string;
}

const LEFT_MARGIN = 45;

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
      const editorBounds = view.current.dom.getBoundingClientRect();
      const mouseOverEditor =
        event.clientX > editorBounds.left - LEFT_MARGIN &&
        event.clientX < editorBounds.right &&
        event.clientY > editorBounds.top &&
        event.clientY < editorBounds.bottom;

      if (!mouseOverEditor) {
        setMenuState({
          show: false,
        });
        return;
      }

      const pos = view.current.posAtDOM(event.target as Node, 0, 0);
      if (!pos) {
        setMenuState({
          show: false,
        });
        return;
      }

      let currentPos = pos;
      let pmNode = null;
      let domNode = null;
      let nodePos = -1;

      while (currentPos >= 0) {
        const node = view.current.state.doc.nodeAt(currentPos);

        if (!node || !node.isBlock) {
          currentPos--;
          continue;
        }

        if (pmNode && !isDescendantNode(node, pmNode)) {
          currentPos--;
          continue;
        }

        const nodeDOM = view.current.nodeDOM(currentPos) as HTMLElement;
        const nodeDOMElement =
          nodeDOM instanceof HTMLElement
            ? nodeDOM
            : ((nodeDOM as Node)?.parentElement as HTMLElement);

        if (nodeDOMElement) {
          pmNode = node;
          domNode = nodeDOMElement;
          nodePos = currentPos;
        }

        currentPos--;
      }

      if (!pmNode || !domNode) {
        setMenuState({
          show: false,
        });
        return;
      }

      const nodeRect = domNode.getBoundingClientRect();
      const editorRect = editor.view.dom.getBoundingClientRect();
      const menuRect = DOMRect.fromRect({
        x: editorRect.x - 10,
        y: nodeRect.y,
        width: 0,
        height: nodeRect.height,
      });

      setMenuState({
        show: true,
        pmNode,
        domNode,
        pos: nodePos,
        rect: menuRect,
      });
    };

    const handleScroll = () => {
      setMenuState({
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

            editor
              .chain()
              .insertContentAt(menuState.pos, { type: 'paragraph' })
              .focus()
              .run();
          }}
        />
        <Popover
          open={menuOpen}
          onOpenChange={(open) => {
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
