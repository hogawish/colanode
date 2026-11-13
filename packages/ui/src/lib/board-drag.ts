import type { FieldType, FieldValue } from '@colanode/core';

export const boardRecordDragType = 'board-record';
export const boardGroupFields: FieldType[] = [
  'select',
  'multi_select',
  'collaborator',
  'created_by',
];

export interface BoardRecordDrag {
  recordId: string;
  userId: string;
  databaseId: string;
  viewId: string;
  fieldId: string;
  column: string | null;
  canMoveBetweenColumns?: boolean;
}

export const isEditableBoardGroup = (type: FieldType) =>
  type === 'select' || type === 'multi_select' || type === 'collaborator';

// Undefined means the source column no longer matches the saved record.
// Null clears the field so the card can appear in the unassigned column.
export const getBoardMoveValue = (
  type: FieldType,
  current: FieldValue | undefined,
  source: string | null,
  target: string | null
): FieldValue | null | undefined => {
  if (source === target) return undefined;

  if (type === 'select') {
    const value = current?.type === 'string' ? current.value : null;
    if (value !== source) return undefined;
    return target === null ? null : { type: 'string', value: target };
  }

  if (type === 'multi_select' || type === 'collaborator') {
    const values = current?.type === 'string_array' ? current.value : [];
    const inSource =
      source === null ? values.length === 0 : values.includes(source);
    if (!inSource) return undefined;
    if (target === null) return null;
    return {
      type: 'string_array',
      value: [
        ...new Set([...values.filter((value) => value !== source), target]),
      ],
    };
  }

  return undefined;
};
