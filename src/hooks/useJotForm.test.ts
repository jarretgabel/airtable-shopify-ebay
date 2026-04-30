import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useJotFormInquiries } from '@/hooks/useJotForm';
import type { JotFormSubmission } from '@/types/jotform';

const { getFormSubmissionsMock } = vi.hoisted(() => ({
  getFormSubmissionsMock: vi.fn(),
}));

vi.mock('@/services/app-api/jotform', () => ({
  getForms: vi.fn(),
  getFormSubmissions: getFormSubmissionsMock,
}));

function buildSubmission(id: string): JotFormSubmission {
  return {
    id,
    form_id: '213604252654047',
    ip: '127.0.0.1',
    created_at: '2026-04-29 12:00:00',
    status: 'ACTIVE',
    new: '0',
    flag: '0',
    notes: '',
    answers: {},
  };
}

describe('useJotFormInquiries', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getFormSubmissionsMock.mockReset();
    getFormSubmissionsMock.mockResolvedValue([buildSubmission('10')]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not fetch or poll when disabled', async () => {
    const { result } = renderHook(() => useJotFormInquiries('213604252654047', 1_000, false));

    expect(result.current.loading).toBe(false);
    expect(result.current.polling).toBe(false);
    expect(getFormSubmissionsMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });

    expect(getFormSubmissionsMock).not.toHaveBeenCalled();
  });

  it('fetches initially, polls while enabled, and stops polling after disable', async () => {
    const { rerender } = renderHook(
      ({ enabled }) => useJotFormInquiries('213604252654047', 1_000, enabled),
      { initialProps: { enabled: true } },
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(getFormSubmissionsMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await Promise.resolve();
    });

    expect(getFormSubmissionsMock).toHaveBeenCalledTimes(2);

    rerender({ enabled: false });

    await act(async () => {
      vi.advanceTimersByTime(5_000);
      await Promise.resolve();
    });

    expect(getFormSubmissionsMock).toHaveBeenCalledTimes(2);
  });
});