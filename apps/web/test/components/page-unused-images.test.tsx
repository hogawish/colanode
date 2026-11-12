import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FileStatus } from '@colanode/core';
import { PageUnusedImagesDialog } from '@colanode/ui/components/pages/page-unused-images-dialog';

const fixture = vi.hoisted(() => ({
  content: {
    type: 'rich_text',
    blocks: {} as Record<string, { id: string; type: string }>,
  },
  nodes: [
    {
      id: 'undone',
      name: 'Undone.png',
      type: 'file',
      subtype: 'image',
      status: 1,
    },
    { id: 'used', name: 'Used.png', type: 'file', subtype: 'image', status: 1 },
    {
      id: 'pending',
      name: 'Pending.png',
      type: 'file',
      subtype: 'image',
      status: 0,
    },
    {
      id: 'pdf',
      name: 'Document.pdf',
      type: 'file',
      subtype: 'pdf',
      status: 1,
    },
  ],
}));
vi.mock('@tanstack/react-db', () => ({
  useLiveQuery: () => ({
    data: fixture.nodes.map((node) => ({
      ...node,
      size: 1024,
      createdAt: '2026-11-13T00:00:00Z',
    })),
  }),
}));
vi.mock('@colanode/ui/hooks/use-live-query', () => ({
  useLiveQuery: () => ({ data: { content: fixture.content } }),
}));
vi.mock('@colanode/ui/contexts/workspace', () => ({
  useWorkspace: () => ({ userId: 'viewerus', collections: { nodes: {} } }),
}));
vi.mock('@colanode/ui/components/ui/link', () => ({
  Link: ({
    children,
    params,
    'aria-label': label,
  }: {
    children: React.ReactNode;
    params: { modalNodeId: string };
    'aria-label': string;
  }) => (
    <a href={`/modal/${params.modalNodeId}`} aria-label={label}>
      {children}
    </a>
  ),
}));

describe('unused images', () => {
  it('lists only uploaded images absent from the body and removes restored images', () => {
    expect(fixture.nodes[0]?.status).toBe(FileStatus.Ready);
    fixture.content.blocks = { used: { id: 'used', type: 'file' } };
    const view = (
      <PageUnusedImagesDialog pageId="examplepg" onClose={vi.fn()} />
    );
    const { rerender } = render(view);

    expect(
      screen.getByRole('link', { name: 'Open Undone.png' })
    ).toHaveAttribute('href', '/modal/undone');
    expect(screen.queryByText('Used.png')).toBeNull();
    expect(screen.queryByText('Pending.png')).toBeNull();
    expect(screen.queryByText('Document.pdf')).toBeNull();

    fixture.content.blocks.undone = { id: 'undone', type: 'file' };
    rerender(<PageUnusedImagesDialog pageId="examplepg" onClose={vi.fn()} />);
    expect(screen.queryByText('Undone.png')).toBeNull();
    expect(screen.getByText('No unused images on this page.')).toBeVisible();
  });
});
