import { eq, useLiveQuery as useCollectionQuery } from '@tanstack/react-db';

import { FileStatus, formatBytes, formatDate } from '@colanode/core';
import { buttonVariants } from '@colanode/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@colanode/ui/components/ui/dialog';
import { Link } from '@colanode/ui/components/ui/link';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { useLiveQuery } from '@colanode/ui/hooks/use-live-query';

export const PageUnusedImagesDialog = ({
  pageId,
  onClose,
}: {
  pageId: string;
  onClose: () => void;
}) => {
  const { userId, collections } = useWorkspace();
  const document = useLiveQuery({
    type: 'document.get',
    documentId: pageId,
    userId,
  });
  const children = useCollectionQuery(
    (query) =>
      query
        .from({ nodes: collections.nodes })
        .where(({ nodes }) => eq(nodes.parentId, pageId))
        .where(({ nodes }) => eq(nodes.type, 'file'))
        .orderBy(({ nodes }) => nodes.createdAt, 'desc'),
    [userId, pageId]
  );

  const content = document.data?.content;
  const referenced = new Set<string>();
  if (content?.type === 'rich_text') {
    for (const [id, block] of Object.entries(content.blocks)) {
      if (block.type === 'file') {
        referenced.add(id);
        referenced.add(block.id);
      }
    }
  }
  const images = children.data
    .filter((node) => node.type === 'file')
    .filter(
      (file) =>
        file.subtype === 'image' &&
        file.status === FileStatus.Ready &&
        !referenced.has(file.id)
    );
  const size = images.reduce((total, image) => total + image.size, 0);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unused images</DialogTitle>
          <DialogDescription>
            Images uploaded to this page and absent from its saved body. Open a
            file to preview it, save it elsewhere, or delete it from file
            settings.
          </DialogDescription>
        </DialogHeader>
        {document.isError || children.isError ? (
          <p role="alert" className="text-sm">
            Could not check the images on this page.
          </p>
        ) : document.isPending || children.isLoading ? (
          <p role="status" className="text-sm">
            Checking images…
          </p>
        ) : images.length > 0 ? (
          <>
            <p className="text-sm text-muted-foreground">
              {images.length} {images.length === 1 ? 'image' : 'images'} ·{' '}
              {formatBytes(size)}
            </p>
            <ul className="max-h-[50dvh] divide-y overflow-y-auto">
              {images.map((image) => (
                <li
                  key={image.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium" title={image.name}>
                      {image.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(image.size)} · {formatDate(image.createdAt)}
                    </p>
                  </div>
                  <Link
                    to="/workspace/$userId/$nodeId/modal/$modalNodeId"
                    params={{ userId, nodeId: pageId, modalNodeId: image.id }}
                    className={buttonVariants({
                      variant: 'outline',
                      size: 'sm',
                    })}
                    onClick={onClose}
                    aria-label={`Open ${image.name}`}
                  >
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm">No unused images on this page.</p>
        )}
      </DialogContent>
    </Dialog>
  );
};
