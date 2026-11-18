import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { AppProvider } from '@colanode/ui/components/app/app-provider';

const state = vi.hoisted(() => ({ init: vi.fn(), preload: vi.fn() }));
vi.mock('@colanode/core', () => ({ build: { version: 'test', sha: 'test' } }));
vi.mock('@colanode/ui/collections', () => ({
  collections: { preload: state.preload },
}));
vi.mock('@colanode/ui/components/app/app-assets', () => ({
  AppAssets: () => null,
}));
vi.mock('@colanode/ui/components/app/app-layout', () => ({
  AppLayout: () => <p>Ready workspace</p>,
}));
vi.mock('@colanode/ui/components/app/app-loading', () => ({
  AppLoading: () => <p role="status">Opening workspace</p>,
}));
vi.mock('@colanode/ui/components/app/app-reset', () => ({
  AppReset: () => <p>Reset confirmation</p>,
}));
vi.mock('@colanode/ui/components/app/app-theme-provider', () => ({
  AppThemeProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@colanode/ui/components/app/radar-provider', () => ({
  RadarProvider: ({ children }: { children: ReactNode }) => children,
}));

beforeEach(() => {
  state.init.mockReset().mockResolvedValue('success');
  state.preload.mockReset().mockResolvedValue(undefined);
  Object.assign(window, { colanode: { init: state.init } });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.useRealTimers());

it('shows recovery when initialization returns an error instead of an empty page', async () => {
  state.init.mockResolvedValue('error');
  render(<AppProvider type="web" />);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not open Colanode'
  );
  expect(screen.getByRole('button', { name: 'Reload page' })).toBeVisible();
});

it('shows recovery when collection preload rejects', async () => {
  state.preload.mockRejectedValue(new Error('Collection unavailable'));
  render(<AppProvider type="web" />);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not open Colanode'
  );
});

it('handles a rejected worker initialization without clearing saved data', async () => {
  state.init.mockRejectedValue(new Error('Worker unavailable'));
  render(<AppProvider type="web" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('saved data');
  expect(state.preload).not.toHaveBeenCalled();
});

it('turns a stalled startup into a visible retry and can still finish later', async () => {
  vi.useFakeTimers();
  let complete!: (value: string) => void;
  state.init.mockReturnValue(
    new Promise((resolve) => {
      complete = resolve;
    })
  );
  render(<AppProvider type="web" />);
  expect(screen.getByRole('status')).toHaveTextContent('Opening workspace');
  await act(async () => {
    await vi.advanceTimersByTimeAsync(20_000);
  });
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Could not open Colanode'
  );
  await act(async () => {
    complete('success');
  });
  expect(screen.getByText('Ready workspace')).toBeVisible();
});
