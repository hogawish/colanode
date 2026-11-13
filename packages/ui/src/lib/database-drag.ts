export const databaseRecordDragMime = 'application/x-colanode-database-record';

export const isDatabaseRecordDrag = (event: {
  dataTransfer: DataTransfer | null;
}) => event.dataTransfer?.types.includes(databaseRecordDragMime) ?? false;

export const getRecordDropSide = (record: HTMLElement | null, y?: number) => {
  const bounds = record?.getBoundingClientRect();
  return bounds && y !== undefined && y > bounds.top + bounds.height / 2
    ? 'after'
    : 'before';
};
