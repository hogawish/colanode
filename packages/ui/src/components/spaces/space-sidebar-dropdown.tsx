import { useNavigate } from '@tanstack/react-router';
import {
  Archive,
  Database,
  Ellipsis,
  Eye,
  EyeOff,
  Folder,
  Link2,
  MessageCircle,
  Pin,
  PinOff,
  Plus,
  Settings,
  StickyNote,
  Upload,
} from 'lucide-react';
import { Fragment, useState } from 'react';

import { LocalSpaceNode } from '@colanode/client/types';
import { ChannelCreateDialog } from '@colanode/ui/components/channels/channel-create-dialog';
import { DatabaseCreateDialog } from '@colanode/ui/components/databases/database-create-dialog';
import { FolderCreateDialog } from '@colanode/ui/components/folders/folder-create-dialog';
import { NotionImportDialog } from '@colanode/ui/components/pages/notion-import-dialog';
import { PageCreateDialog } from '@colanode/ui/components/pages/page-create-dialog';
import { ManageSpacePageReferences } from '@colanode/ui/components/spaces/space-page-references';
import { SpaceSidebarVisibilityDialog } from '@colanode/ui/components/spaces/space-sidebar-visibility-dialog';
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

interface SpaceSidebarDropdownProps {
  space: LocalSpaceNode;
  pinned?: boolean;
  onTogglePin?: () => void;
  hidden?: boolean;
  onToggleHidden?: () => void;
}

export const SpaceSidebarDropdown = ({
  space,
  pinned,
  onTogglePin,
  hidden,
  onToggleHidden,
}: SpaceSidebarDropdownProps) => {
  const navigate = useNavigate({ from: '/workspace/$userId' });
  const app = useApp();
  const { userId } = useWorkspace();

  const [openCreatePage, setOpenCreatePage] = useState(false);
  const [openCreateChannel, setOpenCreateChannel] = useState(false);
  const [openCreateDatabase, setOpenCreateDatabase] = useState(false);
  const [openCreateFolder, setOpenCreateFolder] = useState(false);
  const [openVisibility, setOpenVisibility] = useState(false);
  const [openReferences, setOpenReferences] = useState(false);
  const [openImport, setOpenImport] = useState(false);

  return (
    <Fragment>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={space.name + ' options'}
            className="text-muted-foreground opacity-0 transition-opacity group-hover/sidebar-space:opacity-100 focus-visible:opacity-100 flex items-center justify-center p-0 mr-1 size-4 cursor-pointer"
          >
            <Ellipsis />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="ml-1 w-72">
          <DropdownMenuLabel>{space.name ?? 'Unnamed'}</DropdownMenuLabel>
          {['admin', 'editor'].includes(space.collaborators[userId] ?? '') && (
            <DropdownMenuItem onSelect={() => setOpenImport(true)}>
              <Upload className="size-4" /> Import from Notion
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {onTogglePin && (
            <DropdownMenuItem onSelect={onTogglePin}>
              {pinned ? (
                <PinOff className="size-4" />
              ) : (
                <Pin className="size-4" />
              )}
              {pinned ? 'Unpin Space' : 'Pin Space'}
            </DropdownMenuItem>
          )}
          {onToggleHidden && (
            <DropdownMenuItem onSelect={onToggleHidden}>
              {hidden ? (
                <Eye className="size-4" />
              ) : (
                <EyeOff className="size-4" />
              )}
              {hidden ? 'Show Space again' : 'Hide Space for me'}
            </DropdownMenuItem>
          )}
          {app.type === 'web' && space.collaborators[userId] === 'admin' && (
            <DropdownMenuItem onSelect={() => setOpenReferences(true)}>
              <Link2 className="size-4" /> Page references
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() => setOpenCreatePage(true)}
            className="flex flex-row items-center gap-2 cursor-pointer"
          >
            <StickyNote className="size-4" />
            <span>Add page</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setOpenCreateChannel(true)}
            className="flex flex-row items-center gap-2 cursor-pointer"
          >
            <MessageCircle className="size-4" />
            <span>Add channel</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setOpenCreateDatabase(true)}
            className="flex flex-row items-center gap-2 cursor-pointer"
          >
            <Database className="size-4" />
            <span>Add database</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setOpenCreateFolder(true)}
            className="flex flex-row items-center gap-2 cursor-pointer"
          >
            <Folder className="size-4" />
            <span>Add folder</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setOpenVisibility(true)}
            className="flex flex-row items-center gap-2 cursor-pointer"
          >
            <Archive className="size-4" />
            <span>Hidden and archived</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              navigate({
                to: '$nodeId',
                params: { nodeId: space.id },
              })
            }
            className="flex flex-row items-center gap-2 cursor-pointer"
          >
            <Settings className="size-4" />
            <span>Settings</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              navigate({
                to: '$nodeId',
                params: { nodeId: space.id },
              })
            }
            className="flex flex-row items-center gap-2 cursor-pointer"
          >
            <Plus className="size-4" />
            <span>Add collaborators</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {openReferences && (
        <ManageSpacePageReferences
          space={space}
          onClose={() => setOpenReferences(false)}
        />
      )}
      {openImport && (
        <NotionImportDialog
          parentId={space.id}
          onClose={() => setOpenImport(false)}
        />
      )}
      {openVisibility && (
        <SpaceSidebarVisibilityDialog
          onClose={() => setOpenVisibility(false)}
        />
      )}
      {openCreateChannel && (
        <ChannelCreateDialog
          spaceId={space.id}
          open={openCreateChannel}
          onOpenChange={setOpenCreateChannel}
        />
      )}
      {openCreatePage && (
        <PageCreateDialog
          spaceId={space.id}
          open={openCreatePage}
          onOpenChange={setOpenCreatePage}
        />
      )}
      {openCreateDatabase && (
        <DatabaseCreateDialog
          spaceId={space.id}
          open={openCreateDatabase}
          onOpenChange={setOpenCreateDatabase}
        />
      )}
      {openCreateFolder && (
        <FolderCreateDialog
          spaceId={space.id}
          open={openCreateFolder}
          onOpenChange={setOpenCreateFolder}
        />
      )}
    </Fragment>
  );
};
