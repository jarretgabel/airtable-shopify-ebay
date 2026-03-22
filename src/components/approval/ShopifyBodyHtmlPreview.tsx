import DOMPurify from 'dompurify';
import { useMemo } from 'react';

interface ShopifyBodyHtmlPreviewProps {
  value: string;
}

const summaryClass = 'flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-[var(--ink)] [&::-webkit-details-marker]:hidden';

export function ShopifyBodyHtmlPreview({ value }: ShopifyBodyHtmlPreviewProps) {
  const sanitizedHtml = useMemo(() => DOMPurify.sanitize(value), [value]);
  const hasValue = value.trim().length > 0;

  return (
    <details className="group col-span-1 rounded-xl border border-[var(--line)] bg-[var(--panel)] md:col-span-2">
      <summary className={summaryClass}>
        <span>Body HTML Preview</span>
        <span
          aria-hidden="true"
          className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--bg)] text-[0.72rem] text-[var(--muted)] transition-transform duration-200 group-open:rotate-180"
        >
          v
        </span>
      </summary>
      <div className="border-t border-[var(--line)] px-3 py-3">
        <p className="m-0 text-sm text-[var(--muted)]">Generated from the current Description and Key Features values. Saved body HTML is only reused when a dedicated template field exists.</p>

        <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
          <section>
            <p className="m-0 mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">HTML Code</p>
            <pre className="m-0 overflow-x-auto rounded-lg border border-[var(--line)] bg-black/30 p-3 text-xs leading-6 text-[var(--ink)] whitespace-pre-wrap">{hasValue ? value : '<p></p>'}</pre>
          </section>

          <section>
            <p className="m-0 mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Rendered Preview</p>
            {hasValue ? (
              <div
                className="prose prose-invert max-w-none rounded-lg border border-[var(--line)] bg-[var(--bg)] p-4 text-sm text-[var(--ink)]"
                dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
              />
            ) : (
              <div className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--bg)] p-4 text-sm text-[var(--muted)]">
                Add a description or feature/value pairs to generate the Shopify body HTML preview.
              </div>
            )}
          </section>
        </div>
      </div>
    </details>
  );
}
