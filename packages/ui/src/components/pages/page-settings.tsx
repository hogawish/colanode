import {
  Copy,
  Image,
  LetterText,
  Link2,
  Settings,
  Share2,
  Trash2,
} from 'lucide-react';
import { Fragment, useState } from 'react';
import { toast } from 'sonner';

import { LocalPageNode } from '@colanode/client/types';
import { NodeRole, hasNodeRole } from '@colanode/core';
import { NodeCollaboratorAudit } from '@colanode/ui/components/collaborators/node-collaborator-audit';
import { NodeDeleteDialog } from '@colanode/ui/components/nodes/node-delete-dialog';
import { PageShareDialog } from '@colanode/ui/components/pages/page-share-dialog';
import { PageUpdateDialog } from '@colanode/ui/components/pages/page-update-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@colanode/ui/components/ui/dropdown-menu';
import { useApp } from '@colanode/ui/contexts/app';
import { useWorkspace } from '@colanode/ui/contexts/workspace';

interface PageSettingsProps {
  page: LocalPageNode;
  role: NodeRole;
}

export const PageSettings = ({ page, role }: PageSettingsProps) => {
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteModal] = useState(false);

  const [showShareDialog, setShowShareDialog] = useState(false);
  const app = useApp();
  const { workspaceId } = useWorkspace();
  const canShare = app.type === 'web' && hasNodeRole(role, 'admin');

  const canEdit = hasNodeRole(role, 'editor');
  const canDelete = hasNodeRole(role, 'editor');

  return (
    <Fragment>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Settings className="size-4 cursor-pointer text-muted-foreground hover:text-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" className="mr-2 w-80">
          <DropdownMenuLabel>{page.name}</DropdownMenuLabel>
          {canShare && (
            <DropdownMenuItem onSelect={() => setShowShareDialog(true)}>
              <Share2 className="size-4" /> Share page
            </DropdownMenuItem>
          )}
          {app.type === 'web' && (
            <DropdownMenuItem
              onSelect={async () => {
                try {
                  const link = new URL(
                    `/${workspaceId}/shared/${page.id}`,
                    window.location.origin
                  );
                  await navigator.clipboard.writeText(link.href);
                  toast.success('Page link copied');
                } catch {
                  toast.error('Could not copy the page link.');
                }
              }}
            >
              <Link2 className="size-4" /> Copy page link
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => {
              if (!canEdit) {
                return;
              }

              setShowUpdateDialog(true);
            }}
            disabled={!canEdit}
          >
            <LetterText className="size-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex items-center gap-2 cursor-pointer"
            disabled={!canEdit}
            onClick={() => {
              if (!canEdit) {
                return;
              }

              setShowUpdateDialog(true);
            }}
          >
            <Image className="size-4" />
            Update icon
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex items-center gap-2 cursor-pointer"
            disabled
          >
            <Copy className="size-4" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => {
              if (!canDelete) {
                return;
              }

              setShowDeleteModal(true);
            }}
            disabled={!canDelete}
          >
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Created by</DropdownMenuLabel>
          <DropdownMenuItem>
            <NodeCollaboratorAudit
              collaboratorId={page.createdBy}
              date={page.createdAt}
            />
          </DropdownMenuItem>
          {page.updatedBy && page.updatedAt && (
            <Fragment>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Last updated by</DropdownMenuLabel>
              <DropdownMenuItem>
                <NodeCollaboratorAudit
                  collaboratorId={page.updatedBy}
                  date={page.updatedAt}
                />
              </DropdownMenuItem>
            </Fragment>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {showShareDialog && (
        <PageShareDialog
          pageId={page.id}
          onClose={() => setShowShareDialog(false)}
        />
      )}
      <NodeDeleteDialog
        id={page.id}
        title="Are you sure you want delete this page?"
        description="This action cannot be undone. This page will no longer be accessible by you or others you've shared it with."
        open={showDeleteDialog}
        onOpenChange={setShowDeleteModal}
      />
      <PageUpdateDialog
        page={page}
        role={role}
        open={showUpdateDialog}
        onOpenChange={setShowUpdateDialog}
      />
    </Fragment>
  );
};
