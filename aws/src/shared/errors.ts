import type { ApiErrorBody } from './types.js';

interface HttpErrorOptions {
  service: string;
  code: string;
  retryable?: boolean;
}

export class HttpError extends Error {
  readonly statusCode: number;
  readonly service: string;
  readonly code: string;
  readonly retryable: boolean;

  constructor(statusCode: number, message: string, options: HttpErrorOptions) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.service = options.service;
    this.code = options.code;
    this.retryable = options.retryable ?? false;
  }
}

export function toApiErrorBody(service: string, error: unknown, fallbackCode: string): ApiErrorBody {
  if (error instanceof HttpError) {
    return {
      message: error.message,
      service: error.service || service,
      code: error.code || fallbackCode,
      retryable: error.retryable,
    };
  }

  return {
    message: error instanceof Error ? error.message : 'Unexpected error',
    service,
    code: fallbackCode,
    retryable: true,
  };
}

export function getStatusCode(error: unknown, fallbackStatusCode = 500): number {
  return error instanceof HttpError ? error.statusCode : fallbackStatusCode;
}