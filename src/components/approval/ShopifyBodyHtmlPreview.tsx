import DOMPurify from 'dompurify';
import { useMemo } from 'react';

interface ShopifyBodyHtmlPreviewProps {
  value: string;
}

export function ShopifyBodyHtmlPreview({ value }: ShopifyBodyHtmlPreviewProps) {
  const sanitizedHtml = useMemo(() => DOMPurify.sanitize(value), [value]);
  const hasValue = value.trim().length > 0;

  return (
    <details className="col-span-1 rounded-lg border border-[var(--line)] bg-white/5 md:col-span-2">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]">
        Body HTML Preview
      </summary>
      <div className="border-t border-[var(--line)] px-3 py-3">
        <p className="m-0 text-sm text-[var(--muted)]">Generated from the current Description and Key Features values. Saved body HTML is only reused when a dedicated template field exists.</p>

        <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
          <section>
            <p className="m-0 mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">HTML Code</p>
            <pre className="m-0 overflow-x-auto rounded-md border border-[var(--line)] bg-black/30 p-3 text-xs text-[var(--ink)] whitespace-pre-wrap">{hasValue ? value : '<p></p>'}</pre>
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
