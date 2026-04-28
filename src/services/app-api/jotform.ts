import type { JotFormForm, JotFormSubmission } from '@/types/jotform';
import { isAppApiHttpError } from './errors';
import { getJson } from './http';

function toJotFormError(error: unknown): Error {
  if (isAppApiHttpError(error)) {
    return new Error(error.message);
  }

  return error instanceof Error ? error : new Error(String(error));
}

export async function getForms(): Promise<JotFormForm[]> {
  try {
    return await getJson<JotFormForm[]>('/api/jotform/forms');
  } catch (error) {
    throw toJotFormError(error);
  }
}

export async function getFormSubmissions(
  formId: string,
  limit = 100,
  offset = 0,
): Promise<JotFormSubmission[]> {
  try {
    return await getJson<JotFormSubmission[]>(`/api/jotform/forms/${encodeURIComponent(formId)}/submissions`, {
      limit,
      offset,
      orderby: 'created_at',
      direction: 'DESC',
    });
  } catch (error) {
    throw toJotFormError(error);
  }
}