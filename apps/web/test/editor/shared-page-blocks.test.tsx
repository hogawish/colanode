import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RichTextContent } from '@colanode/core';
import { SharedPageDocument } from '@colanode/ui/components/pages/shared-page-document';

const route = vi.hoisted(() => ({ hash: 'block=nested' }));
vi.mock(import('@tanstack/react-router'), async (original) => ({
  ...(await original()),
  useRouterState: () => route.hash,
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
  it('renders a divider and opens the toggle before scrolling to a linked child', async () => {
    render(<SharedPageDocument pageId="page" content={content} />);
    const nested = screen.getByText('Nested content');
    expect(screen.getByRole('separator')).toBeVisible();
    expect(nested.closest('details')).toHaveAttribute('open');
    await waitFor(() =>
      expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
        block: 'center',
        behavior: 'auto',
      })
    );
    expect(
      vi.mocked(HTMLElement.prototype.scrollIntoView).mock.contexts[0]
    ).toBe(nested);
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
});
