import type { Node } from '@colanode/core';
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

export const canViewSharedPage = async (
  nodes: readonly Node[],
  viewerId: string
): Promise<boolean> => {
  const pageIds = getPageAncestors(nodes);
  if (!pageIds.length) return false;
  const share = await database
    .selectFrom('page_shares')
    .select('page_id')
    .where('viewer_id', '=', viewerId)
    .where('page_id', 'in', pageIds)
    .executeTakeFirst();
  return Boolean(share);
};
