import { createServiceError, type ServiceError } from '@/services/serviceErrors';

interface AppApiHttpErrorOptions {
  statusCode: number;
  service?: string;
  code?: string;
  retryable?: boolean;
}

export class AppApiHttpError extends Error {
  readonly statusCode: number;
  readonly service?: string;
  readonly code?: string;
  readonly retryable?: boolean;

  constructor(message: string, options: AppApiHttpErrorOptions) {
    super(message);
    this.name = 'AppApiHttpError';
    this.statusCode = options.statusCode;
    this.service = options.service;
    this.code = options.code;
    this.retryable = options.retryable;
  }
}

export type ErrorWithServiceError = Error & { serviceError?: ServiceError };

export function isAppApiHttpError(error: unknown): error is AppApiHttpError {
  return error instanceof AppApiHttpError;
}

export function hasServiceError(error: unknown): error is ErrorWithServiceError {
  return error instanceof Error && 'serviceError' in error;
}

export function toServiceErrorMessage(
  service: string,
  code: string,
  userMessage: string,
  error: unknown,
  retryable = true,
): ErrorWithServiceError {
  if (hasServiceError(error) && error.serviceError) {
    return error;
  }

  const serviceError = createServiceError({
    service,
    code,
    userMessage,
    retryable: isAppApiHttpError(error) ? error.retryable ?? retryable : retryable,
    cause: error,
  });

  const typedError = new Error(serviceError.userMessage) as ErrorWithServiceError;
  typedError.serviceError = serviceError;
  return typedError;
}