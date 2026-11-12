export type SharedPageListItem = {
  id: string;
  name: string;
};

export type SharedPagesListQueryInput = {
  type: 'shared.pages.list';
  userId: string;
};

declare module '@colanode/client/queries' {
  interface QueryMap {
    'shared.pages.list': {
      input: SharedPagesListQueryInput;
      output: SharedPageListItem[];
    };
  }
}
