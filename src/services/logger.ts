import { getErrorMessage } from '@/services/serviceErrors';

export function logServiceInfo(service: string, message: string, details?: unknown): void {
  if (details !== undefined) {
    console.info(`[${service}] ${message}`, details);
    return;
  }
  console.info(`[${service}] ${message}`);
}

export function logServiceError(service: string, context: string, error: unknown): void {
  console.error(`[${service}] ${context}: ${getErrorMessage(error)}`, error);
}
