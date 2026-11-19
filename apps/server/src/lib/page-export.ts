import {
  extractNodeRole,
  FileStatus,
  hasNodeRole,
  richTextContentSchema,
  type Node,
  type PageExportChild,
  type PageExportSnapshot,
} from '@colanode/core';
import { database } from '@colanode/server/data/database';
import { fetchNodeTree, mapNode } from '@colanode/server/lib/nodes';
import {
  canViewSharedPage,
  isSharedFileBlock,
} from '@colanode/server/lib/page-shares';

const kinds = new Set(['page', 'folder', 'database', 'record']);

// Match page sharing, including a page's database and its own records. A folder
// is not a page-share inheritance bridge; links never grant source access.
export const canReadExportTree = async (
  tree: Node[],
  userId: string
): Promise<boolean> => {
  const node = tree.at(-1);
  if (!node || !kinds.has(node.type)) return false;
  if (
    node.type === 'record' &&
    (tree.at(-2)?.type !== 'database' || node.databaseId !== tree.at(-2)?.id)
  )
    return false;
  const role = extractNodeRole(tree, userId);
  if (role && hasNodeRole(role, 'viewer')) return true;
  if (node.type === 'page') return canViewSharedPage(tree, userId);
  if (node.type === 'database' && tree.at(-2)?.type === 'page')
    return canViewSharedPage(tree.slice(0, -1), userId);
  if (
    node.type === 'record' &&
    tree.at(-2)?.type === 'database' &&
    node.databaseId === tree.at(-2)?.id &&
    tree.at(-3)?.type === 'page'
  )
    return canViewSharedPage(tree.slice(0, -2), userId);
  return false;
};

export const readPageExport = async (
  workspaceId: string,
  userId: string,
  nodeId: string,
  offset: number
): Promise<PageExportSnapshot | null> => {
  const rows = await fetchNodeTree(nodeId);
  if (
    rows.at(-1)?.id !== nodeId ||
    rows.some((row) => row.workspace_id !== workspaceId)
  )
    return null;
  const tree = rows.map(mapNode);
  const node = tree.at(-1)!;
  if (!(await canReadExportTree(tree, userId)) || !('name' in node))
    return null;
  const [document, childRows, fileRows] = await Promise.all([
    database
      .selectFrom('documents')
      .select('content')
      .where('id', '=', nodeId)
      .where('workspace_id', '=', workspaceId)
      .executeTakeFirst(),
    database
      .selectFrom('nodes')
      .selectAll()
      .where('workspace_id', '=', workspaceId)
      .where('parent_id', '=', nodeId)
      .where('type', 'in', ['page', 'folder', 'database', 'record'])
      .orderBy('id', 'asc')
      .offset(offset)
      .limit(200)
      .execute(),
    database
      .selectFrom('nodes')
      .selectAll()
      .where('workspace_id', '=', workspaceId)
      .where('parent_id', '=', nodeId)
      .where('type', '=', 'file')
      .execute(),
  ]);
  const parsed = richTextContentSchema.safeParse(document?.content);
  const content = parsed.success ? parsed.data : null;
  const children: PageExportChild[] = [];
  for (const row of childRows) {
    const child = mapNode(row);
    if (!('name' in child)) continue;
    // Reject malformed record ownership as well as inaccessible descendants.
    if (
      child.type === 'record' &&
      (node.type !== 'database' || child.databaseId !== nodeId)
    )
      continue;
    if (await canReadExportTree([...tree, child], userId)) {
      children.push({
        id: child.id,
        name: child.name ?? 'Untitled',
        kind: child.type as PageExportChild['kind'],
      });
    }
  }
  const files: PageExportSnapshot['files'] = [];
  for (const row of fileRows) {
    const file = mapNode(row);
    if (
      file.type === 'file' &&
      file.status === FileStatus.Ready &&
      content &&
      isSharedFileBlock(content, nodeId, file.id)
    ) {
      files.push({
        id: file.id,
        name: file.name,
        subtype: file.subtype,
        mimeType: file.mimeType,
      });
    }
  }
  return {
    id: nodeId,
    name: node.name ?? 'Untitled',
    kind: node.type as PageExportSnapshot['kind'],
    content,
    files,
    children,
    nextOffset: childRows.length === 200 ? offset + 200 : null,
    ...(node.type === 'database' && {
      fields: node.fields,
      nameField: node.nameField?.name ?? 'Name',
    }),
    ...(node.type === 'record' && {
      values: node.fields,
      metadata: {
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        createdBy: node.createdBy,
        updatedBy: node.updatedBy,
      },
    }),
  };
};
