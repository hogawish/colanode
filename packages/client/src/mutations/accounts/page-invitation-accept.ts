export type PageInvitationAcceptInput = {
  type: 'page.invitation.accept';
  accountId: string;
  token: string;
  server: string;
};

export type PageInvitationAcceptOutput = {
  workspaceId: string;
  pageId: string;
};

declare module '@colanode/client/mutations' {
  interface MutationMap {
    'page.invitation.accept': {
      input: PageInvitationAcceptInput;
      output: PageInvitationAcceptOutput;
    };
  }
}
