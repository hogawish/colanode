import { mergeAttributes, Node } from '@tiptap/core';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import { ReactNodeViewRenderer } from '@tiptap/react';

import { defaultClasses } from '@colanode/ui/editor/classes';
import { ToggleNodeView } from '@colanode/ui/editor/views/toggle';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    toggle: {
      /** Wrap the current paragraph into a toggle (first paragraph = summary). */
      setToggle: () => ReturnType;
    };
  }
}

type OpenListener = (toggleId: string) => void;

const TOGGLE = 'toggle';

/**
 * The run of sibling blocks that Tab / Shift+Tab move:
 * `depth` is the depth of their common container, `startIndex..endIndex`
 * (end exclusive) are the child indexes inside it.
 *
 * - Cursor / selection inside one text block: that block.
 * - Selection across several blocks: all the blocks it touches (same level).
 * - A run that starts at a toggle's summary line is widened to the whole
 *   toggle, because the summary can't be separated from its toggle.
 */
const findTargetRun = (
  state: EditorState
): { depth: number; startIndex: number; endIndex: number } | null => {
  const { $from, $to } = state.selection;

  let depth: number;
  let startIndex: number;
  let endIndex: number;

  if ($from.sameParent($to)) {
    if ($from.depth < 1) {
      return null;
    }

    depth = $from.depth - 1;
    startIndex = $from.index(depth);
    endIndex = startIndex + 1;
  } else {
    const range = $from.blockRange($to);
    if (!range) {
      return null;
    }

    depth = range.depth;
    startIndex = range.startIndex;
    endIndex = range.endIndex;
  }

  while (
    depth >= 1 &&
    startIndex === 0 &&
    $from.node(depth).type.name === TOGGLE
  ) {
    depth -= 1;
    startIndex = $from.index(depth);
    endIndex = $to.indexAfter(depth);
  }

  return { depth, startIndex, endIndex };
};

/**
 * Toggle (collapsible) block.
 * Content: the first paragraph is the always-visible summary line,
 * the following blocks are the collapsible body.
 * The open/closed state is kept only in the viewer's browser and is not
 * written to the document, so toggling never creates document history.
 *
 * Keyboard (Notion-like):
 *  - Enter at the end of the summary: open the toggle and add a child.
 *  - Tab: move the selected block(s) into the toggle just above them.
 *  - Shift+Tab: move the selected block(s) (direct children) out of their toggle.
 */
export const ToggleNode = Node.create({
  name: TOGGLE,
  group: 'block',
  content: 'paragraph block*',
  defining: true,
  // Run our Tab / Shift+Tab / Enter handlers before the generic Tab keymap.
  priority: 1000,

  addStorage() {
    return {
      // The node view subscribes here to be told to open (React state lives there).
      listeners: new Set<OpenListener>(),
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="toggle"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'toggle',
        class: defaultClasses.toggle,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setToggle:
        () =>
        ({ commands }) =>
          commands.wrapIn(this.name),
    };
  },

  addKeyboardShortcuts() {
    const emitOpen = (node: ProseMirrorNode) => {
      const id = node.attrs.id;
      if (typeof id !== 'string') {
        return;
      }

      this.storage.listeners.forEach((listener: OpenListener) => listener(id));
    };

    return {
      Enter: ({ editor }) => {
        const { selection } = editor.state;
        if (!selection.empty) {
          return false;
        }

        const { $from } = selection;
        const toggleDepth = $from.depth - 1;
        if (
          toggleDepth < 1 ||
          $from.parent.type.name !== 'paragraph' ||
          $from.node(toggleDepth).type.name !== this.name ||
          $from.index(toggleDepth) !== 0
        ) {
          return false;
        }

        // Always open the toggle so the new child is visible.
        emitOpen($from.node(toggleDepth));

        if ($from.parentOffset !== $from.parent.content.size) {
          // Cursor in the middle of the summary: default split puts the rest in a child.
          return false;
        }

        const insertPos = $from.after();
        return editor
          .chain()
          .insertContentAt(insertPos, { type: 'paragraph' })
          .setTextSelection(insertPos + 1)
          .run();
      },

      Tab: ({ editor }) => {
        const { state } = editor;
        const { $from, $to, empty } = state.selection;
        const run = findTargetRun(state);

        // With a selection, never let the generic Tab replace the selected text.
        const swallow = !empty;
        if (!run) {
          return swallow;
        }

        const container = $from.node(run.depth);
        if (run.startIndex === 0) {
          return swallow;
        }

        const previous = container.child(run.startIndex - 1);
        if (previous.type.name !== this.name) {
          return swallow;
        }

        const startPos = $from.posAtIndex(run.startIndex, run.depth);
        const endPos = $from.posAtIndex(run.endIndex, run.depth);
        const content = state.doc.slice(startPos, endPos).content;

        // End of the previous toggle's content (just before its closing token).
        const insertPos = startPos - 1;
        const delta = insertPos - startPos;
        const tr = state.tr.delete(startPos, endPos).insert(insertPos, content);
        tr.setSelection(
          TextSelection.create(tr.doc, $from.pos + delta, $to.pos + delta)
        );
        editor.view.dispatch(tr.scrollIntoView());
        emitOpen(previous);
        return true;
      },

      'Shift-Tab': ({ editor }) => {
        const { state } = editor;
        const { $from, $to, empty } = state.selection;
        const run = findTargetRun(state);

        const swallow = !empty;
        if (!run || run.depth < 1) {
          return swallow;
        }

        // The run must be direct children of a toggle, after its summary.
        if (
          $from.node(run.depth).type.name !== this.name ||
          run.startIndex === 0
        ) {
          return swallow;
        }

        const startPos = $from.posAtIndex(run.startIndex, run.depth);
        const endPos = $from.posAtIndex(run.endIndex, run.depth);
        const content = state.doc.slice(startPos, endPos).content;
        const toggleAfter = $from.after(run.depth);

        const insertPos = toggleAfter - (endPos - startPos);
        const delta = insertPos - startPos;
        const tr = state.tr.delete(startPos, endPos).insert(insertPos, content);
        tr.setSelection(
          TextSelection.create(tr.doc, $from.pos + delta, $to.pos + delta)
        );
        editor.view.dispatch(tr.scrollIntoView());
        return true;
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ToggleNodeView, {
      as: 'div',
    });
  },
});
