export interface ServiceError {
  service: string;
  code: string;
  userMessage: string;
  retryable: boolean;
  cause?: unknown;
}

export function createServiceError(input: {
  service: string;
  code: string;
  userMessage: string;
  retryable?: boolean;
  cause?: unknown;
}): ServiceError {
  return {
    service: input.service,
    code: input.code,
    userMessage: input.userMessage,
    retryable: input.retryable ?? false,
    cause: input.cause,
  };
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}
