export type BoardCardReorderMutationInput = {
  type: 'board.card.reorder';
  userId: string;
  databaseId: string;
  viewId: string;
  fieldId: string;
  column: string | null;
  visibleIds: string[];
  recordId: string;
  anchorId: string;
  side: 'before' | 'after';
};

declare module '@colanode/client/mutations' {
  interface MutationMap {
    'board.card.reorder': {
      input: BoardCardReorderMutationInput;
      output: { success: boolean };
    };
  }
}
