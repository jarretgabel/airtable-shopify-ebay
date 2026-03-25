import DOMPurify from 'dompurify';
import { useMemo } from 'react';

interface BodyHtmlPreviewProps {
  value: string;
  helperText?: string;
  emptyStateText?: string;
}

export function BodyHtmlPreview({
  value,
  helperText = 'Generated from the current Description and Key Features values. Saved body HTML is only reused when a dedicated template field exists.',
  emptyStateText = 'Add a description or feature/value pairs to generate the body HTML preview.',
}: BodyHtmlPreviewProps) {
  const sanitizedHtml = useMemo(() => DOMPurify.sanitize(value), [value]);
  const hasValue = value.trim().length > 0;

  return (
    <>
      <details className="col-span-1 rounded-lg border border-[var(--line)] bg-white/5 md:col-span-2 mb-4">
        <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]">
          Body HTML Code
        </summary>
        <div className="border-t border-[var(--line)] px-3 py-3">
          <p className="m-0 text-sm text-[var(--muted)]">{helperText}</p>
          <pre className="m-0 mt-3 overflow-x-auto rounded-md border border-[var(--line)] bg-black/30 p-3 text-xs text-[var(--ink)] whitespace-pre-wrap">{hasValue ? value : '<p></p>'}</pre>
        </div>
      </details>

      <details className="col-span-1 rounded-lg border border-[var(--line)] bg-white/5 md:col-span-2">
        <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]">
          Body Rendered Preview
        </summary>
        <div className="border-t border-[var(--line)] px-3 py-3">
          {hasValue ? (
            <div
              className="prose prose-invert max-w-none rounded-lg border border-[var(--line)] bg-[var(--bg)] p-4 text-sm text-[var(--ink)]"
              dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--bg)] p-4 text-sm text-[var(--muted)]">
              {emptyStateText}
            </div>
          )}
        </div>
      </details>
    </>
  );
}
