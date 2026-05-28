import { describe, expect, it } from 'vitest';
import { buildJotFormSubmissionUrl, formatAnswer } from '@/services/jotform';

describe('jotform service helpers', () => {
  it('formats answer values into readable text', () => {
    expect(formatAnswer('Seller Name')).toBe('Seller Name');
    expect(formatAnswer(['Amp', 'Preamp'])).toBe('Amp, Preamp');
    expect(formatAnswer({ first: 'John', last: 'Doe' })).toBe('John Doe');
  });

  it('builds a direct JotForm submission URL from a submission id', () => {
    expect(buildJotFormSubmissionUrl('235194815571509962')).toBe('https://www.jotform.com/submission/235194815571509962');
  });

  it('returns null when the submission id is blank', () => {
    expect(buildJotFormSubmissionUrl('   ')).toBeNull();
  });
});