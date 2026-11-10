export interface ActivityStamp {
  createdAt: string;
  createdBy: string;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

// A derived view only: never write a fabricated timestamp back to nodes.
export const withRecordActivity = <T extends ActivityStamp & { type: string }>(
  record: T,
  document?: ActivityStamp | null
): T => {
  if (record.type !== 'record') return record;
  const attributeTime = record.updatedAt ?? record.createdAt;
  const documentTime = document?.updatedAt ?? document?.createdAt;
  const bodyIsLater = documentTime && Date.parse(documentTime) > Date.parse(attributeTime);
  return {
    ...record,
    updatedAt: bodyIsLater ? documentTime : attributeTime,
    updatedBy: bodyIsLater
      ? document?.updatedBy ?? document?.createdBy
      : record.updatedBy ?? record.createdBy,
  };
};

// Same derivation before native subset filtering/sorting. Existing UTC ISO values
// are compared; creation metadata and the underlying DB schema stay unchanged.
export const activityNodesSql = `(
  SELECT raw.id, raw.type, raw.parent_id, raw.root_id, raw.attributes,
    raw.local_revision, raw.server_revision, raw.created_at, raw.created_by,
    CASE WHEN raw.type = 'record' THEN
      MAX(COALESCE(raw.updated_at, raw.created_at),
          COALESCE(d.updated_at, d.created_at, raw.created_at))
      ELSE raw.updated_at END AS updated_at,
    CASE WHEN raw.type = 'record' THEN
      CASE WHEN COALESCE(d.updated_at, d.created_at, raw.created_at) >
                     COALESCE(raw.updated_at, raw.created_at)
        THEN COALESCE(d.updated_by, d.created_by)
        ELSE COALESCE(raw.updated_by, raw.created_by) END
      ELSE raw.updated_by END AS updated_by
  FROM nodes raw LEFT JOIN documents d ON d.id = raw.id
)`;
