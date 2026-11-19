import type { FileSubtype } from './files';
import type { RichTextContent } from '../registry/documents/rich-text';
import type { FieldAttributes } from '../registry/nodes/field';
import type { FieldValue } from '../registry/nodes/field-value';

export type PageExportKind = 'page' | 'folder' | 'database' | 'record';
export type PageExportChild = {
  id: string;
  name: string;
  kind: PageExportKind;
};
export type PageExportSnapshot = PageExportChild & {
  content: RichTextContent | null;
  fields?: Record<string, FieldAttributes>;
  values?: Record<string, FieldValue>;
  nameField?: string;
  metadata?: {
    createdAt: string;
    updatedAt: string | null;
    createdBy: string;
    updatedBy: string | null;
  };
  files: { id: string; name: string; subtype: FileSubtype; mimeType: string }[];
  children: PageExportChild[];
  nextOffset: number | null;
};
