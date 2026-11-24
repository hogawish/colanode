import { expect, it } from 'vitest';

import { parseApiError } from '@colanode/client/lib/ky';

it.each([
  new TypeError('Failed to fetch'),
  new TypeError('NetworkError when attempting to fetch resource.'),
  new DOMException('private endpoint detail', 'TimeoutError'),
  new DOMException('private endpoint detail', 'AbortError'),
])(
  'explains network interruption without exposing raw transport details or blindly advising a retry: %s',
  async (error) => {
    const result = await parseApiError(error);
    expect(result.message).toContain('before retrying');
    expect(result.message).not.toContain('private endpoint detail');
    expect(result.message).not.toContain('unknown error');
  }
);

it('does not misclassify unrelated programming errors as connection failures', async () => {
  expect(
    (await parseApiError(new TypeError('Undefined application field'))).message
  ).toBe('An unknown error occurred');
});
