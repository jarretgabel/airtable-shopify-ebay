export interface ApiErrorBody {
  message: string;
  service: string;
  code: string;
  retryable: boolean;
}

export type JsonRecord = Record<string, unknown>;