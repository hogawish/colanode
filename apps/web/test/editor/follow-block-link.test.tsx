import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useFollowBlockLink } from '@colanode/ui/hooks/use-follow-block-link';

const state = vi.hoisted(() => ({
  location: { pathname: '/workspace/viewerus/shared/pagepg', hash: '' },
  navigate: vi.fn(),
}));
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({
    state: { location: state.location },
    navigate: state.navigate,
  }),
}));
vi.mock('@colanode/ui/contexts/workspace', () => ({
  useWorkspace: () => ({ workspaceId: 'testwc', userId: 'viewerus' }),
}));

const Document = ({ href }: { href: string }) => {
  const follow = useFollowBlockLink();
  return (
    <div onClickCapture={follow}>
      <a href={href} target="_blank">
        <span>Jump</span>
      </a>
      <details>
        <summary>Toggle</summary>
        <p data-document-block="targetbl">Target</p>
      </details>
    </div>
  );
};

beforeEach(() => {
  state.navigate.mockClear();
  state.location = { pathname: '/workspace/viewerus/shared/pagepg', hash: '' };
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe('in-tab block navigation', () => {
  it('follows a canonical same-page link without leaving the shared view', () => {
    render(<Document href="/testwc/pagepg#block=targetbl" />);
    expect(fireEvent.click(screen.getByText('Jump'))).toBe(false);
    expect(state.navigate).toHaveBeenCalledWith({
      to: '/workspace/$userId/shared/$pageId',
      params: { userId: 'viewerus', pageId: 'pagepg' },
      hash: 'block=targetbl',
      hashScrollIntoView: false,
      resetScroll: false,
      mask: {
        to: '/$workspaceId/shared/$pageId',
        params: { workspaceId: 'testwc', pageId: 'pagepg' },
        hash: 'block=targetbl',
      },
    });
  });

  it('reveals the same target again after scrolling away', () => {
    state.location.hash = 'block=targetbl';
    render(<Document href="/testwc/pagepg#block=targetbl" />);
    fireEvent.click(screen.getByText('Jump'));
    expect(state.navigate).not.toHaveBeenCalled();
    expect(screen.getByText('Target').closest('details')).toHaveAttribute(
      'open'
    );
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledOnce();
  });

  it('lets the browser handle modifier-clicks and external links', () => {
    const { rerender } = render(
      <Document href="/testwc/pagepg#block=targetbl" />
    );
    expect(fireEvent.click(screen.getByText('Jump'), { ctrlKey: true })).toBe(
      true
    );
    rerender(
      <Document href="https://example.com/testwc/pagepg#block=targetbl" />
    );
    expect(fireEvent.click(screen.getByText('Jump'))).toBe(true);
    expect(state.navigate).not.toHaveBeenCalled();
  });
});
