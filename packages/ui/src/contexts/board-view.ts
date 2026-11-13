import { createContext, useContext } from 'react';

import { DatabaseViewFilterAttributes, FieldAttributes } from '@colanode/core';

interface BoardViewContext {
  field: FieldAttributes;
  filter: DatabaseViewFilterAttributes;
  columnValue: string | null;
  dragOverClass?: string;
  header: React.ReactNode;
}

export const BoardViewContext = createContext<BoardViewContext>(
  {} as BoardViewContext
);

export const useBoardView = () => useContext(BoardViewContext);
