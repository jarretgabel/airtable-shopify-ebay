import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  detailDisclosureBodyClass,
  detailDisclosureClass,
  detailDisclosureSummaryClass,
} from '@/components/tabs/uiClasses';

interface EbayBodyHtmlEditorProps {
  fieldName: string;
  value: string;
  setFormValue: (fieldName: string, value: string) => void;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  label?: string;
  helperText?: string;
  headerAction?: ReactNode;
}

const toolbarButtonClass = 'rounded-md border border-[var(--line)] px-2 py-1 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50';
const editorSurfaceClass = 'min-h-[200px] w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-400/30 disabled:cursor-not-allowed disabled:opacity-70';

function normalizeEditorHtml(rawHtml: string): string {
  const trimmed = rawHtml.trim();
  if (!trimmed || trimmed === '<br>' || trimmed === '<div><br></div>' || trimmed === '<p><br></p>') {
    return '';
  }

  return rawHtml;
}

function applyEditorCommand(command: string) {
  if (typeof document === 'undefined') return;
  document.execCommand(command, false);
}

function applyEditorCommandWithValue(command: string, value: string) {
  if (typeof document === 'undefined') return;
  document.execCommand(command, false, value);
}

export function EbayBodyHtmlEditor({
  fieldName,
  value,
  setFormValue,
  onValueChange,
  disabled = false,
  label = 'eBay Body HTML',
  helperText = 'Use formatting buttons for quick edits, then review the HTML source when needed.',
  headerAction,
}: EbayBodyHtmlEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const lastSyncedHtmlRef = useRef<string>(value);
  const [sourceMode, setSourceMode] = useState(false);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    if (document.activeElement === editor) return;
    if (value === lastSyncedHtmlRef.current) return;

    editor.innerHTML = value;
    lastSyncedHtmlRef.current = value;
  }, [value]);

  const commitHtml = (nextHtml: string) => {
    const normalized = normalizeEditorHtml(nextHtml);
    lastSyncedHtmlRef.current = normalized;
    setFormValue(fieldName, normalized);
    onValueChange?.(normalized);
  };

  return (
    <details className={`${detailDisclosureClass} col-span-1 md:col-span-2`} open>
      <summary className={`${detailDisclosureSummaryClass} flex list-none items-center justify-between gap-3`}>
        <span>{label}</span>
        {headerAction ? <span onClick={(event) => event.stopPropagation()}>{headerAction}</span> : null}
      </summary>
      <div className={`${detailDisclosureBodyClass} flex flex-col gap-3`}>
        <p className="m-0 text-[0.74rem] leading-5 text-[var(--muted)]">{helperText}</p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={toolbarButtonClass}
            onClick={() => {
              editorRef.current?.focus();
              applyEditorCommand('bold');
              commitHtml(editorRef.current?.innerHTML ?? '');
            }}
            disabled={disabled || sourceMode}
            aria-label="Bold"
            title="Bold"
          >
            Bold
          </button>
          <button
            type="button"
            className={toolbarButtonClass}
            onClick={() => {
              editorRef.current?.focus();
              applyEditorCommand('italic');
              commitHtml(editorRef.current?.innerHTML ?? '');
            }}
            disabled={disabled || sourceMode}
            aria-label="Italic"
            title="Italic"
          >
            Italic
          </button>
          <button
            type="button"
            className={toolbarButtonClass}
            onClick={() => {
              editorRef.current?.focus();
              applyEditorCommand('underline');
              commitHtml(editorRef.current?.innerHTML ?? '');
            }}
            disabled={disabled || sourceMode}
            aria-label="Underline"
            title="Underline"
          >
            Underline
          </button>
          <button
            type="button"
            className={toolbarButtonClass}
            onClick={() => {
              editorRef.current?.focus();
              applyEditorCommand('insertUnorderedList');
              commitHtml(editorRef.current?.innerHTML ?? '');
            }}
            disabled={disabled || sourceMode}
            aria-label="Bulleted list"
            title="Bulleted list"
          >
            Bullets
          </button>
          <button
            type="button"
            className={toolbarButtonClass}
            onClick={() => {
              editorRef.current?.focus();
              applyEditorCommand('insertOrderedList');
              commitHtml(editorRef.current?.innerHTML ?? '');
            }}
            disabled={disabled || sourceMode}
            aria-label="Numbered list"
            title="Numbered list"
          >
            Numbered
          </button>

          <button
            type="button"
            className={toolbarButtonClass}
            onClick={() => {
              if (disabled || sourceMode) return;
              const nextUrl = typeof window !== 'undefined'
                ? window.prompt('Enter URL', 'https://')?.trim() ?? ''
                : '';
              if (!nextUrl) return;
              editorRef.current?.focus();
              applyEditorCommandWithValue('createLink', nextUrl);
              commitHtml(editorRef.current?.innerHTML ?? '');
            }}
            disabled={disabled || sourceMode}
            aria-label="Insert link"
            title="Insert link"
          >
            Link
          </button>

          <button
            type="button"
            className={toolbarButtonClass}
            onClick={() => {
              editorRef.current?.focus();
              applyEditorCommand('unlink');
              commitHtml(editorRef.current?.innerHTML ?? '');
            }}
            disabled={disabled || sourceMode}
            aria-label="Remove link"
            title="Remove link"
          >
            Unlink
          </button>

          <button
            type="button"
            className={toolbarButtonClass}
            onClick={() => {
              editorRef.current?.focus();
              applyEditorCommand('justifyLeft');
              commitHtml(editorRef.current?.innerHTML ?? '');
            }}
            disabled={disabled || sourceMode}
            aria-label="Align left"
            title="Align left"
          >
            Left
          </button>

          <button
            type="button"
            className={toolbarButtonClass}
            onClick={() => {
              editorRef.current?.focus();
              applyEditorCommand('justifyCenter');
              commitHtml(editorRef.current?.innerHTML ?? '');
            }}
            disabled={disabled || sourceMode}
            aria-label="Align center"
            title="Align center"
          >
            Center
          </button>

          <button
            type="button"
            className={toolbarButtonClass}
            onClick={() => {
              editorRef.current?.focus();
              applyEditorCommand('justifyRight');
              commitHtml(editorRef.current?.innerHTML ?? '');
            }}
            disabled={disabled || sourceMode}
            aria-label="Align right"
            title="Align right"
          >
            Right
          </button>

          <button
            type="button"
            className={toolbarButtonClass}
            onClick={() => setSourceMode((current) => !current)}
            disabled={disabled}
            aria-label={sourceMode ? 'Switch to visual mode' : 'Switch to HTML source mode'}
            title={sourceMode ? 'Switch to visual mode' : 'Switch to HTML source mode'}
          >
            {sourceMode ? 'Visual' : 'HTML Source'}
          </button>
        </div>

        {sourceMode ? (
          <textarea
            className={`${editorSurfaceClass} resize-y font-mono leading-[1.4]`}
            value={value}
            onChange={(event) => commitHtml(event.target.value)}
            disabled={disabled}
            aria-label="eBay body HTML source"
          />
        ) : (
          <div
            ref={editorRef}
            className={`${editorSurfaceClass} leading-[1.5]`}
            contentEditable={!disabled}
            suppressContentEditableWarning
            onInput={(event) => commitHtml((event.currentTarget as HTMLDivElement).innerHTML)}
            onBlur={(event) => commitHtml((event.currentTarget as HTMLDivElement).innerHTML)}
            dangerouslySetInnerHTML={{ __html: value }}
            aria-label="eBay body HTML visual editor"
            role="textbox"
          />
        )}
      </div>
    </details>
  );
}