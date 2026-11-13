export const boardColumnOrderKey = (fieldId: string, column: string | null) =>
  JSON.stringify([fieldId, column]);

export const orderRecordIds = (
  ids: readonly string[],
  saved: readonly string[] = []
) => {
  const remaining = new Set(ids);
  return [...saved.filter((id) => remaining.delete(id)), ...remaining];
};

export const moveRecordInOrder = (
  saved: readonly string[],
  visibleIds: readonly string[],
  recordId: string,
  anchorId: string,
  side: 'before' | 'after'
) => {
  return moveRecordsInOrder(saved, visibleIds, [recordId], anchorId, side);
};

export const moveRecordsInOrder = (
  saved: readonly string[],
  visibleIds: readonly string[],
  recordIds: readonly string[],
  anchorId: string,
  side: 'before' | 'after'
) => {
  const visible = new Set(visibleIds);
  const selection = new Set(recordIds);
  if (!visible.has(anchorId) || selection.has(anchorId)) return;

  const all = [...new Set([...saved, ...visibleIds])];
  const current = all.filter((id) => visible.has(id));
  const group = current.filter((id) => selection.has(id));
  if (group.length === 0) return;

  const remaining = current.filter((id) => !selection.has(id));
  const index = remaining.indexOf(anchorId) + (side === 'after' ? 1 : 0);
  const moved = [
    ...remaining.slice(0, index),
    ...group,
    ...remaining.slice(index),
  ];
  if (current.every((id, position) => moved[position] === id)) return;

  // Keep the slots of cards excluded by the view's current filters.
  let position = 0;
  return all.map((id) => (visible.has(id) ? moved[position++]! : id));
};
