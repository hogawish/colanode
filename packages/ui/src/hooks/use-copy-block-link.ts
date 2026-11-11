import { toast } from 'sonner';

import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { buildBlockLink } from '@colanode/ui/lib/block-links';

export const useCopyBlockLink = (documentId: string) => {
  const workspace = useWorkspace();
  return async (blockId: string | null) => {
    if (!blockId) return;
    try {
      await navigator.clipboard.writeText(
        buildBlockLink(
          window.location.origin,
          workspace.workspaceId,
          documentId,
          blockId
        )
      );
      toast.success('Block link copied');
    } catch {
      toast.error(
        'Could not copy the block link. Please allow clipboard access.'
      );
    }
  };
};
