import type { JotFormForm, JotFormSubmission, JotFormApiResponse } from '@/types/jotform';

const API_KEY = import.meta.env.VITE_JOTFORM_API_KEY as string;
const BASE = '/jotform-proxy';

function buildUrl(path: string, params: Record<string, string | number> = {}): string {
  const qs = new URLSearchParams({
    apiKey: API_KEY,
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  });
  return `${BASE}${path}?${qs}`;
}

async function apiFetch<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const res = await fetch(buildUrl(path, params));
  if (!res.ok) {
    throw new Error(`JotForm API error: HTTP ${res.status} on ${path}`);
  }
  const json: JotFormApiResponse<T> = await res.json();
  if (json.responseCode !== 200) {
    throw new Error(`JotForm API error ${json.responseCode}: ${json.message}`);
  }
  return json.content;
}

export async function getForms(): Promise<JotFormForm[]> {
  return apiFetch<JotFormForm[]>('/user/forms', { limit: 100, orderby: 'created_at', direction: 'DESC' });
}

export async function getFormSubmissions(
  formId: string,
  limit = 100,
  offset = 0
): Promise<JotFormSubmission[]> {
  return apiFetch<JotFormSubmission[]>(`/form/${formId}/submissions`, {
    limit,
    offset,
    orderby: 'created_at',
    direction: 'DESC',
  });
}

/** Format a JotForm answer value to a readable string */
export function formatAnswer(answer: JotFormAnswer['answer']): string {
  if (answer === null || answer === undefined) return '';
  if (typeof answer === 'string') return answer;
  if (Array.isArray(answer)) return answer.filter(Boolean).join(', ');
  if (typeof answer === 'object') {
    // Handle name/address sub-fields
    return Object.values(answer).filter(Boolean).join(' ');
  }
  return String(answer);
}
