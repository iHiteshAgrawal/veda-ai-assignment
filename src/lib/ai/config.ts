/**
 * Pipeline tunables, kept in one place so the trade-offs are visible together
 * rather than scattered as magic numbers across the providers.
 */

/**
 * Questions per grading request. Small enough that the model gives each answer
 * real attention and the response can't truncate; large enough that a 30-question
 * paper doesn't become 30 round trips.
 */
export const GRADING_BATCH_SIZE = 6;

/**
 * Simultaneous in-flight requests during fan-out. Free tiers meter per minute,
 * so an unbounded fan-out would trip the limit and force retries that cost more
 * wall-clock time than the serialisation saved.
 */
export const GRADING_CONCURRENCY = 3;

/**
 * Ceiling for a single provider call. Below the 60s Vercel function limit so a
 * stalled request surfaces as a real error instead of the platform killing the
 * whole function with no explanation.
 */
export const PROVIDER_TIMEOUT_MS = 45_000;
