import { HTTPError } from 'ky';
import { expect, it, vi } from 'vitest';

import { readExportWithBackoff } from '@colanode/client/lib/read-export';

const httpError = (status: number, retryAfter?: string) =>
  new HTTPError(
    new Response('', {
      status,
      headers: retryAfter ? { 'retry-after': retryAfter } : {},
    }),
    new Request('https://example.invalid/export'),
    {} as never
  );
it('waits for the existing device quota before continuing an authorized export GET', async () => {
  const read = vi
    .fn()
    .mockRejectedValueOnce(httpError(429))
    .mockResolvedValue({ id: 'same-page' });
  const sleep = vi.fn(async () => {});
  expect(await readExportWithBackoff(read, sleep)).toEqual({ id: 'same-page' });
  expect(sleep).toHaveBeenCalledWith(60000);
  expect(read).toHaveBeenCalledTimes(2);
});
it('honors Retry-After and bounds repeated rate-limit retries', async () => {
  const read = vi.fn().mockRejectedValue(httpError(429, '2'));
  const sleep = vi.fn(async () => {});
  await expect(readExportWithBackoff(read, sleep)).rejects.toBeInstanceOf(
    HTTPError
  );
  expect(read).toHaveBeenCalledTimes(4);
  expect(sleep).toHaveBeenCalledTimes(3);
  expect(sleep).toHaveBeenCalledWith(2000);
});
it('honors an HTTP-date Retry-After value', async () => {
  const now = vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 10, 24));
  try {
    const read = vi
      .fn()
      .mockRejectedValueOnce(httpError(429, 'Tue, 24 Nov 2026 00:00:03 GMT'))
      .mockResolvedValue('page');
    const sleep = vi.fn(async () => {});
    expect(await readExportWithBackoff(read, sleep)).toBe('page');
    expect(sleep).toHaveBeenCalledWith(3000);
  } finally {
    now.mockRestore();
  }
});
it('does not wait indefinitely for an excessive Retry-After', async () => {
  const error = httpError(429, '3600');
  const read = vi.fn().mockRejectedValue(error);
  const sleep = vi.fn(async () => {});
  await expect(readExportWithBackoff(read, sleep)).rejects.toBe(error);
  expect(read).toHaveBeenCalledOnce();
  expect(sleep).not.toHaveBeenCalled();
});
it.each([httpError(403), httpError(500), new TypeError('Failed to fetch')])(
  'does not retry a non-quota failure',
  async (error) => {
    const read = vi.fn().mockRejectedValue(error),
      sleep = vi.fn(async () => {});
    await expect(readExportWithBackoff(read, sleep)).rejects.toBe(error);
    expect(read).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  }
);
