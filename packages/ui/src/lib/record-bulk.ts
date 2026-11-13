// Modified: typed values for the table's explicit single-field bulk edit.
import type { FieldAttributes, FieldValue } from '@colanode/core';

export const bulkEditableField = (field: FieldAttributes) =>
  [
    'text',
    'url',
    'email',
    'phone',
    'number',
    'date',
    'boolean',
    'select',
    'multi_select',
  ].includes(field.type);

export const bulkFieldValue = (
  field: FieldAttributes,
  value: string,
  clear = false
): FieldValue | null => {
  if (!bulkEditableField(field))
    throw new Error('This field cannot be edited in bulk.');
  if (clear) return null;
  switch (field.type) {
    case 'boolean':
      return { type: 'boolean', value: value === 'true' };
    case 'number': {
      const number = Number(value);
      if (value.trim() === '' || !Number.isFinite(number))
        throw new Error('Enter a valid number.');
      return { type: 'number', value: number };
    }
    case 'select':
      if (!field.options?.[value]) throw new Error('Choose an option.');
      return { type: 'string', value };
    case 'multi_select': {
      const values = value ? value.split(',') : [];
      if (values.some((id) => !field.options?.[id]))
        throw new Error('Choose existing options.');
      return { type: 'string_array', value: values };
    }
    case 'date': {
      const date = new Date(value);
      if (!value || !Number.isFinite(date.getTime()))
        throw new Error('Enter a valid date.');
      return { type: 'string', value: date.toISOString() };
    }
    case 'text':
      return value === '' ? null : { type: 'text', value };
    default:
      return value === '' ? null : { type: 'string', value };
  }
};
