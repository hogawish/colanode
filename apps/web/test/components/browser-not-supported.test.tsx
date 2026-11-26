import { describe, expect, it } from 'vitest';

import { BrowserNotSupported } from '@colanode/web/components/browser-not-supported';

import { customRender, screen } from '../test-utils';

describe('components/BrowserNotSupported', () => {
  it('renders the main heading', () => {
    customRender(<BrowserNotSupported />);

    const heading = screen.getByRole('heading', {
      name: /browser not supported/i,
    });
    expect(heading).toBeInTheDocument();
  });

  it('links to the source preview setup guide', () => {
    customRender(<BrowserNotSupported />);

    const setupLink = screen.getByRole('link', {
      name: /setup guide/i,
    });
    expect(setupLink).toBeInTheDocument();
    expect(setupLink).toHaveAttribute(
      'href',
      'https://github.com/hogawish/tsuzunowa#try-the-source-preview'
    );
    expect(setupLink).toHaveAttribute('target', '_blank');
    expect(setupLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('displays a link to GitHub', () => {
    customRender(<BrowserNotSupported />);

    const githubLink = screen.getByRole('link', {
      name: /github/i,
    });
    expect(githubLink).toBeInTheDocument();
    expect(githubLink).toHaveAttribute(
      'href',
      'https://github.com/hogawish/tsuzunowa/issues'
    );
    expect(githubLink).toHaveAttribute('target', '_blank');
    expect(githubLink).toHaveAttribute('rel', 'noopener noreferrer');
  });
  it('renders the MonitorOff icon', () => {
    const { container } = customRender(<BrowserNotSupported />);

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});
