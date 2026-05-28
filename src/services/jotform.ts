import type { JotFormAnswer } from '@/types/jotform';

const DEFAULT_JOTFORM_BASE_URL = 'https://www.jotform.com';

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

export function buildJotFormSubmissionUrl(submissionId: string, baseUrl = DEFAULT_JOTFORM_BASE_URL): string | null {
  const normalizedSubmissionId = submissionId.trim();
  if (!normalizedSubmissionId) {
    return null;
  }

  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return new URL(`submission/${encodeURIComponent(normalizedSubmissionId)}`, normalizedBaseUrl).toString();
}
