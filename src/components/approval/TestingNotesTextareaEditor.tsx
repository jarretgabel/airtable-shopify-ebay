import type { ReactNode } from 'react';
import {
  detailDisclosureBodyClass,
  detailDisclosureClass,
  detailDisclosureSummaryClass,
} from '@/components/tabs/uiClasses';

interface TestingNotesTextareaEditorProps {
  fieldName: string;
  value: string;
  setFormValue: (fieldName: string, value: string) => void;
  disabled?: boolean;
  label?: string;
  helperText?: string;
  placeholder?: string;
  headerAction?: ReactNode;
}

const textareaClass =
  'min-h-[140px] w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-400/30 disabled:cursor-not-allowed disabled:opacity-70';

export function TestingNotesTextareaEditor({
  fieldName,
  value,
  setFormValue,
  disabled = false,
  label = 'Testing Notes',
  helperText = 'Mirrors the plain Testing Notes field from the Testing form. Keep this as direct notes text instead of structured listing rows.',
  placeholder = 'Enter the testing notes exactly as they should appear from the Testing form.',
  headerAction,
}: TestingNotesTextareaEditorProps) {
  return (
    <details className={`${detailDisclosureClass} col-span-1 md:col-span-2`} open>
      <summary className={`${detailDisclosureSummaryClass} flex list-none items-center justify-between gap-3`}>
        <span>{label}</span>
        {headerAction ? <span onClick={(event) => event.stopPropagation()}>{headerAction}</span> : null}
      </summary>
      <div className={`${detailDisclosureBodyClass} flex flex-col gap-3`}>
        <p className="m-0 text-[0.74rem] leading-5 text-[var(--muted)]">
          {helperText}
        </p>
        <textarea
          className={`${textareaClass} resize-y leading-[1.5]`}
          value={value}
          onChange={(event) => setFormValue(fieldName, event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={label}
        />
      </div>
    </details>
  );
}