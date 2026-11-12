import type { Block, RichTextContent } from '@colanode/core';

type NamedItem = { id: string; name: string };
export type SharedPage = {
  name: string;
  content: RichTextContent | null;
  revision: string | null;
  canEdit: boolean;
  pages: (NamedItem & { avatar?: string })[];
  pagePlacements?: Pick<Block, 'id' | 'parentId' | 'index'>[];
  files: NamedItem[];
};
export type PageShareRole = 'viewer' | 'editor';
export type PageShareInvitation = { email: string; role: PageShareRole };
export type PageShareViewer = NamedItem & PageShareInvitation;

export type PageShareMutationInput = {
  type: 'page.share';
  userId: string;
  pageId: string;
} & (
  | { action: 'read' }
  | { action: 'list' }
  | { action: 'set'; viewerId: string; enabled: boolean }
  | ({ action: 'invite' } & PageShareInvitation)
  | { action: 'cancel-invitation'; email: string }
  | { action: 'edit'; revision: string | null; content: RichTextContent }
);

export type PageShareMutationOutput =
  | { action: 'read'; page: SharedPage }
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
