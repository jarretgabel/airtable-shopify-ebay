import DOMPurify from 'dompurify';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
