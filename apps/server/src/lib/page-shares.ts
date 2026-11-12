import type { DocumentContent, Node, RichTextContent } from '@colanode/core';
import { database } from '@colanode/server/data/database';

export const getPageAncestors = (nodes: readonly Node[]): string[] => {
  const ancestors: string[] = [];
  for (let index = nodes.length - 1; index >= 0; index--) {
    const node = nodes[index]!;
    if (node.type !== 'page') break;
    ancestors.push(node.id);
  }
  return ancestors;
};

export type PageShareRole = 'viewer' | 'editor';

export const getSharedPageRole = async (
  nodes: readonly Node[],
  viewerId: string
): Promise<PageShareRole | null> => {
  const pageIds = getPageAncestors(nodes);
  if (!pageIds.length) return null;
  const shares = await database
    .selectFrom('page_shares')
    .select('role')
    .where('viewer_id', '=', viewerId)
    .where('page_id', 'in', pageIds)
    .execute();
  if (shares.some((share) => share.role === 'editor')) return 'editor';
  return shares.length ? 'viewer' : null;
};

export const canViewSharedPage = async (
  nodes: readonly Node[],
  viewerId: string
) => (await getSharedPageRole(nodes, viewerId)) !== null;

const referenceTypes = new Set([
  'page',
  'file',
  'folder',
  'database',
  'tempFile',
]);

export const sharedPageBody = (content: RichTextContent): RichTextContent => ({
  type: 'rich_text',
  blocks: Object.fromEntries(
    Object.entries(content.blocks).filter(
      ([, block]) => !referenceTypes.has(block.type)
    )
  ),
});

export const isInSharedPageBody = (
  pageId: string,
  parentId: string,
  body: RichTextContent
) => {
  const visited = new Set<string>();
  while (parentId !== pageId) {
    const parent = body.blocks[parentId];
    if (!parent || visited.has(parentId)) return false;
    visited.add(parentId);
    parentId = parent.parentId;
  }
  return true;
};

export const mergeSharedPageBody = (
  pageId: string,
  original: DocumentContent | null,
  body: RichTextContent
): RichTextContent | null => {
  const current = original?.type === 'rich_text' ? original.blocks : {};
  const blocks = new Map(Object.entries(body.blocks));
  for (const [id, block] of blocks) {
    if (id !== block.id || id === pageId || referenceTypes.has(block.type))
      return null;
  }
  // Preserve the original references and the containers holding them.
  for (const [id, block] of Object.entries(current)) {
    if (!referenceTypes.has(block.type)) continue;
    if (blocks.has(id)) return null;
    blocks.set(id, block);
    let parentId = block.parentId;
    const visited = new Set<string>([id]);
    while (parentId !== pageId && current[parentId] && !visited.has(parentId)) {
      visited.add(parentId);
      const parent = current[parentId]!;
      const edited = blocks.get(parentId);
      if (
        edited &&
        (edited.parentId !== parent.parentId || edited.type !== parent.type)
      )
        return null;
      if (!edited) blocks.set(parentId, parent);
      parentId = parent.parentId;
    }
  }
  // Ensure the edited tree is reachable from the same page and cannot form cycles.
  const reachable = new Set([pageId]);
  for (const block of blocks.values()) {
    const path = new Set<string>();
    let id = block.id;
    while (!reachable.has(id)) {
      const node = blocks.get(id);
      if (!node || path.has(id)) return null;
      path.add(id);
      id = node.parentId;
    }
    for (const ancestor of path) reachable.add(ancestor);
  }
  return { type: 'rich_text', blocks: Object.fromEntries(blocks) };
};
