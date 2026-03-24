import { useMemo, useState } from 'react';
import { dedupeShopifyTags } from '@/services/shopifyTags';

export interface ShopifyTagsEditorProps {
  label?: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
  maxTags?: number;
}

const labelClass = 'mb-1 block text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]';
const inputClass =
  'min-w-[11rem] flex-1 border-0 bg-transparent px-0 py-1 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)] disabled:cursor-not-allowed';

function splitPendingTags(raw: string): string[] {
  return dedupeShopifyTags(raw.split(/[\n,]/).map((tag) => tag.trim()));
}

export function ShopifyTagsEditor({
  label = 'Tags',
  tags,
  onChange,
  disabled = false,
  maxTags,
}: ShopifyTagsEditorProps) {
  const normalizedTags = useMemo(() => dedupeShopifyTags(tags), [tags]);
  const [pendingTag, setPendingTag] = useState('');
  const isAtLimit = typeof maxTags === 'number' && normalizedTags.length >= maxTags;

  function commitPendingTag() {
    const nextTags = splitPendingTags(pendingTag);
    if (nextTags.length === 0) {
      setPendingTag('');
      return;
    }

    const availableSlots = typeof maxTags === 'number'
      ? Math.max(0, maxTags - normalizedTags.length)
      : nextTags.length;
    const tagsToAdd = typeof maxTags === 'number' ? nextTags.slice(0, availableSlots) : nextTags;

    if (tagsToAdd.length > 0) {
      onChange([...normalizedTags, ...tagsToAdd]);
    }
    setPendingTag('');
  }

  function removeTag(tagToRemove: string) {
    onChange(normalizedTags.filter((tag) => tag !== tagToRemove));
  }

  return (
    <div className="col-span-1 flex flex-col gap-2 md:col-span-2">
      <span className={labelClass}>{label}</span>
      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {normalizedTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-sm text-sky-100"
            >
              <span className="truncate">{tag}</span>
              <button
                type="button"
                className="rounded-full text-sky-100/80 transition-colors hover:text-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => removeTag(tag)}
                disabled={disabled}
                aria-label={`Remove tag ${tag}`}
              >
                ×
              </button>
            </span>
          ))}

          <input
            type="text"
            value={pendingTag}
            onChange={(event) => setPendingTag(event.target.value)}
            onBlur={commitPendingTag}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault();
                commitPendingTag();
                return;
              }

              if (event.key === 'Backspace' && pendingTag.length === 0 && normalizedTags.length > 0) {
                event.preventDefault();
                removeTag(normalizedTags[normalizedTags.length - 1]);
              }
            }}
            placeholder={isAtLimit ? 'Maximum tags reached' : 'Add a tag and press Enter'}
            className={inputClass}
            disabled={disabled || isAtLimit}
            aria-label="Add tag"
          />
        </div>

        <p className="m-0 mt-2 text-xs text-[var(--muted)]">
          Press Enter or type a comma to add each tag.
        </p>
      </div>
    </div>
  );
}