/** Below this much remaining budget, another model attempt cannot realistically finish. */
export const MIN_ATTEMPT_MS = 1000;

/**
 * Errors worth retrying on a different model: overload, quota, server errors,
 * timeouts and unknown/retired model names. Invalid output (bad JSON or a
 * schema mismatch) is not retried; the caller's rule-based fallback handles it.
 */
export function isRetryable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === 'AbortError') return true;
  const status = (error as { status?: unknown }).status;
  if (typeof status === 'number')
    return status === 404 || status === 408 || status === 429 || status >= 500;
  return /\b(429|500|502|503|504|overloaded|unavailable|quota|resource_exhausted|deadline|timeout|not found)\b/i.test(
    error.message,
  );
}

/**
 * Tries each model in order within one shared time budget, moving on only for
 * retryable failures. Resolves with the first success and the model that served it.
 */
export async function withFailover<T>(
  models: readonly string[],
  budgetMs: number,
  attempt: (model: string, timeoutMs: number) => Promise<T>,
  now: () => number = Date.now,
): Promise<{ value: T; model: string }> {
  const deadline = now() + budgetMs;
  let lastError: unknown = new Error('No Gemini model configured');
  for (const model of models) {
    const remaining = deadline - now();
    if (remaining < MIN_ATTEMPT_MS) break;
    try {
      return { value: await attempt(model, remaining), model };
    } catch (error) {
      lastError = error;
      if (!isRetryable(error)) break;
    }
  }
  throw lastError;
}
