import DOMPurify from 'dompurify';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface BodyHtmlTemplateOption {
  id: string;
  label: string;
}

interface BodyHtmlPreviewProps {
  value: string;
  helperText?: string;
  emptyStateText?: string;
  showTemplateSelector?: boolean;
  templateOptions?: ReadonlyArray<BodyHtmlTemplateOption>;
  selectedTemplateId?: string;
  onTemplateChange?: (templateId: string) => void;
}

export function BodyHtmlPreview({
  value,
  helperText = 'Generated from the current Description and Key Features values. Saved body HTML is only reused when a dedicated template field exists.',
  emptyStateText = 'Add a description or feature/value pairs to generate the body HTML preview.',
  showTemplateSelector = false,
  templateOptions = [],
  selectedTemplateId,
  onTemplateChange,
}: BodyHtmlPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const resizeTimerRef = useRef<number | null>(null);
  const [iframeHeight, setIframeHeight] = useState<number>(900);
  const sanitizedHtml = useMemo(() => DOMPurify.sanitize(value), [value]);
  const sanitizedIframeDoc = useMemo(
    () => DOMPurify.sanitize(value, { WHOLE_DOCUMENT: true }),
    [value],
  );
  const hasValue = value.trim().length > 0;
  const isFullHtmlDocument = useMemo(() => /^\s*(<!doctype\s+html|<html\b)/i.test(value), [value]);

  const measureIframeHeight = useCallback((iframe: HTMLIFrameElement) => {
    const doc = iframe.contentDocument;
    if (!doc) return;

    const bodyHeight = doc.body?.scrollHeight ?? 0;
    const htmlHeight = doc.documentElement?.scrollHeight ?? 0;
    const nextHeight = Math.max(bodyHeight, htmlHeight, 320);
    if (Number.isFinite(nextHeight) && nextHeight > 0) {
      setIframeHeight(nextHeight);
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (iframeRef.current) {
        measureIframeHeight(iframeRef.current);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimerRef.current !== null) {
        window.clearInterval(resizeTimerRef.current);
        resizeTimerRef.current = null;
      }
    };
  }, [measureIframeHeight]);

  useEffect(() => {
    if (!isFullHtmlDocument || !hasValue || !iframeRef.current) return;

    const iframe = iframeRef.current;
    const measure = () => measureIframeHeight(iframe);

    const rafId = window.requestAnimationFrame(measure);
    const t1 = window.setTimeout(measure, 80);
    const t2 = window.setTimeout(measure, 220);
    const t3 = window.setTimeout(measure, 520);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [hasValue, isFullHtmlDocument, measureIframeHeight, sanitizedIframeDoc]);

  return (
    <>
      {showTemplateSelector && templateOptions.length > 0 && (
        <div className="col-span-1 flex flex-col gap-2 md:col-span-2">
          <span className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Listing Template</span>
          <div className="flex flex-wrap gap-2">
            {templateOptions.map((option) => {
              const isActive = (selectedTemplateId ?? templateOptions[0]?.id ?? '') === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold tracking-[0.04em] transition ${
                    isActive
                      ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--ink)]'
                      : 'border-[var(--line)] bg-[var(--panel)] text-[var(--muted)] hover:border-[var(--accent)]/60 hover:text-[var(--ink)]'
                  }`}
                  onClick={() => onTemplateChange?.(option.id)}
                  aria-pressed={isActive}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

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
            isFullHtmlDocument ? (
              <iframe
                ref={iframeRef}
                title="Body HTML Rendered Preview"
                className="w-full rounded-lg border border-[var(--line)] bg-white"
                style={{ height: `${iframeHeight}px`, overflow: 'hidden' }}
                srcDoc={sanitizedIframeDoc}
                sandbox="allow-same-origin"
                scrolling="no"
                onLoad={(event) => {
                  const iframe = event.currentTarget;
                  measureIframeHeight(iframe);

                  const win = iframe.contentWindow;
                  if (!win) return;

                  win.setTimeout(() => measureIframeHeight(iframe), 80);
                  win.setTimeout(() => measureIframeHeight(iframe), 250);
                  win.setTimeout(() => measureIframeHeight(iframe), 600);

                  if (resizeTimerRef.current !== null) {
                    window.clearInterval(resizeTimerRef.current);
                  }
                  resizeTimerRef.current = window.setInterval(() => {
                    measureIframeHeight(iframe);
                  }, 500);

                  win.setTimeout(() => {
                    if (resizeTimerRef.current !== null) {
                      window.clearInterval(resizeTimerRef.current);
                      resizeTimerRef.current = null;
                    }
                  }, 5000);
                }}
              />
            ) : (
              <div
                className="prose prose-invert max-w-none rounded-lg border border-[var(--line)] bg-[var(--bg)] p-4 text-sm text-[var(--ink)]"
                dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
              />
            )
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
