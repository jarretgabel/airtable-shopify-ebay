import { useMemo } from 'react';

interface EbayTemplateCopyTextEditorProps {
  fieldName: string;
  value: string;
  setFormValue: (fieldName: string, value: string) => void;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  label?: string;
  helperText?: string;
}

const DEFAULT_TEXT = [
  'All included items are pictured.',
  'Each unit is tested; defects or service notes are listed below. 30-day warranty included.',
  'Local pickup in NYC available.',
].join('\n\n');

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getTemplateCopySegmentBounds(html: string): { start: number; end: number } | null {
  const openMatch = /<div\s+class=("|')h\1[^>]*>/i.exec(html);
  if (!openMatch || typeof openMatch.index !== 'number') return null;

  const start = openMatch.index;
  const openEnd = start + openMatch[0].length;
  const divTagPattern = /<\/?div\b[^>]*>/gi;
  divTagPattern.lastIndex = openEnd;

  let depth = 1;
  let closeIndex = -1;

  for (let tagMatch = divTagPattern.exec(html); tagMatch; tagMatch = divTagPattern.exec(html)) {
    const tag = tagMatch[0].toLowerCase();
    const isClosing = tag.startsWith('</div');
    const isSelfClosing = !isClosing && /\/\s*>$/.test(tag);

    if (isSelfClosing) continue;

    if (isClosing) {
      depth -= 1;
      if (depth === 0) {
        closeIndex = tagMatch.index;
        break;
      }
    } else {
      depth += 1;
    }
  }

  if (closeIndex < 0) return null;

  return { start, end: closeIndex + '</div>'.length };
}

function extractTemplateCopyText(html: string): string {
  const bounds = getTemplateCopySegmentBounds(html);
  const segment = bounds ? html.slice(bounds.start, bounds.end) : html;

  const innerHtml = segment
    .replace(/^<div\s+class=("|')h\1[^>]*>/i, '')
    .replace(/<\/div>\s*$/i, '');

  const normalized = innerHtml
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n')
    .replace(/<\/div\s*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '')
    .replace(/<div\b[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\r\n?/g, '\n');

  const text = decodeHtmlEntities(normalized)
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text || DEFAULT_TEXT;
}

function toTemplateCopyHtml(text: string): string {
  const normalized = text.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return '<p><br></p>';

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => `<p>${escapeHtml(chunk).replace(/\n/g, '<br>')}</p>`);

  return paragraphs.length > 0 ? paragraphs.join('') : '<p><br></p>';
}

function replaceTemplateCopyText(html: string, text: string): string {
  const bounds = getTemplateCopySegmentBounds(html);
  if (!bounds) return html;

  const before = html.slice(0, bounds.start);
  const segment = html.slice(bounds.start, bounds.end);
  const after = html.slice(bounds.end);

  const startTagMatch = segment.match(/^<div\s+class=("|')h\1[^>]*>/i);
  const startTag = startTagMatch?.[0] ?? '<div class=h>';
  const nextSegment = `${startTag}${toTemplateCopyHtml(text)}</div>`;

  return `${before}${nextSegment}${after}`;
}

export function EbayTemplateCopyTextEditor({
  fieldName,
  value,
  setFormValue,
  onValueChange,
  disabled = false,
  label = 'Advanced: eBay Template Copy',
  helperText = 'Freeform plain-text editor scoped to this eBay body text block only.',
}: EbayTemplateCopyTextEditorProps) {
  const textValue = useMemo(() => extractTemplateCopyText(value), [value]);

  const commitText = (nextText: string) => {
    const nextHtml = replaceTemplateCopyText(value, nextText);
    setFormValue(fieldName, nextHtml);
    onValueChange?.(nextHtml);
  };

  return (
    <div className="col-span-1 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 md:col-span-2">
      <p className="m-0 mb-2 text-sm font-semibold text-[var(--ink)]">{label}</p>
      <p className="m-0 mb-3 text-xs text-[var(--muted)]">{helperText}</p>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-[var(--muted)]">Template text</span>
        <textarea
          className="min-h-[180px] w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm leading-6 text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-400/30 disabled:cursor-not-allowed disabled:opacity-70"
          value={textValue}
          onChange={(event) => commitText(event.target.value)}
          disabled={disabled}
          aria-label="eBay template copy plain text editor"
        />
      </label>
    </div>
  );
}