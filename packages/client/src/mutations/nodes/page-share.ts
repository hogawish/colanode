import type {
  Block,
  DatabaseNode,
  DatabaseViewNode,
  FileSubtype,
  RecordNode,
  RichTextContent,
} from '@colanode/core';

type NamedItem = { id: string; name: string };
type SharedChild = NamedItem & { avatar?: string };
type Placement = Pick<Block, 'id' | 'parentId' | 'index'>;
export type SharedDatabase = {
  database: DatabaseNode;
  nodes: (DatabaseViewNode | RecordNode)[];
  initialViewId?: string;
};
export type SharedFile = NamedItem & {
  mimeType?: string;
  subtype?: FileSubtype;
};
export type SharedPage = {
  name: string;
  content: RichTextContent | null;
  revision: string | null;
  canEdit: boolean;
  pages: SharedChild[];
  pagePlacements?: Placement[];
  databases?: SharedChild[];
  databasePlacements?: (Placement & { inline: boolean })[];
  linkedDatabasePlacements?: Placement[];
  files: SharedFile[];
  filePlacements?: Placement[];
};
export type PageShareRole = 'viewer' | 'editor';
export type PageShareInvitation = { email: string; role: PageShareRole };
export type PageShareViewer = NamedItem & PageShareInvitation;
export type ManagedPageShare = NamedItem & { role: PageShareRole };

type PageShareAction =
  | { action: 'read' }
  | { action: 'read-database'; databaseId: string }
  | { action: 'read-linked-database'; blockId: string }
  | { action: 'list' }
  | { action: 'set'; viewerId: string; enabled: boolean; role?: PageShareRole }
  | ({ action: 'invite' } & PageShareInvitation)
  | { action: 'cancel-invitation'; email: string }
  | { action: 'edit'; revision: string | null; content: RichTextContent };

export type PageShareMutationInput = {
  type: 'page.share';
  userId: string;
} & (
  | { action: 'list-user'; viewerId: string }
  | ({ pageId: string } & PageShareAction)
);

export type PageShareMutationOutput =
  | { action: 'read'; page: SharedPage }
  | { action: 'read-database'; database: SharedDatabase }
  | { action: 'list-user'; pages: ManagedPageShare[] }
  | {
      action: 'list';
      viewers: PageShareViewer[];
      invitations: PageShareInvitation[];
    }
  | { action: 'invite'; token?: string }
  | { action: 'set' | 'cancel-invitation' | 'edit' };

declare module '@colanode/client/mutations' {
  interface MutationMap {
    'page.share': {
      input: PageShareMutationInput;
      output: PageShareMutationOutput;
    };
  }
}
