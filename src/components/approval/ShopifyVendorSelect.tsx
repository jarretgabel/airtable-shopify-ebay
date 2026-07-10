import { useEffect, useMemo, useRef, useState } from 'react';
import { createConfiguredRecord, getConfiguredRecords } from '@/services/app-api/airtable';

const inputBaseClass =
  'w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-400/30 disabled:cursor-not-allowed disabled:opacity-70';
const labelClass = 'mb-1 block text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]';

const VENDOR_FIELD_CANDIDATES = ['Name', 'Vendor', 'Brand', 'Vendor Name'] as const;

function normalizeFieldKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeVendor(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function vendorSort(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'base' });
}

function extractStringValues(rawValue: unknown): string[] {
  if (typeof rawValue === 'string') {
    const value = normalizeVendor(rawValue);
    return value ? [value] : [];
  }

  if (Array.isArray(rawValue)) {
    return rawValue
      .flatMap((entry) => {
        if (typeof entry === 'string') return normalizeVendor(entry);
        if (entry && typeof entry === 'object' && 'name' in entry && typeof entry.name === 'string') {
          return normalizeVendor(entry.name);
        }
        return '';
      })
      .filter(Boolean);
  }

  if (rawValue && typeof rawValue === 'object' && 'name' in rawValue && typeof rawValue.name === 'string') {
    const value = normalizeVendor(rawValue.name);
    return value ? [value] : [];
  }

  return [];
}

export interface ShopifyVendorSelectProps {
  fieldName: string;
  value: string;
  onChange: (value: string) => void;
  defaultValue?: string;
  disabled?: boolean;
}

function extractVendorValuesFromFields(fields: Record<string, unknown> | undefined): {
  values: string[];
  matchedFieldName?: string;
} {
  if (!fields) {
    return { values: [] };
  }

  const fieldEntries = Object.entries(fields);
  const normalizedCandidates = VENDOR_FIELD_CANDIDATES.map((candidate) => ({
    raw: candidate,
    normalized: normalizeFieldKey(candidate),
  }));

  for (const candidate of normalizedCandidates) {
    const match = fieldEntries.find(([fieldName]) => normalizeFieldKey(fieldName) === candidate.normalized);
    if (!match) continue;

    const values = extractStringValues(match[1]);
    if (values.length > 0) {
      return { values, matchedFieldName: match[0] };
    }
  }

  const nameLikeMatch = fieldEntries.find(([fieldName]) => {
    const normalized = normalizeFieldKey(fieldName);
    return normalized === 'name' || normalized.endsWith('name');
  });

  if (!nameLikeMatch) {
    return { values: [] };
  }

  const values = extractStringValues(nameLikeMatch[1]);
  return { values, matchedFieldName: nameLikeMatch[0] };
}

function collectVendorValues(records: Array<{ fields?: Record<string, unknown> }>): {
  vendors: Set<string>;
  preferredFieldName?: string;
  seenFieldNames: Set<string>;
} {
  const vendors = new Set<string>();
  const seenFieldNames = new Set<string>();
  let preferredFieldName: string | undefined;

  records.forEach((record) => {
    const fields = record.fields as Record<string, unknown> | undefined;
    if (!fields) return;

    Object.keys(fields).forEach((fieldName) => seenFieldNames.add(fieldName));

    const { values, matchedFieldName } = extractVendorValuesFromFields(fields);
    if (values.length > 0) {
      preferredFieldName = matchedFieldName ?? preferredFieldName;
      values.forEach((vendorName) => vendors.add(vendorName));
      return;
    }

    // Final fallback: use the first non-empty string-like cell value from each record.
    for (const rawValue of Object.values(fields)) {
      const extracted = extractStringValues(rawValue);
      if (extracted.length > 0) {
        extracted.forEach((vendorName) => vendors.add(vendorName));
        break;
      }
    }
  });

  return { vendors, preferredFieldName, seenFieldNames };
}

export function ShopifyVendorSelect({
  fieldName,
  value,
  onChange,
  defaultValue = '',
  disabled = false,
}: ShopifyVendorSelectProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [vendors, setVendors] = useState<string[]>([]);
  const [loadDebug, setLoadDebug] = useState<{ recordsCount: number; fieldsSeen: string[] }>({
    recordsCount: 0,
    fieldsSeen: [],
  });
  const preferredFieldNameRef = useRef<string>('Name');
  const hasAppliedDefaultRef = useRef(false);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setIsLoading(true);
      setError('');
      try {
        const narrowRecords = await getConfiguredRecords('shopify-vendors', {
          fields: [...VENDOR_FIELD_CANDIDATES],
          maxRecords: 1000,
        });
        if (cancelled) return;

        const narrowResult = collectVendorValues(narrowRecords);
        let nextVendors = narrowResult.vendors;
        let preferredFieldName = narrowResult.preferredFieldName ?? preferredFieldNameRef.current;
        let fieldsSeen = narrowResult.seenFieldNames;
        let recordsCount = narrowRecords.length;

        if (nextVendors.size === 0 && narrowRecords.length > 0) {
          // Retry without field projection in case Airtable is returning sparse field sets.
          const broadRecords = await getConfiguredRecords('shopify-vendors', { maxRecords: 1000 });
          if (cancelled) return;

          const broadResult = collectVendorValues(broadRecords);
          nextVendors = broadResult.vendors;
          preferredFieldName = broadResult.preferredFieldName ?? preferredFieldName;
          fieldsSeen = broadResult.seenFieldNames;
          recordsCount = broadRecords.length;
        }

        preferredFieldNameRef.current = preferredFieldName;
        setVendors(Array.from(nextVendors).sort(vendorSort));
        setLoadDebug({
          recordsCount,
          fieldsSeen: Array.from(fieldsSeen).slice(0, 8),
        });
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load vendor values.');
          setLoadDebug({ recordsCount: 0, fieldsSeen: [] });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (hasAppliedDefaultRef.current) return;
    if (value.trim().length > 0) {
      hasAppliedDefaultRef.current = true;
      return;
    }

    const normalizedDefaultValue = normalizeVendor(defaultValue);
    if (!normalizedDefaultValue) {
      hasAppliedDefaultRef.current = true;
      return;
    }

    onChange(normalizedDefaultValue);
    hasAppliedDefaultRef.current = true;
  }, [defaultValue, onChange, value]);

  const normalizedQuery = normalizeVendor(query).toLowerCase();
  const hasTypedQuery = normalizedQuery.length > 0;
  const normalizedValue = normalizeVendor(value);
  const normalizedValueKey = normalizedValue.toLowerCase();

  const filteredVendors = useMemo(() => {
    if (!hasTypedQuery) return vendors;

    const startsWithMatches = vendors.filter((vendorName) => vendorName.toLowerCase().startsWith(normalizedQuery));
    const includesMatches = vendors.filter((vendorName) => {
      const normalizedVendorName = vendorName.toLowerCase();
      return normalizedVendorName.includes(normalizedQuery) && !normalizedVendorName.startsWith(normalizedQuery);
    });

    return [...startsWithMatches, ...includesMatches];
  }, [hasTypedQuery, normalizedQuery, vendors]);

  const hasExactQueryMatch = normalizedQuery.length > 0
    && vendors.some((vendorName) => vendorName.toLowerCase() === normalizedQuery);
  const canCreateFromQuery = normalizedQuery.length > 0 && !hasExactQueryMatch;

  const applyVendorSelection = (nextVendor: string) => {
    const normalized = normalizeVendor(nextVendor);
    onChange(normalized);
    setQuery('');
    setIsOpen(false);
  };

  const createVendor = async () => {
    const normalized = normalizeVendor(query);
    if (!normalized || disabled || isCreating) return;

    setIsCreating(true);
    setError('');

    const writeFields = Array.from(new Set([preferredFieldNameRef.current, ...VENDOR_FIELD_CANDIDATES]));

    try {
      let created = false;

      for (const fieldName of writeFields) {
        try {
          await createConfiguredRecord('shopify-vendors', { [fieldName]: normalized }, { typecast: true });
          preferredFieldNameRef.current = fieldName;
          created = true;
          break;
        } catch {
          // Try the next candidate field if this one is not writable on the vendors table.
        }
      }

      if (!created) {
        throw new Error('Unable to create vendor in Airtable. Check the vendors table field names.');
      }

      setVendors((current) => {
        if (current.some((vendorName) => vendorName.toLowerCase() === normalized.toLowerCase())) {
          return current;
        }
        return [...current, normalized].sort(vendorSort);
      });
      applyVendorSelection(normalized);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create vendor.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="relative col-span-1 flex flex-col gap-2 md:col-span-2">
      <span className={labelClass}>Vendor</span>

      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--muted)]">Selected value</span>
          <span className="inline-flex max-w-full items-center rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-sm text-blue-100">
            <span className="truncate">{normalizedValue || 'No vendor selected'}</span>
            {normalizedValue ? (
              <button
                type="button"
                className="ml-2 rounded-full text-blue-100/80 transition-colors hover:text-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => onChange('')}
                disabled={disabled}
                aria-label="Clear selected vendor"
              >
                x
              </button>
            ) : null}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input
            className={inputBaseClass}
            type="text"
            value={query}
            placeholder={normalizedValue ? 'Search vendors' : 'Search or add a vendor'}
            disabled={disabled || isLoading}
            onFocus={() => {
              if (!disabled) setIsOpen(true);
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              setIsOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                setIsOpen(false);
                setQuery('');
                return;
              }

              if (event.key === 'Enter') {
                event.preventDefault();
                if (filteredVendors.length > 0) {
                  applyVendorSelection(filteredVendors[0]);
                  return;
                }

                if (canCreateFromQuery) {
                  void createVendor();
                }
              }
            }}
            onBlur={() => {
              blurTimerRef.current = setTimeout(() => {
                setIsOpen(false);
                setQuery('');
              }, 120);
            }}
            aria-label="Vendor"
            aria-expanded={isOpen}
            aria-controls={`${fieldName}-vendor-options`}
            aria-autocomplete="list"
          />
          <button
            type="button"
            className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-70"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setQuery('');
              setIsOpen((current) => !current);
            }}
            disabled={disabled || isLoading}
            aria-label="Toggle vendor options"
            aria-expanded={isOpen}
          >
            ▼
          </button>
          <button
            type="button"
            className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-70"
            onClick={() => onChange('')}
            disabled={disabled || normalizedValue.length === 0}
          >
            Clear
          </button>
        </div>

        <p className="m-0 mt-2 text-xs text-[var(--muted)]">
          Type to search existing vendors. Press Enter to select the top match.
        </p>
      </div>

      {isOpen && (
        <div
          id={`${fieldName}-vendor-options`}
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2 shadow-[0_20px_45px_rgba(15,23,42,0.4)]"
          role="listbox"
        >
          {isLoading && <p className="m-0 px-2 py-2 text-sm text-[var(--muted)]">Loading vendors...</p>}
          {!isLoading && error && <p className="m-0 px-2 py-2 text-sm text-rose-300">{error}</p>}
          {!isLoading && !error && filteredVendors.length === 0 && !canCreateFromQuery && (
            <p className="m-0 px-2 py-2 text-sm text-[var(--muted)]">No vendors matched that search.</p>
          )}

          {!isLoading && !error && filteredVendors.length === 0 && !canCreateFromQuery && import.meta.env.DEV && (
            <p className="m-0 px-2 pb-2 text-xs text-[var(--muted)]">
              Debug: loaded {loadDebug.recordsCount} records; fields seen: {loadDebug.fieldsSeen.join(', ') || 'none'}
            </p>
          )}

          {!isLoading && !error && filteredVendors.map((vendorName) => {
            const selected = vendorName.toLowerCase() === normalizedValueKey;
            return (
              <button
                key={vendorName}
                type="button"
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-white/10 ${selected ? 'bg-white/10' : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => applyVendorSelection(vendorName)}
                role="option"
                aria-selected={selected}
              >
                <span className="text-sm text-[var(--ink)]">{vendorName}</span>
                {selected ? <span className="text-xs text-[var(--muted)]">Selected</span> : null}
              </button>
            );
          })}

          {!isLoading && canCreateFromQuery && (
            <button
              type="button"
              className="mt-1 flex w-full items-center justify-between rounded-lg border border-dashed border-[var(--line)] px-3 py-2 text-left text-sm text-[var(--ink)] transition hover:border-[var(--accent)] hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-70"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                void createVendor();
              }}
              disabled={disabled || isCreating}
            >
              <span>Add "{normalizeVendor(query)}" to vendors</span>
              <span className="text-xs text-[var(--muted)]">{isCreating ? 'Saving...' : 'Create'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
