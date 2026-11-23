import type { ApiError } from '@lablink/shared';

/** Error thrown for non-2xx API responses, carrying the server's error envelope. */
export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers:
      body === undefined
        ? { Accept: 'application/json' }
        : { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const payload: unknown =
    response.status === 204 ? undefined : await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = (payload as ApiError | undefined)?.error;
    throw new ApiClientError(
      response.status,
      error?.code ?? 'NETWORK',
      error?.message ?? 'Unable to reach LabLink. Check your connection and try again.',
      error?.details,
    );
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown = {}) => request<T>('POST', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path, {}),
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  return 'Something went wrong. Please try again.';
}
