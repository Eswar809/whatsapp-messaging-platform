// Generic retry-with-exponential-backoff helper. No external deps.

export interface RetryOptions {
  /** Max number of attempts (including the first). Default: 3. */
  attempts?: number;
  /** Base delay in ms for the first backoff. Default: 500. */
  baseMs?: number;
  /** Cap on the computed delay before jitter. Default: 8000. */
  maxMs?: number;
  /** Called before each retry sleep. */
  onRetry?: (info: { attempt: number; attempts: number; delayMs: number; error: unknown }) => void;
}

export type RetryOutcome<T> =
  | { kind: "ok"; value: T }
  | { kind: "stop"; value: T }
  | { kind: "retry"; error: unknown };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Backoff with full jitter: random in [0, min(maxMs, base * 2^attempt)]. */
function backoffDelay(attempt: number, baseMs: number, maxMs: number): number {
  const exp = Math.min(maxMs, baseMs * 2 ** attempt);
  return Math.floor(Math.random() * exp);
}

/**
 * Run `fn` up to `attempts` times. The function returns a `RetryOutcome`:
 * - `ok`   -> success, return value immediately.
 * - `stop` -> permanent/terminal result, return value immediately (no retry).
 * - `retry`-> transient failure; retry with backoff until attempts exhausted.
 *
 * If the final attempt yields `retry`, the last value is produced via `onExhausted`.
 */
export async function retry<T>(
  fn: (attempt: number) => Promise<RetryOutcome<T>>,
  onExhausted: (error: unknown) => T,
  opts: RetryOptions = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const baseMs = opts.baseMs ?? 500;
  const maxMs = opts.maxMs ?? 8000;

  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const outcome = await fn(attempt);
    if (outcome.kind === "ok" || outcome.kind === "stop") return outcome.value;

    lastError = outcome.error;
    const isLast = attempt === attempts - 1;
    if (isLast) break;

    const delayMs = backoffDelay(attempt, baseMs, maxMs);
    opts.onRetry?.({ attempt: attempt + 1, attempts, delayMs, error: outcome.error });
    await sleep(delayMs);
  }
  return onExhausted(lastError);
}
