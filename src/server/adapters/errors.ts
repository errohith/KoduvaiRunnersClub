/** Normalised provider failure. `retryable` drives the notification/payment retry policy. */
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    const err = e as Error;
    const timedOut = err.name === "TimeoutError" || err.name === "AbortError";
    // Network errors and timeouts are retryable; the provider may or may not have accepted the
    // request, so callers MUST pass an idempotency key where the provider supports one.
    throw new ProviderError(timedOut ? `Request timed out after ${timeoutMs}ms` : `Network error: ${err.message}`, true);
  }
}

export function classifyHttpFailure(status: number, body: string): ProviderError {
  const retryable = status === 408 || status === 429 || status >= 500;
  return new ProviderError(`HTTP ${status}: ${body.slice(0, 300)}`, retryable, status);
}

export const joinUrl = (base: string, ...parts: string[]) =>
  [base.replace(/\/+$/, ""), ...parts.map((p) => p.replace(/^\/+|\/+$/g, ""))].join("/");
