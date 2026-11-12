export const boardColumnOrderKey = (fieldId: string, column: string | null) =>
  JSON.stringify([fieldId, column]);

export const orderBoardCardIds = (
  ids: readonly string[],
  saved: readonly string[] = []
) => {
  const remaining = new Set(ids);
  return [...saved.filter((id) => remaining.delete(id)), ...remaining];
};

export const moveBoardCard = (
  saved: readonly string[],
  visibleIds: readonly string[],
  recordId: string,
  anchorId: string,
  side: 'before' | 'after'
) => {
  if (recordId === anchorId) return;
  const visible = new Set(visibleIds);
  if (!visible.has(recordId) || !visible.has(anchorId)) return;

  const all = [...new Set([...saved, ...visibleIds])];
  const current = all.filter((id) => visible.has(id));
  const moved = current.filter((id) => id !== recordId);
  const index = moved.indexOf(anchorId) + (side === 'after' ? 1 : 0);
  moved.splice(index, 0, recordId);
  if (current.every((id, position) => moved[position] === id)) return;

  // Keep the slots of cards excluded by the view's current filters.
  let position = 0;
  return all.map((id) => (visible.has(id) ? moved[position++]! : id));
};
