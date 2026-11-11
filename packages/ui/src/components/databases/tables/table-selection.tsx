// Modified: selection is scoped to this mounted table and its current view.
import { createContext, useContext } from 'react';

import type { LocalRecordNode } from '@colanode/client/types';

export type TableSelection = {
  selected: Set<string>;
  toggle: (record: LocalRecordNode, shift?: boolean) => void;
  openAction: (record: LocalRecordNode, action: 'edit' | 'delete') => void;
};
export const TableSelectionContext = createContext<TableSelection>({
  selected: new Set(),
  toggle: () => {},
  openAction: () => {},
});
export const useTableSelection = () => useContext(TableSelectionContext);
