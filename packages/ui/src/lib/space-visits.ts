import { collections } from '@colanode/ui/collections';
import { buildMetadataKey } from '@colanode/ui/collections/metadata';

export const spaceVisitsNamespace = (userId: string) =>
  `space-visits:${userId}`;

export const recordSpaceVisit = (userId: string, spaceId: string) => {
  const namespace = spaceVisitsNamespace(userId);
  const metadataKey = buildMetadataKey(namespace, spaceId);
  const now = new Date().toISOString();

  if (collections.metadata.has(metadataKey)) {
    collections.metadata.update(metadataKey, (metadata) => {
      metadata.value = now;
      metadata.updatedAt = now;
    });
  } else {
    collections.metadata.insert({
      namespace,
      key: spaceId,
      value: now,
      createdAt: now,
      updatedAt: null,
    });
  }
};
