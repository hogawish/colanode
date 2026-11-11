import { Editor } from '@tiptap/core';
import { Fragment, Node as PMNode } from '@tiptap/pm/model';
import { NodeSelection } from '@tiptap/pm/state';

import { editorColors } from '@colanode/ui/lib/editor';

export const blockTypes = [
  ['paragraph', 'Text'],
  ['heading1', 'Heading 1'],
  ['heading2', 'Heading 2'],
  ['heading3', 'Heading 3'],
  ['bulletList', 'Bulleted list'],
  ['orderedList', 'Numbered list'],
  ['taskList', 'To-do list'],
] as const;
export type BlockKind = (typeof blockTypes)[number][0];
const textTypes = ['paragraph', 'heading1', 'heading2', 'heading3'];
const itemTypes = ['listItem', 'taskItem'];

export const findFormattingBlock = (
  editor: Editor,
  id: string | null
): { node: PMNode; pos: number } | null => {
  if (editor.isDestroyed) return null;
  let result: { node: PMNode; pos: number } | null = null;
  if (id)
    editor.state.doc.descendants((node, pos) => {
      if (node.attrs.id === id) {
        result = { node, pos };
        return false;
      }
      return !result;
    });
  return result;
};

export const blockBackgroundClass = (value: unknown) =>
  editorColors.find((color) => color.color === value)?.bgClass ?? '';

export const setBlockBackground = (
  editor: Editor,
  id: string | null,
  color: string
) => {
  const target = findFormattingBlock(editor, id);
  if (
    !editor.isEditable ||
    !target ||
    !editorColors.some((entry) => entry.color === color)
  )
    return false;
  const tr = editor.state.tr.setNodeMarkup(target.pos, undefined, {
    ...target.node.attrs,
    blockBackground: color === 'default' ? null : color,
  });
  editor.view.dispatch(
    tr.setSelection(NodeSelection.create(tr.doc, target.pos))
  );
  return true;
};

// Apply marks to this block's text, without relying on the caret left behind
// when the menu took focus. Resolve its ID again after concurrent edits.
export const formatBlockText = (
  editor: Editor,
  id: string | null,
  name: string,
  color?: string
) => {
  const target = findFormattingBlock(editor, id);
  const markType = editor.schema.marks[name];
  if (!editor.isEditable || !target || !markType) return false;
  const runs: { node: PMNode; from: number; to: number }[] = [];
  target.node.descendants((node, pos) => {
    if (node.isText)
      runs.push({
        node,
        from: target.pos + 1 + pos,
        to: target.pos + 1 + pos + node.nodeSize,
      });
  });
  if (!runs.length) return false;
  const remove =
    color === 'default' ||
    (!color && runs.every(({ node }) => markType.isInSet(node.marks)));
  const tr = editor.state.tr;
  const mark = markType.create(color ? { [name]: color } : undefined);
  runs.forEach(({ from, to }) => {
    tr.removeMark(from, to, markType);
    if (!remove) tr.addMark(from, to, mark);
  });
  editor.view.dispatch(tr);
  return true;
};

export const canConvertBlock = (node: PMNode) =>
  textTypes.includes(node.type.name) || itemTypes.includes(node.type.name);

// Split the surrounding list so changing one item never changes its siblings.
// Keep nested blocks in their existing order instead of flattening their text.
export const convertBlock = (
  editor: Editor,
  id: string | null,
  kind: BlockKind
) => {
  const target = findFormattingBlock(editor, id);
  if (!editor.isEditable || !target || !canConvertBlock(target.node))
    return false;
  const { node, pos } = target;
  const isItem = itemTypes.includes(node.type.name);
  const first = isItem ? node.firstChild! : node;
  if (!first.isTextblock) return false;
  const extra = isItem ? node.content.cut(first.nodeSize) : Fragment.empty;
  let replacement: Fragment;
  if (textTypes.includes(kind)) {
    const text = editor.schema.nodes[kind]!.create(
      {
        ...first.attrs,
        ...node.attrs,
        blockBackground:
          node.attrs.blockBackground ?? first.attrs.blockBackground,
        id,
      },
      first.content
    );
    replacement = Fragment.from(text).append(extra);
  } else {
    const itemName = kind === 'taskList' ? 'taskItem' : 'listItem';
    const paragraph = editor.schema.nodes.paragraph!.create(
      isItem
        ? first.attrs
        : { ...first.attrs, id: null, blockBackground: null },
      first.content
    );
    const item = editor.schema.nodes[itemName]!.create(
      { ...node.attrs, id },
      Fragment.from(paragraph).append(extra)
    );
    replacement = Fragment.from(editor.schema.nodes[kind]!.create(null, item));
  }
  const tr = editor.state.tr;
  if (isItem) {
    const $pos = editor.state.doc.resolve(pos);
    const list = $pos.parent;
    if (!['bulletList', 'orderedList', 'taskList'].includes(list.type.name))
      return false;
    const index = $pos.index();
    const before = list.content.cut(0, $pos.parentOffset);
    const after = list.content.cut($pos.parentOffset + node.nodeSize);
    let content = before.size
      ? Fragment.from(list.copy(before))
      : Fragment.empty;
    content = content.append(replacement);
    if (after.size)
      content = content.append(
        Fragment.from(
          list.type.create(
            {
              ...list.attrs,
              id: before.size ? null : list.attrs.id,
              ...(list.type.name === 'orderedList'
                ? { start: (list.attrs.start ?? 1) + index + 1 }
                : {}),
            },
            after
          )
        )
      );
    const listPos = $pos.before();
    if (
      !$pos
        .node($pos.depth - 1)
        .canReplace(
          $pos.index($pos.depth - 1),
          $pos.index($pos.depth - 1) + 1,
          content
        )
    )
      return false;
    tr.replaceWith(listPos, listPos + list.nodeSize, content);
  } else {
    const $pos = editor.state.doc.resolve(pos);
    if (!$pos.parent.canReplace($pos.index(), $pos.index() + 1, replacement))
      return false;
    tr.replaceWith(pos, pos + node.nodeSize, replacement);
  }
  let selectedPos: number | undefined;
  tr.doc.descendants((candidate, candidatePos) => {
    if (candidate.attrs.id === id) selectedPos = candidatePos;
  });
  if (selectedPos !== undefined)
    tr.setSelection(NodeSelection.create(tr.doc, selectedPos));
  editor.view.dispatch(tr.scrollIntoView());
  return true;
};
