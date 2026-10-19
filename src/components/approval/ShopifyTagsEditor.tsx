import { useMemo, useState } from 'react';
import { dedupeShopifyTags } from '@/services/shopifyTags';
import { suggestShopifyTags } from '@/services/categorySuggestions';
import { collectAiListingFields } from '@/components/approval/aiListingFields';
import { useRegisterCategorySuggester } from '@/components/approval/aiCategorySuggesterRegistry';

export interface ShopifyTagsEditorProps {
  label?: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
  maxTags?: number;
  formValues?: Record<string, string>;
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
  formValues,
}: ShopifyTagsEditorProps) {
  const normalizedTags = useMemo(() => dedupeShopifyTags(tags), [tags]);
  const [pendingTag, setPendingTag] = useState('');
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState('');
  // Lowercased AI-invented tags that no store product uses yet, kept visibly marked for review.
  const [newSuggestedTags, setNewSuggestedTags] = useState<Set<string>>(new Set());
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

  // Suggested tags are added to the current ones, never replacing them.
  async function suggestTags(fields: Record<string, string>) {
    setIsSuggesting(true);
    setSuggestError('');
    try {
      const suggestions = await suggestShopifyTags(fields);
      const existing = new Set(normalizedTags.map((tag) => tag.toLowerCase()));
      const additions = dedupeShopifyTags([...suggestions.tags, ...suggestions.newTags])
        .filter((tag) => !existing.has(tag.toLowerCase()));
      if (additions.length === 0) {
        setSuggestError(suggestions.tags.length + suggestions.newTags.length === 0
          ? 'No matching tags found for this listing.'
          : 'The suggested tags are already added.');
        return;
      }

      const limit = typeof maxTags === 'number' ? Math.max(0, maxTags - normalizedTags.length) : additions.length;
      const added = additions.slice(0, limit);
      onChange([...normalizedTags, ...added]);

      const newOnes = new Set(suggestions.newTags.map((tag) => tag.toLowerCase()));
      const addedNew = added.filter((tag) => newOnes.has(tag.toLowerCase()));
      if (addedNew.length > 0) {
        setNewSuggestedTags((current) => new Set([...current, ...addedNew.map((tag) => tag.toLowerCase())]));
        setSuggestError(`Added ${addedNew.length} new tag${addedNew.length === 1 ? '' : 's'} no product uses yet (marked). Remove any you don't want.`);
      }
    } finally {
      setIsSuggesting(false);
    }
  }

  async function handleSuggestClick() {
    try {
      await suggestTags(collectAiListingFields(formValues ?? {}));
    } catch (error) {
      setSuggestError(error instanceof Error ? error.message : 'Could not suggest tags.');
    }
  }

  useRegisterCategorySuggester('shopify-tags', formValues ? (fields) => suggestTags(fields) : null);

  function removeTag(tagToRemove: string) {
    onChange(normalizedTags.filter((tag) => tag !== tagToRemove));
  }

  return (
    <div className="col-span-1 flex flex-col gap-2 md:col-span-2">
      <span className={`${labelClass} flex items-center gap-2`}>
        <span>{label}</span>
        {formValues && (
          <button
            type="button"
            className="ml-auto rounded-md border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1 text-[0.68rem] font-semibold normal-case tracking-normal text-[var(--ink)] hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => { void handleSuggestClick(); }}
            disabled={disabled || isSuggesting || isAtLimit}
          >
            {isSuggesting ? 'Suggesting…' : 'Suggest with AI'}
          </button>
        )}
      </span>
      {suggestError && <span role="alert" className={`text-xs ${suggestError.startsWith('Added') ? 'text-amber-300' : 'text-rose-400'}`}>{suggestError}</span>}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {normalizedTags.map((tag) => (
            <span
              key={tag}
              title={newSuggestedTags.has(tag.toLowerCase()) ? 'New tag suggested by AI. No product uses it yet.' : undefined}
              className={`inline-flex max-w-full items-center gap-1 rounded-full border px-3 py-1 text-sm ${newSuggestedTags.has(tag.toLowerCase())
                ? 'border-dashed border-amber-400/60 bg-amber-500/10 text-amber-100'
                : 'border-sky-400/30 bg-sky-500/10 text-sky-100'}`}
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