export type SpaceChildArchiveMutationInput = {
  type: 'space.child.archive';
  userId: string;
  spaceId: string;
  childId: string;
  archived: boolean;
};

declare module '@colanode/client/mutations' {
  interface MutationMap {
    'space.child.archive': {
      input: SpaceChildArchiveMutationInput;
      output: { success: boolean };
    };
  }
}
