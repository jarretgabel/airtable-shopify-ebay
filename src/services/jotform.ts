import type { JotFormAnswer } from '@/types/jotform';

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
