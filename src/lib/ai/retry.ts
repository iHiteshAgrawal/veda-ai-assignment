/**
 * Shared retry policy for model providers.
 *
 * Both providers meter per minute on their free tiers, so a burst of concurrent
 * calls can hit a 429 that clears on its own within seconds. Those are worth
 * retrying; a bad request or a missing key is not, and retrying it just delays
 * the error the caller needs to see.
 */

const RATE_LIMIT_MARKERS = ['"code":429', '"code": 429', "RESOURCE_EXHAUSTED", "rate limit"];

export function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return RATE_LIMIT_MARKERS.some((marker) => message.includes(marker));
}

/** Retries only transient rate-limit errors, backing off 2s, 4s, 8s. */
export async function withRateLimitRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === attempts || !isRateLimitError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 1000));
    }
  }
  // Unreachable: the loop either returns or throws on its final attempt.
  throw new Error("withRateLimitRetry exhausted without a result");
}

/**
 * Translates a provider failure into something a teacher can act on, without
 * hiding genuine bugs — only rate limits get a rewritten message; everything
 * else keeps its original text.
 */
export function buildFriendlyError(rateLimitAdvice: string) {
  return (error: unknown, fallback: string): string => {
    if (isRateLimitError(error)) return rateLimitAdvice;
    return error instanceof Error ? error.message : fallback;
  };
}
