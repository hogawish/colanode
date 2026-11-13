export type TableOrderUpdateMutationInput = {
  type: 'table.order.update';
  userId: string;
  databaseId: string;
  viewId: string;
} & (
  | { action: 'set-mode'; manual: boolean }
  | {
      action: 'reorder';
      visibleIds: string[];
      recordId: string;
      recordIds?: string[];
      anchorId: string;
      side: 'before' | 'after';
    }
);

declare module '@colanode/client/mutations' {
  interface MutationMap {
    'table.order.update': {
      input: TableOrderUpdateMutationInput;
      output: { success: boolean };
    };
  }
}
