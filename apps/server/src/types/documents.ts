import { DocumentContent } from '@colanode/core';
import { SelectDocument } from '@colanode/server/data/schema';

export type CreateDocumentInput = {
  nodeId: string;
  content: DocumentContent;
  userId: string;
  workspaceId: string;
};

export type CreateDocumentOutput = {
  document: SelectDocument;
};

export type UpdateDocumentInput = {
  documentId: string;
  userId: string;
  workspaceId: string;
  expectedRevision?: string | null;
  updater: (content: DocumentContent) => DocumentContent | null;
};
