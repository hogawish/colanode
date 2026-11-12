import type { RichTextContent } from '@colanode/core';

type NamedItem = { id: string; name: string };
export type SharedPage = {
  name: string;
  content: RichTextContent | null;
  pages: NamedItem[];
  files: NamedItem[];
};
export type PageShareViewer = NamedItem & { email: string };

export type PageShareMutationInput = {
  type: 'page.share';
  userId: string;
  pageId: string;
} & (
  | { action: 'read' }
  | { action: 'list' }
  | { action: 'set'; viewerId: string; enabled: boolean }
);

export type PageShareMutationOutput =
  | { action: 'read'; page: SharedPage }
  | { action: 'list'; viewers: PageShareViewer[] }
  | { action: 'set' };

declare module '@colanode/client/mutations' {
  interface MutationMap {
    'page.share': {
      input: PageShareMutationInput;
      output: PageShareMutationOutput;
    };
  }
}
