import {
  createCollection,
  localOnlyCollectionOptions,
} from '@tanstack/react-db';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import type {
  LocalNode,
  LocalSpaceNode,
  Metadata,
} from '@colanode/client/types';
import { SpaceSidebarVisibilityDialog } from '@colanode/ui/components/spaces/space-sidebar-visibility-dialog';
import {
  SidebarVisibilityContext,
  useSpaceSidebarVisibility,
} from '@colanode/ui/contexts/sidebar-visibility';

const state = vi.hoisted(() => ({
  userId: 'human',
  nodes: null as unknown,
  metadata: null as unknown,
}));
vi.mock('@colanode/ui/collections', () => ({
  collections: {
    get metadata() {
      return state.metadata;
    },
  },
}));
vi.mock('@colanode/ui/contexts/workspace', () => ({
  useWorkspace: () => ({
    userId: state.userId,
    collections: { nodes: state.nodes },
  }),
}));

const space = {
  id: 'space',
  type: 'space',
  name: 'Work',
  collaborators: { human: 'admin', other: 'editor' },
  children: { archived: { id: 'archived', archived: true } },
} as LocalSpaceNode;
const nodes = [
  { id: 'hidden', name: 'My hidden page' },
  { id: 'archived', name: 'Shared archived page' },
].map((node) => ({ ...node, type: 'page', rootId: 'space' })) as LocalNode[];

const Sidebar = () => {
  const visibility = useSpaceSidebarVisibility(space);
  return (
    <SidebarVisibilityContext.Provider value={visibility}>
      <section aria-label="Sidebar">
        {nodes
          .filter((node) => visibility.isVisible(node.id))
          .map((node) => (
            <span key={node.id}>{node.id}</span>
          ))}
      </section>
      <button onClick={() => void visibility.setHidden('hidden', true)}>
        Hide My hidden page
      </button>
      <SpaceSidebarVisibilityDialog onClose={() => {}} />
    </SidebarVisibilityContext.Provider>
  );
};

it('restores a local hide independently of the shared archive and scopes the actions to this member', async () => {
  const namespace = 'sidebar-hidden:human:space';
  const metadata = createCollection(
    localOnlyCollectionOptions<Metadata>({
      getKey: (item) => `${item.namespace}.${item.key}`,
      initialData: [
        {
          namespace,
          key: 'hidden',
          value: 'true',
          createdAt: '',
          updatedAt: null,
        },
      ],
    })
  );
  state.metadata = metadata;
  state.nodes = createCollection(
    localOnlyCollectionOptions<LocalNode>({
      getKey: (node) => node.id,
      initialData: nodes,
    })
  );
  const executeMutation = vi.fn(async (input) => {
    if (input.type === 'metadata.delete') {
      metadata.delete(`${input.namespace}.${input.key}`);
    } else if (input.type === 'metadata.update') {
      metadata.insert({
        namespace: input.namespace,
        key: input.key,
        value: input.value,
        createdAt: '',
        updatedAt: null,
      });
    }
    return { success: true, output: { success: true } };
  });
  Object.assign(window, { colanode: { executeMutation } });
  const view = render(<Sidebar />);
  const show = await screen.findByRole('button', {
    name: 'Show My hidden page',
  });
  const sidebar = view.container.querySelector('section')!;
  expect(sidebar).toBeEmptyDOMElement();
  fireEvent.click(show);
  await waitFor(() => expect(sidebar).toHaveTextContent('hidden'));
  expect(executeMutation).toHaveBeenCalledWith({
    type: 'metadata.delete',
    namespace,
    key: 'hidden',
  });
  expect(sidebar).not.toHaveTextContent('archived');
  fireEvent.click(
    screen.getByRole('button', { name: 'Restore Shared archived page' })
  );
  expect(executeMutation).toHaveBeenCalledWith({
    type: 'space.child.archive',
    userId: 'human',
    spaceId: 'space',
    childId: 'archived',
    archived: false,
  });

  fireEvent.click(screen.getByText('Hide My hidden page'));
  await waitFor(() => expect(sidebar).toBeEmptyDOMElement());
  expect(executeMutation).toHaveBeenCalledWith({
    type: 'metadata.update',
    namespace,
    key: 'hidden',
    value: 'true',
  });

  state.userId = 'other';
  view.rerender(<Sidebar />);
  expect(
    screen.queryByRole('button', { name: 'Restore Shared archived page' })
  ).toBeNull();
  expect(screen.getByText('Shared archived page')).toBeInTheDocument();
  await waitFor(() => expect(sidebar).toHaveTextContent('hidden'));
  expect(sidebar).not.toHaveTextContent('archived');
});
