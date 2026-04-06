/**
 * Standardized error handling for Edge Functions.
 */

export class AppError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown>;

  constructor(code: string, message: string, status = 400, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return new Response(
      JSON.stringify({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      }),
      {
        status: error.status,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // AuthError from auth.ts
  if (error instanceof Error && 'status' in error) {
    const statusError = error as Error & { status: number };
    return new Response(
      JSON.stringify({
        error: {
          code: 'AUTH_ERROR',
          message: statusError.message,
        },
      }),
      {
        status: statusError.status,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Unknown error
  console.error('Unhandled error:', error);
  return new Response(
    JSON.stringify({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    }),
    {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

export function jsonResponse<T>(data: T, status = 200): Response {
  return new Response(
    JSON.stringify({ data }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
