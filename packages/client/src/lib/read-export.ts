import { HTTPError } from 'ky';

// A hierarchy export makes one authorized GET per container. The normal device
// quota stays in place; only an explicit 429 is retried, never an ambiguous write.
export const readExportWithBackoff = async <T>(
  read: () => Promise<T>,
  sleep: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms))
): Promise<T> => {
  for (let attempt = 0; ; attempt++) {
    try {
      return await read();
    } catch (error) {
      if (
        !(error instanceof HTTPError) ||
        error.response.status !== 429 ||
        attempt >= 3
      )
        throw error;
      const retryAfter = error.response.headers.get('retry-after');
      const seconds = retryAfter === null ? NaN : Number(retryAfter);
      const date = retryAfter === null ? NaN : Date.parse(retryAfter);
      const wait = Number.isFinite(seconds)
        ? seconds * 1000
        : date - Date.now();
      if (Number.isFinite(wait) && wait > 120000) throw error;
      await sleep(
        Number.isFinite(wait) && wait >= 0 ? Math.max(1000, wait) : 60000
      );
    }
  }
};
