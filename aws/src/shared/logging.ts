import type { JsonRecord } from './types.js';

function normalizeError(error: unknown): JsonRecord {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return { value: String(error) };
}

export function logInfo(message: string, context: JsonRecord = {}): void {
  console.info(JSON.stringify({ level: 'info', message, ...context }));
}

export function logError(message: string, error: unknown, context: JsonRecord = {}): void {
  console.error(JSON.stringify({ level: 'error', message, error: normalizeError(error), ...context }));
}