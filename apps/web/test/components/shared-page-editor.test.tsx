import { act, render, screen, waitFor } from '@testing-library/react';
import type { Editor } from '@tiptap/react';
import { expect, it, vi } from 'vitest';

import type { RichTextContent } from '@colanode/core';
import { SharedPageEditor } from '@colanode/ui/components/pages/shared-page-editor';

const state = vi.hoisted(() => ({ editor: null as Editor | null }));
vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<typeof import('@tanstack/react-router')>()),
  useBlocker: () => {},
}));
vi.mock('@colanode/ui/components/documents/document-block-menu', () => ({
  DocumentBlockMenu: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@colanode/ui/editor/menus', () => ({
  ActionMenu: () => null,
  ToolbarMenu: ({ editor }: { editor: Editor }) => {
    state.editor = editor;
    return null;
  },
}));

const pageId = 'page';
const blocks: RichTextContent['blocks'] = {
  toggle: { id: 'toggle', type: 'toggle', parentId: pageId, index: 'a0' },
  summary: {
    id: 'summary',
    type: 'paragraph',
    parentId: 'toggle',
    index: 'a0',
    attrs: { blockBackground: 'yellow' },
    content: [{ type: 'text', text: 'Summary' }],
  },
  body: {
    id: 'body',
    type: 'paragraph',
    parentId: 'toggle',
    index: 'a1',
    content: [{ type: 'text', text: 'Body' }],
  },
};

it('serializes edits while preserving toggle IDs and block backgrounds', async () => {
  let completeFirstSave!: () => void;
  const firstSave = new Promise<void>((resolve) => {
    completeFirstSave = resolve;
  });
  const save = vi
    .fn()
    .mockReturnValueOnce(firstSave)
    .mockResolvedValue(undefined);
  render(
    <SharedPageEditor
      pageId={pageId}
      content={{ type: 'rich_text', blocks }}
      onSave={save}
      onUnsupported={() => {}}
    />
  );
  await screen.findByText('Summary');
  expect(screen.queryByRole('alert')).toBeNull();

  function appendToBody(text: string) {
    act(() => {
      const editor = state.editor!;
      let position = 0;
      editor.state.doc.descendants((node, offset) => {
        if (node.attrs.id === 'body') position = offset + node.nodeSize - 1;
      });
      editor.commands.insertContentAt(position, text);
    });
  }
  appendToBody('!');
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  appendToBody('?');
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 550));
  });
  expect(save).toHaveBeenCalledOnce();
  await act(async () => {
    completeFirstSave();
  });
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));

  for (const [index, text] of ['Body!', 'Body!?'].entries()) {
    expect(save.mock.calls[index]?.[0]).toMatchObject({
      blocks: {
        toggle: { id: 'toggle', type: 'toggle', parentId: pageId },
        summary: { parentId: 'toggle', attrs: { blockBackground: 'yellow' } },
        body: { parentId: 'toggle', content: [{ text }] },
      },
    });
  }
  expect(await screen.findByText('Changes saved')).toBeVisible();
});

it('prevents saving a page with a node outside the shared editor schema', async () => {
  const save = vi.fn();
  const content: RichTextContent = {
    type: 'rich_text',
    blocks: {
      unsupported: {
        id: 'unsupported',
        type: 'unsupported',
        parentId: pageId,
        index: 'a0',
      },
    },
  };
  render(
    <SharedPageEditor
      pageId={pageId}
      content={content}
      onSave={save}
      onUnsupported={() => {}}
    />
  );
  expect(await screen.findByRole('alert')).toHaveTextContent('cannot open');
  expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
  expect(save).not.toHaveBeenCalled();
});
