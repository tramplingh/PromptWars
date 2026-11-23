/** An error that maps directly to an HTTP response; anything else becomes a 500. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, 'BAD_REQUEST', message, details);
export const unauthorized = (message = 'Choose a profile to continue') =>
  new HttpError(401, 'NO_SESSION', message);
export const forbidden = (message = 'You do not have permission to do that') =>
  new HttpError(403, 'FORBIDDEN', message);
export const notFound = (what: string) => new HttpError(404, 'NOT_FOUND', `${what} not found`);
export const conflict = (message: string, details?: unknown) =>
  new HttpError(409, 'CONFLICT', message, details);
