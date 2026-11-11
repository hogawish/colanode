import { LocalNode } from '@colanode/client/types';
import { ChannelSidebarItem } from '@colanode/ui/components/channels/channel-sidebar-item';
import { ChatSidebarItem } from '@colanode/ui/components/chats/chat-sidebar-item';
import { DatabaseSidebarItem } from '@colanode/ui/components/databases/database-sidiebar-item';
import { ViewSidebarItem } from '@colanode/ui/components/databases/view-sidebar-item';
import { FolderSidebarItem } from '@colanode/ui/components/folders/folder-sidebar-item';
import { SidebarNodeActions } from '@colanode/ui/components/layouts/sidebars/sidebar-node-actions';
import { PageSidebarItem } from '@colanode/ui/components/pages/page-sidebar-item';
import { SpaceSidebarItem } from '@colanode/ui/components/spaces/space-sidebar-item';

interface SidebarItemProps {
  node: LocalNode;
}

export const SidebarItem = ({ node }: SidebarItemProps): React.ReactNode => {
  if (['page', 'database', 'folder', 'channel'].includes(node.type)) {
    return (
      <SidebarNodeActions node={node}>
        <SidebarItemContent node={node} />
      </SidebarNodeActions>
    );
  }
  return <SidebarItemContent node={node} />;
};

const SidebarItemContent = ({ node }: SidebarItemProps): React.ReactNode => {
  switch (node.type) {
    case 'space':
      return <SpaceSidebarItem space={node} />;
    case 'channel':
      return <ChannelSidebarItem channel={node} />;
    case 'chat':
      return <ChatSidebarItem chat={node} />;
    case 'page':
      return <PageSidebarItem page={node} />;
    case 'database':
      return <DatabaseSidebarItem database={node} />;
    case 'database_view':
      return <ViewSidebarItem view={node} />;
    case 'folder':
      return <FolderSidebarItem folder={node} />;
    default:
      return null;
  }
};
