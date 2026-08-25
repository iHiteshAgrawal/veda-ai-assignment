/**
 * Concurrency primitives for fanning work out to a rate-limited API.
 *
 * An unbounded `Promise.all` over N questions would fire N simultaneous
 * requests and trip the provider's per-minute limit, which is the exact
 * failure the retry logic then has to dig us out of. Bounding the fan-out is
 * cheaper than retrying.
 */

/** Runs `worker` over every item, keeping at most `limit` in flight. Results keep input order. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (limit < 1) throw new Error(`Concurrency limit must be >= 1, got ${limit}`);
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function runner(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runner));
  return results;
}

/** Splits into fixed-size chunks. Used to batch questions per grading call. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size < 1) throw new Error(`Chunk size must be >= 1, got ${size}`);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export class TimeoutError extends Error {
  constructor(ms: number, label: string) {
    super(`${label} timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

/**
 * Fails a promise that outruns `ms`. Provider SDKs can hang on a stalled
 * connection, and a hung call burns the whole serverless function budget
 * without ever surfacing a reason.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(ms, label)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}
