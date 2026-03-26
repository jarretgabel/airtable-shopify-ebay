import { useEffect, useMemo, useRef, useState } from 'react';
import { shopifyService, type ShopifyTaxonomyCategoryMatch } from '@/services/shopify';
import { trimShopifyProductType } from '@/services/shopifyTaxonomy';

const inputBaseClass =
  'w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-400/30 disabled:cursor-not-allowed disabled:opacity-70';
const labelClass = 'mb-1 block text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]';
const requiredBadgeClass = 'inline-block rounded-full border border-rose-400/45 bg-rose-500/15 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.06em] text-rose-200';

interface ShopifyTaxonomyTypeSelectProps {
  fieldName: string;
  label: string;
  required?: boolean;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

export function ShopifyTaxonomyTypeSelect({
  fieldName,
  label,
  required = false,
  value,
  disabled,
  onChange,
}: ShopifyTaxonomyTypeSelectProps) {
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [options, setOptions] = useState<ShopifyTaxonomyCategoryMatch[]>([]);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (!isOpen || disabled) return;

    let cancelled = false;
    const timeoutId = setTimeout(() => {
      void (async () => {
        setIsLoading(true);
        setError('');

        try {
          const matches = await shopifyService.searchTaxonomyCategories(query.trim(), 20);
          if (!cancelled) {
            setOptions(matches);
          }
        } catch (searchError) {
          if (!cancelled) {
            setOptions([]);
            setError(searchError instanceof Error ? searchError.message : 'Unable to load Shopify categories.');
          }
        } finally {
          if (!cancelled) {
            setIsLoading(false);
          }
        }
      })();
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [disabled, isOpen, query]);

  useEffect(() => () => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
    }
  }, []);

  const productTypePreview = useMemo(() => trimShopifyProductType(value || query), [query, value]);
  const labelClassName = required ? `${labelClass} text-rose-200` : labelClass;
  const inputClassName = required
    ? `${inputBaseClass} border-rose-400/45 bg-rose-500/5 focus:border-rose-300`
    : inputBaseClass;
  const toggleButtonClassName = required
    ? 'rounded-xl border border-rose-400/45 bg-rose-500/5 px-3 py-2 text-sm text-[var(--ink)] transition hover:border-rose-300 disabled:cursor-not-allowed disabled:opacity-70'
    : 'rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-70';

  const openMenu = () => {
    if (disabled) return;
    setIsOpen(true);
  };

  const closeMenu = () => {
    setIsOpen(false);
    setQuery(value);
  };

  const commitSelection = (nextValue: string) => {
    onChange(nextValue);
    setQuery(nextValue);
    setIsOpen(false);
  };

  return (
    <div className="relative flex flex-col gap-2">
      <span className={`${labelClassName} flex items-center gap-2`}>
        <span>{label}</span>
        {required && <span className={requiredBadgeClass}>Required</span>}
      </span>
      <div className="flex items-center gap-2">
        <input
          className={inputClassName}
          type="text"
          value={query}
          placeholder="Search Shopify categories"
          disabled={disabled}
          onFocus={openMenu}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              closeMenu();
              return;
            }

            if (event.key === 'Enter' && options.length > 0) {
              event.preventDefault();
              commitSelection(options[0].fullName);
            }
          }}
          onBlur={() => {
            blurTimerRef.current = setTimeout(() => {
              closeMenu();
            }, 120);
          }}
          aria-label={label}
          aria-expanded={isOpen}
          aria-controls={`${fieldName}-taxonomy-options`}
          aria-autocomplete="list"
        />
        <button
          type="button"
          className={toggleButtonClassName}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setIsOpen((current) => !current)}
          disabled={disabled}
          aria-label="Toggle Shopify category choices"
          aria-expanded={isOpen}
        >
          ▼
        </button>
      </div>

      <p className="m-0 text-xs text-[var(--muted)]">
        Saves the full Shopify category path in {label}. Sends <strong className="text-[var(--ink)]">{productTypePreview || 'the leaf category'}</strong> as the Shopify product type.
      </p>

      {isOpen && (
        <div
          id={`${fieldName}-taxonomy-options`}
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2 shadow-[0_20px_45px_rgba(15,23,42,0.4)]"
          role="listbox"
        >
          {isLoading && <p className="m-0 px-2 py-2 text-sm text-[var(--muted)]">Loading Shopify categories...</p>}
          {!isLoading && error && <p className="m-0 px-2 py-2 text-sm text-rose-300">{error}</p>}
          {!isLoading && !error && options.length === 0 && (
            <p className="m-0 px-2 py-2 text-sm text-[var(--muted)]">No Shopify categories matched that search.</p>
          )}
          {!isLoading && !error && options.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`flex w-full flex-col rounded-lg px-3 py-2 text-left transition hover:bg-white/10 ${option.fullName === value ? 'bg-white/10' : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => commitSelection(option.fullName)}
              role="option"
              aria-selected={option.fullName === value}
            >
              <span className="text-sm text-[var(--ink)]">{option.fullName}</span>
              <span className="text-[0.72rem] text-[var(--muted)]">
                Product type: {trimShopifyProductType(option.fullName)}{option.isLeaf ? ' · leaf' : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
