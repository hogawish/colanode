import { Editor } from '@tiptap/core';
import { toast } from 'sonner';

import {
  blockTypes,
  canConvertBlock,
  convertBlock,
  findFormattingBlock,
  formatBlockText,
  setBlockBackground,
  type BlockKind,
} from '@colanode/ui/lib/block-formatting';
import { editorColors } from '@colanode/ui/lib/editor';

export const BlockFormatControls = ({
  editor,
  blockId,
  onApplied,
}: {
  editor: Editor;
  blockId: string | null;
  onApplied: () => void;
}) => {
  const target = findFormattingBlock(editor, blockId);
  if (!editor.isEditable || !target) return null;
  const apply = (action: () => boolean) => {
    if (action()) onApplied();
    else
      toast.error(
        'This change cannot be applied to this block without changing its structure.'
      );
  };
  const hasText = target.node.textContent.length > 0;
  return (
    <div className="space-y-2 border-b px-2 py-2 mb-1">
      <label className="block text-xs font-medium">
        Turn into
        <select
          aria-label="Turn into"
          className="mt-1 w-full rounded border bg-popover px-2 py-1 text-sm"
          disabled={!canConvertBlock(target.node)}
          value=""
          onChange={(event) =>
            apply(() =>
              convertBlock(editor, blockId, event.target.value as BlockKind)
            )
          }
        >
          <option value="" disabled>
            Choose block type…
          </option>
          {blockTypes.map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className="text-xs font-medium">Format</div>
      <div className="flex flex-wrap gap-1">
        {(
          [
            ['bold', 'Bold', 'B'],
            ['italic', 'Italic', 'I'],
            ['underline', 'Underline', 'U'],
            ['strike', 'Strikethrough', 'S'],
            ['code', 'Inline code', '</>'],
          ] as const
        ).map(([mark, label, text]) => (
          <button
            type="button"
            role="menuitem"
            key={mark}
            aria-label={label}
            title={label}
            disabled={!hasText || !editor.schema.marks[mark]}
            className="rounded border px-2 py-1 text-sm hover:bg-accent disabled:opacity-40"
            onClick={() => apply(() => formatBlockText(editor, blockId, mark))}
          >
            {text}
          </button>
        ))}
      </div>
      {(['color', 'background'] as const).map((mode) => (
        <details key={mode}>
          <summary className="cursor-pointer py-1 text-sm">
            {mode === 'color' ? 'Text color' : 'Background color'}
          </summary>
          <div className="flex flex-wrap gap-1 py-1">
            {editorColors.map((color) => (
              <button
                type="button"
                role="menuitem"
                key={color.color}
                aria-label={`${mode === 'color' ? 'Text' : 'Background'}: ${color.name}`}
                title={color.name}
                disabled={mode === 'color' && !hasText}
                className={`size-7 rounded border text-sm hover:outline hover:outline-1 ${mode === 'color' ? color.textClass : color.bgClass}`}
                onClick={() =>
                  apply(() =>
                    mode === 'color'
                      ? formatBlockText(editor, blockId, 'color', color.color)
                      : setBlockBackground(editor, blockId, color.color)
                  )
                }
              >
                {color.color === 'default' ? '×' : 'A'}
              </button>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
};
