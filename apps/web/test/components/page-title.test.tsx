import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LocalPageNode } from '@colanode/client/types';
import { PageContainer } from '@colanode/ui/components/pages/page-container';

const nodes = vi.hoisted(() => ({ has: vi.fn(() => true), update: vi.fn() }));
vi.mock('@colanode/ui/contexts/workspace', () => ({
  useWorkspace: () => ({ collections: { nodes } }),
}));
vi.mock('@colanode/ui/components/documents/document', () => ({
  Document: () => <p>Page body</p>,
}));

const page = {
  id: 'pagepg',
  type: 'page',
  name: 'Untitled',
} as LocalPageNode;

beforeEach(() => nodes.update.mockClear());

describe('page title', () => {
  it('updates the existing page on blur', () => {
    render(<PageContainer page={page} role="editor" />);
    const title = screen.getByRole('textbox', { name: 'Page title' });
    fireEvent.change(title, { target: { value: ' 資料 ' } });
    expect(nodes.update).not.toHaveBeenCalled();
    fireEvent.blur(title);
    const [id, update] = nodes.update.mock.calls[0]!;
    const draft = { ...page };
    update(draft);
    expect(id).toBe(page.id);
    expect(draft.name).toBe('資料');
  });

  it('shows a read-only title to viewers', () => {
    render(<PageContainer page={page} role="viewer" />);
    const title = screen.getByRole('textbox', { name: 'Page title' });
    expect(title).toHaveValue('Untitled');
    expect(title).toHaveAttribute('readonly');
  });

  it('keeps Enter for Japanese composition and discards the draft on Escape', () => {
    render(<PageContainer page={page} role="editor" />);
    const title = screen.getByRole('textbox', { name: 'Page title' });
    const blur = vi.spyOn(title, 'blur');
    fireEvent.change(title, { target: { value: '編集中' } });
    fireEvent.keyDown(title, { key: 'Enter', isComposing: true });
    expect(blur).not.toHaveBeenCalled();
    fireEvent.keyDown(title, { key: 'Escape' });
    fireEvent.blur(title);
    expect(title).toHaveValue('Untitled');
    expect(nodes.update).not.toHaveBeenCalled();
  });
});
