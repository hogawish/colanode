import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RichTextContent } from '@colanode/core';
import { SharedPageDocument } from '@colanode/ui/components/pages/shared-page-document';

const route = vi.hoisted(() => ({ hash: 'block=nested' }));
vi.mock(import('@tanstack/react-router'), async (original) => ({
  ...(await original()),
  Link: ({
    children,
    params,
  }: {
    children: React.ReactNode;
    params: { pageId: string };
  }) => <a href={`/workspace/shared/${params.pageId}`}>{children}</a>,
  useRouterState: () => route.hash,
}));
vi.mock('@colanode/ui/contexts/app', () => ({
  useApp: () => ({ type: 'web' }),
}));
vi.mock('react-intersection-observer', () => ({
  useInView: () => ({ ref: () => {}, inView: true }),
  InView: () => null,
}));
vi.mock('@colanode/ui/components/files/file-save-button', () => ({
  FileSaveButton: () => <button type="button">Save</button>,
}));
vi.mock('@colanode/ui/contexts/workspace', () => ({
  useWorkspace: () => ({ workspaceId: 'workspace' }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const content: RichTextContent = {
  type: 'rich_text',
  blocks: {
    divider: {
      id: 'divider',
      type: 'horizontalRule',
      parentId: 'page',
      index: 'a0',
    },
    toggle: { id: 'toggle', type: 'toggle', parentId: 'page', index: 'a1' },
    summary: {
      id: 'summary',
      type: 'paragraph',
      parentId: 'toggle',
      index: 'a0',
      content: [{ type: 'text', text: 'Details' }],
    },
    nested: {
      id: 'nested',
      type: 'paragraph',
      parentId: 'toggle',
      index: 'a1',
      content: [{ type: 'text', text: 'Nested content' }],
    },
  },
};

beforeEach(() => {
  route.hash = 'block=nested';
  HTMLElement.prototype.scrollIntoView = vi.fn();
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

describe('shared page blocks', () => {
  it('shows a shared image inline using its authenticated file request', async () => {
    const query = vi
      .fn()
      .mockResolvedValue({
        url: '/test-file',
        headers: { authorization: 'test' },
      });
    const fetchFile = vi
      .fn()
      .mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob()) });
    vi.stubGlobal('colanode', { executeQuery: query });
    vi.stubGlobal('fetch', fetchFile);
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL() {
          return 'blob:preview';
        }
        static revokeObjectURL() {}
      }
    );
    render(
      <SharedPageDocument
        pageId="page"
        content={content}
        files={[{ id: 'imagefi', name: 'Example image', subtype: 'image' }]}
        filePlacements={[{ id: 'imagefi', parentId: 'toggle', index: 'a2' }]}
      />
    );
    const image = await screen.findByRole('img', { name: 'Example image' });
    expect(image.closest('details')).toBe(
      screen.getByText('Nested content').closest('details')
    );
    expect(image).toHaveAttribute('src', 'blob:preview');
    expect(fetchFile).toHaveBeenCalledWith(
      '/test-file',
      expect.objectContaining({
        headers: { authorization: 'test' },
        cache: 'no-store',
      })
    );
  });

  it('renders a shared child page as a link in its saved position inside a toggle', () => {
    render(
      <SharedPageDocument
        pageId="page"
        content={content}
        pages={[{ id: 'childpg', name: 'Child page' }]}
        pagePlacements={[{ id: 'childpg', parentId: 'toggle', index: 'a2' }]}
      />
    );
    const child = screen.getByText('Child page');
    const previousBlock = screen.getByText('Nested content');
    expect(child.closest('details')).toBe(previousBlock.closest('details'));
    expect(child.closest('a')).toHaveAttribute(
      'href',
      '/workspace/shared/childpg'
    );
    expect(previousBlock.compareDocumentPosition(child)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it('renders a divider and opens the toggle before scrolling to a linked child', async () => {
    render(<SharedPageDocument pageId="page" content={content} />);
    const nested = screen.getByText('Nested content');
    expect(screen.getByRole('separator')).toBeVisible();
    await waitFor(() =>
      expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
        block: 'center',
        behavior: 'auto',
      })
    );
    expect(
      vi.mocked(HTMLElement.prototype.scrollIntoView).mock.contexts[0]
    ).toBe(nested);
    expect(nested.closest('details')).toHaveAttribute('open');
  });

  it('copies a canonical link for the selected block in view-only mode', async () => {
    route.hash = '';
    render(<SharedPageDocument pageId="page" content={content} />);
    fireEvent.contextMenu(screen.getByText('Details'));
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Copy link to block' })
    );
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        window.location.origin + '/workspace/page#block=summary'
      )
    );
  });

  it('keeps the nested block selected from its left handle and copies its link', async () => {
    render(<SharedPageDocument pageId="page" content={content} />);
    const nested = screen.getByText('Nested content');
    const toggle = nested.closest('details')!;
    vi.spyOn(nested, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(116, 100, 400, 28)
    );

    fireEvent.mouseMove(nested, { clientX: 145, clientY: 110 });
    const handle = screen.getByRole('button', { name: 'Block actions' });
    vi.spyOn(handle, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(92, 102, 24, 24)
    );
    fireEvent.mouseMove(toggle, { clientX: 110, clientY: 110 });
    fireEvent.pointerDown(handle, { button: 0, ctrlKey: false });

    expect(nested).toHaveAttribute('data-shared-block-selected');
    const menu = await screen.findByRole('menu');
    expect(menu).toHaveTextContent('Copy link to block');
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'Copy link to block' })
    );
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        window.location.origin + '/workspace/page#block=nested'
      )
    );
    expect(nested).not.toHaveAttribute('data-shared-block-selected');
  });
});
