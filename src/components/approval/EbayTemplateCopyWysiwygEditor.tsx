import { useEffect, useRef, useState } from 'react';
import {
  detailDisclosureBodyClass,
  detailDisclosureClass,
  detailDisclosureSummaryClass,
} from '@/components/tabs/uiClasses';

interface EbayTemplateCopyWysiwygEditorProps {
  fieldName: string;
  value: string;
  setFormValue: (fieldName: string, value: string) => void;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  label?: string;
  helperText?: string;
}

const toolbarButtonClass = 'inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--line)] text-[var(--ink)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50';
const editorSurfaceClass = 'min-h-[180px] w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-400/30 disabled:cursor-not-allowed disabled:opacity-70 [&_a]:text-blue-700 [&_a]:underline [&_a]:decoration-blue-600 [&_a]:underline-offset-2 [&_a]:decoration-2 [&_a:hover]:text-blue-800 [&_a:focus-visible]:outline-none [&_a:focus-visible]:ring-2 [&_a:focus-visible]:ring-blue-400/50 [&_a:focus-visible]:rounded-sm';

function IconBold() {
  return <span aria-hidden="true" className="text-sm font-black">B</span>;
}

function IconItalic() {
  return <span aria-hidden="true" className="text-sm italic font-semibold">I</span>;
}

function IconUnderline() {
  return <span aria-hidden="true" className="text-sm underline font-semibold">U</span>;
}

function IconBulletedList() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.5">
      <circle cx="3" cy="4" r="1" fill="currentColor" />
      <circle cx="3" cy="8" r="1" fill="currentColor" />
      <circle cx="3" cy="12" r="1" fill="currentColor" />
      <path d="M6 4h7M6 8h7M6 12h7" />
    </svg>
  );
}

function IconNumberedList() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.5">
      <path d="M2.5 4h1.5v2M2.5 6h2" />
      <path d="M2.3 10.2c0-.8.7-1.2 1.4-1.2.8 0 1.3.4 1.3 1 0 .6-.3.9-1.1 1.5l-1 .7h2.2" />
      <path d="M6 4h7M6 8h7M6 12h7" />
    </svg>
  );
}

function IconLink() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.5">
      <path d="M6.2 9.8 4.6 11.4a2 2 0 1 1-2.8-2.8l1.6-1.6" />
      <path d="M9.8 6.2 11.4 4.6a2 2 0 1 1 2.8 2.8l-1.6 1.6" />
      <path d="m6 10 4-4" />
      <path d="M12.5 1.5v3M11 3h3" strokeLinecap="round" />
    </svg>
  );
}

function IconUnlink() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.5">
      <path d="M3.4 10.8 2 12.2a2 2 0 1 1-2.8-2.8L.6 8" />
      <path d="M12.6 5.2 14 3.8a2 2 0 1 0-2.8-2.8L9.8 2.4" />
      <path d="M5.6 10.4 10.4 5.6" strokeDasharray="2 2" />
      <path d="M11.2 10.8 14.8 14.4M14.8 10.8 11.2 14.4" strokeLinecap="round" />
    </svg>
  );
}

function IconAlignLeft() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.5">
      <path d="M2 3h11M2 6h7M2 9h11M2 12h7" />
    </svg>
  );
}

function IconAlignCenter() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.5">
      <path d="M2 3h12M4 6h8M2 9h12M4 12h8" />
    </svg>
  );
}

function IconAlignRight() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.5">
      <path d="M3 3h11M7 6h7M3 9h11M7 12h7" />
    </svg>
  );
}

function IconSourceMode() {
  return <span aria-hidden="true" className="text-[10px] font-semibold">&lt;/&gt;</span>;
}

function IconVisualMode() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.5">
      <path d="M1.5 8s2.2-4 6.5-4 6.5 4 6.5 4-2.2 4-6.5 4-6.5-4-6.5-4Z" />
      <circle cx="8" cy="8" r="1.8" />
    </svg>
  );
}

function normalizeEditorHtml(rawHtml: string): string {
  const trimmed = rawHtml.trim();
  if (!trimmed || trimmed === '<br>' || trimmed === '<div><br></div>' || trimmed === '<p><br></p>') {
    return '<p><br></p>';
  }

  return normalizeInlineFormattingTags(rawHtml);
}

function normalizeInlineFormattingTags(rawHtml: string): string {
  if (typeof document === 'undefined') return rawHtml;

  const container = document.createElement('div');
  container.innerHTML = rawHtml;

  // The template's `w` class forces italic+bold. Remove it so toolbar styles are authoritative.
  const forcedEmphasisNodes = Array.from(container.querySelectorAll('.w'));
  for (const node of forcedEmphasisNodes) {
    node.classList.remove('w');
    if (!node.className.trim()) {
      node.removeAttribute('class');
    }
  }

  const replaceElementWithChildren = (element: Element) => {
    const fragment = document.createDocumentFragment();
    while (element.firstChild) {
      fragment.appendChild(element.firstChild);
    }
    element.replaceWith(fragment);
  };

  // Some browsers emit <strong><span style="font-weight: normal">...</span></strong>
  // when un-bold is applied. Collapse this to plain content so un-bold persists.
  const strongNodes = Array.from(container.querySelectorAll('strong, b'));
  for (const strongNode of strongNodes) {
    if (strongNode.childNodes.length !== 1) continue;
    const onlyChild = strongNode.firstChild;
    if (!(onlyChild instanceof HTMLSpanElement)) continue;

    const styleText = (onlyChild.getAttribute('style') ?? '').toLowerCase();
    const hasNormalWeight = /font-weight\s*:\s*(normal|[1-5]00)/.test(styleText);
    if (!hasNormalWeight) continue;

    replaceElementWithChildren(onlyChild);
    replaceElementWithChildren(strongNode);
  }

  const spanNodes = Array.from(container.querySelectorAll('span[style]'));
  for (const node of spanNodes) {
    const styleText = (node.getAttribute('style') ?? '').toLowerCase();
    const hasBold = /font-weight\s*:\s*(bold|[6-9]00)/.test(styleText);
    const hasNormalWeight = /font-weight\s*:\s*(normal|[1-5]00)/.test(styleText);
    const hasItalic = /font-style\s*:\s*italic/.test(styleText);
    const hasUnderline = /text-decoration\s*:\s*underline/.test(styleText);

    if (!hasBold && !hasItalic && !hasUnderline) {
      if (hasNormalWeight) {
        replaceElementWithChildren(node);
      }
      continue;
    }

    let replacement: Element = node;

    if (hasBold) {
      const strong = document.createElement('strong');
      strong.innerHTML = replacement.innerHTML;
      replacement = strong;
    }

    if (hasItalic) {
      const em = document.createElement('em');
      em.innerHTML = replacement.innerHTML;
      replacement = em;
    }

    if (hasUnderline) {
      const u = document.createElement('u');
      u.innerHTML = replacement.innerHTML;
      replacement = u;
    }

    node.replaceWith(replacement);
  }

  return container.innerHTML;
}

function applyEditorCommand(command: string) {
  if (typeof document === 'undefined') return;
  document.execCommand(command, false);
}

function applyEditorCommandWithValue(command: string, value: string) {
  if (typeof document === 'undefined') return;
  document.execCommand(command, false, value);
}

function preventToolbarMouseDown(event: React.MouseEvent<HTMLButtonElement>) {
  // Keep the current contentEditable selection so formatting applies to the selected text.
  event.preventDefault();
}

function getTemplateCopySegmentBounds(html: string): { start: number; openEnd: number; closeStart: number; closeEnd: number } | null {
  const openMatch = /<div\b[^>]*\bclass\s*=\s*(?:"[^"]*\bh\b[^"]*"|'[^']*\bh\b[^']*'|h)\b[^>]*>/i.exec(html);
  if (!openMatch || typeof openMatch.index !== 'number') return null;

  const start = openMatch.index;
  const openEnd = start + openMatch[0].length;
  const divTagPattern = /<\/?div\b[^>]*>/gi;
  divTagPattern.lastIndex = openEnd;

  let depth = 1;
  let closeStart = -1;
  let closeEnd = -1;

  for (let tagMatch = divTagPattern.exec(html); tagMatch; tagMatch = divTagPattern.exec(html)) {
    const tag = tagMatch[0].toLowerCase();
    const isClosing = tag.startsWith('</div');
    const isSelfClosing = !isClosing && /\/\s*>$/.test(tag);

    if (isSelfClosing) {
      continue;
    }

    if (isClosing) {
      depth -= 1;
      if (depth === 0) {
        closeStart = tagMatch.index;
        closeEnd = closeStart + tagMatch[0].length;
        break;
      }
    } else {
      depth += 1;
    }
  }

  if (closeStart < 0 || closeEnd < 0) return null;

  return { start, openEnd, closeStart, closeEnd };
}

function extractTemplateCopyHtml(html: string): string {
  const bounds = getTemplateCopySegmentBounds(html);
  if (!bounds) return html;
  return html.slice(bounds.openEnd, bounds.closeStart).trim() || '<p><br></p>';
}

function replaceTemplateCopyHtml(fullHtml: string, nextCopyHtml: string): string {
  const bounds = getTemplateCopySegmentBounds(fullHtml);
  if (!bounds) return fullHtml;

  const before = fullHtml.slice(0, bounds.openEnd);
  const after = fullHtml.slice(bounds.closeStart);
  return `${before}${nextCopyHtml}${after}`;
}

export function EbayTemplateCopyWysiwygEditor({
  fieldName,
  value,
  setFormValue,
  onValueChange,
  disabled = false,
  label = 'Advanced: eBay Template Copy',
  helperText = 'WYSIWYG editor scoped to this disclaimer/body text block only. Add lines and apply formatting here.',
}: EbayTemplateCopyWysiwygEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const lastRenderedScopedHtmlRef = useRef<string>('');
  const latestFullHtmlRef = useRef<string>(value);
  const [sourceMode, setSourceMode] = useState(false);

  const scopedHtml = extractTemplateCopyHtml(value);

  useEffect(() => {
    latestFullHtmlRef.current = value;
  }, [value]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (document.activeElement === editor) return;
    if (editor.innerHTML === scopedHtml) return;
    editor.innerHTML = scopedHtml;
    lastRenderedScopedHtmlRef.current = scopedHtml;
  }, [scopedHtml, sourceMode]);

  const commitScopedHtml = (nextScopedHtml: string) => {
    const normalizedScoped = normalizeEditorHtml(nextScopedHtml);
    lastRenderedScopedHtmlRef.current = normalizedScoped;
    const baseFullHtml = latestFullHtmlRef.current;
    const nextFullHtml = replaceTemplateCopyHtml(baseFullHtml, normalizedScoped);
    latestFullHtmlRef.current = nextFullHtml;
    setFormValue(fieldName, nextFullHtml);
    onValueChange?.(nextFullHtml);
  };

  const saveEditorSelection = () => {
    if (typeof window === 'undefined') return;
    const selection = window.getSelection();
    const editor = editorRef.current;
    if (!selection || selection.rangeCount === 0 || !editor) return;

    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;
    savedSelectionRef.current = range.cloneRange();
  };

  const restoreEditorSelection = () => {
    if (typeof window === 'undefined') return;
    const selection = window.getSelection();
    const range = savedSelectionRef.current;
    if (!selection || !range) return;

    selection.removeAllRanges();
    selection.addRange(range);
  };

  const runToolbarCommand = (command: string, commandValue?: string) => {
    const editor = editorRef.current;
    if (!editor || disabled || sourceMode) return;

    editor.focus();
    restoreEditorSelection();

    // Prefer semantic tags (<strong>/<em>/<u>) over inline style spans.
    applyEditorCommandWithValue('styleWithCSS', 'false');

    if (typeof commandValue === 'string') {
      applyEditorCommandWithValue(command, commandValue);
    } else {
      applyEditorCommand(command);
    }

    saveEditorSelection();
    commitScopedHtml(editor.innerHTML ?? '');
  };

  return (
    <details className={`${detailDisclosureClass} col-span-1 md:col-span-2`} open>
      <summary className={detailDisclosureSummaryClass}>{label}</summary>
      <div className={`${detailDisclosureBodyClass} flex flex-col gap-3`}>
        <p className="m-0 text-[0.74rem] leading-5 text-[var(--muted)]">{helperText}</p>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={toolbarButtonClass} title="Bold" aria-label="Bold" onMouseDown={preventToolbarMouseDown} onClick={() => runToolbarCommand('bold')} disabled={disabled || sourceMode}><IconBold /></button>
          <button type="button" className={toolbarButtonClass} title="Italic" aria-label="Italic" onMouseDown={preventToolbarMouseDown} onClick={() => runToolbarCommand('italic')} disabled={disabled || sourceMode}><IconItalic /></button>
          <button type="button" className={toolbarButtonClass} title="Underline" aria-label="Underline" onMouseDown={preventToolbarMouseDown} onClick={() => runToolbarCommand('underline')} disabled={disabled || sourceMode}><IconUnderline /></button>
          <button type="button" className={toolbarButtonClass} title="Bulleted list" aria-label="Bulleted list" onMouseDown={preventToolbarMouseDown} onClick={() => runToolbarCommand('insertUnorderedList')} disabled={disabled || sourceMode}><IconBulletedList /></button>
          <button type="button" className={toolbarButtonClass} title="Numbered list" aria-label="Numbered list" onMouseDown={preventToolbarMouseDown} onClick={() => runToolbarCommand('insertOrderedList')} disabled={disabled || sourceMode}><IconNumberedList /></button>
          <button
            type="button"
            className={`${toolbarButtonClass} border-[var(--accent)]/50 text-[var(--accent)]`}
            title="Insert link"
            aria-label="Insert link"
            onMouseDown={preventToolbarMouseDown}
            onClick={() => {
              if (disabled || sourceMode) return;
              const nextUrl = typeof window !== 'undefined' ? window.prompt('Enter URL', 'https://')?.trim() ?? '' : '';
              if (!nextUrl) return;
              runToolbarCommand('createLink', nextUrl);
            }}
            disabled={disabled || sourceMode}
          >
            <IconLink />
          </button>
          <button type="button" className={`${toolbarButtonClass} border-rose-300 text-rose-700 hover:border-rose-500 hover:text-rose-800`} title="Remove link" aria-label="Remove link" onMouseDown={preventToolbarMouseDown} onClick={() => runToolbarCommand('unlink')} disabled={disabled || sourceMode}><IconUnlink /></button>
          <button type="button" className={toolbarButtonClass} title="Align left" aria-label="Align left" onMouseDown={preventToolbarMouseDown} onClick={() => runToolbarCommand('justifyLeft')} disabled={disabled || sourceMode}><IconAlignLeft /></button>
          <button type="button" className={toolbarButtonClass} title="Align center" aria-label="Align center" onMouseDown={preventToolbarMouseDown} onClick={() => runToolbarCommand('justifyCenter')} disabled={disabled || sourceMode}><IconAlignCenter /></button>
          <button type="button" className={toolbarButtonClass} title="Align right" aria-label="Align right" onMouseDown={preventToolbarMouseDown} onClick={() => runToolbarCommand('justifyRight')} disabled={disabled || sourceMode}><IconAlignRight /></button>
          <button type="button" className={toolbarButtonClass} title={sourceMode ? 'Switch to visual mode' : 'Switch to HTML source mode'} aria-label={sourceMode ? 'Switch to visual mode' : 'Switch to HTML source mode'} onClick={() => setSourceMode((current) => !current)} disabled={disabled}>{sourceMode ? <IconVisualMode /> : <IconSourceMode />}</button>
        </div>

        {sourceMode ? (
          <textarea
            className={`${editorSurfaceClass} resize-y font-mono leading-[1.4]`}
            value={scopedHtml}
            onChange={(event) => commitScopedHtml(event.target.value)}
            disabled={disabled}
            aria-label="eBay template copy HTML source"
          />
        ) : (
          <div
            ref={editorRef}
            className={`${editorSurfaceClass} leading-[1.5]`}
            contentEditable={!disabled}
            suppressContentEditableWarning
            onMouseUp={saveEditorSelection}
            onKeyUp={saveEditorSelection}
            onFocus={saveEditorSelection}
            onInput={(event) => commitScopedHtml((event.currentTarget as HTMLDivElement).innerHTML)}
            onBlur={(event) => commitScopedHtml((event.currentTarget as HTMLDivElement).innerHTML)}
            aria-label="eBay template copy visual editor"
            role="textbox"
          />
        )}
      </div>
    </details>
  );
}