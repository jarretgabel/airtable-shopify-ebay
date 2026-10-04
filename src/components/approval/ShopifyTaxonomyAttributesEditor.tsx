import { useEffect, useMemo, useState } from 'react';
import { getTaxonomyCategoryAttributes, resolveTaxonomyCategory } from '@/services/app-api/shopify';
import type { ShopifyTaxonomyCategoryAttribute } from '@/services/shopify';
import {
  buildEmptyShopifyTaxonomyAttributes,
  parseShopifyTaxonomyAttributes,
  serializeShopifyTaxonomyAttributes,
  type ShopifyTaxonomyAttributesDocument,
} from '@/services/shopifyTaxonomyAttributes';

const inputClass = 'w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]';

function getCategoryFieldValue(formValues: Record<string, string>): string {
  const preferred = [
    'Shopify GraphQL Category ID',
    'Shopify Taxonomy Category ID',
    'Shopify Category ID',
    'Shopify Type',
    'Shopify Category',
    'Category',
  ];
  for (const name of preferred) {
    const value = formValues[name]?.trim();
    if (value) return value;
  }
  return '';
}

function hasCategoryId(value: string): boolean {
  return /^gid:\/\/shopify\/TaxonomyCategory\//i.test(value);
}

interface ShopifyTaxonomyAttributesEditorProps {
  fieldName: string;
  value: string;
  formValues: Record<string, string>;
  setFormValue: (fieldName: string, value: string) => void;
  disabled: boolean;
}

export function ShopifyTaxonomyAttributesEditor({
  fieldName,
  value,
  formValues,
  setFormValue,
  disabled,
}: ShopifyTaxonomyAttributesEditorProps) {
  const categoryValue = getCategoryFieldValue(formValues);
  const categoryLabelValue = formValues['Shopify Type'] ?? formValues['Shopify Category'] ?? categoryValue;
  const [category, setCategory] = useState<{ id: string; fullName: string } | null>(null);
  const [definitions, setDefinitions] = useState<ShopifyTaxonomyCategoryAttribute[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const parsedDocument = useMemo(() => parseShopifyTaxonomyAttributes(value), [value]);
  const document = useMemo(() => {
    if (!category) return null;
    if (parsedDocument && parsedDocument.categoryId === category.id) return parsedDocument;
    return buildEmptyShopifyTaxonomyAttributes(category.id, category.fullName);
  }, [category, parsedDocument]);

  useEffect(() => {
    let cancelled = false;
    if (!categoryValue.trim()) {
      setCategory(null);
      setDefinitions([]);
      return undefined;
    }

    setLoading(true);
    setError('');
    void (async () => {
      try {
        const resolved = hasCategoryId(categoryValue)
          ? { id: categoryValue, fullName: categoryLabelValue }
          : await resolveTaxonomyCategory(categoryValue);
        if (!resolved?.id || !resolved.fullName || cancelled) return;
        const nextDefinitions = await getTaxonomyCategoryAttributes(resolved.id, resolved.fullName);
        if (cancelled) return;
        setCategory({ id: resolved.id, fullName: resolved.fullName });
        setDefinitions(nextDefinitions);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to load Shopify taxonomy attributes.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [categoryLabelValue, categoryValue]);

  useEffect(() => {
    if (!category || !document || document.categoryId !== category.id) return;
    const allowed = new Map(definitions.map((definition) => [definition.id, definition]));
    const nextAttributes = document.attributes.flatMap((selection) => {
      const definition = allowed.get(selection.id);
      if (!definition || selection.type !== definition.type) return [];
      if (selection.type === 'choice' && definition.type === 'choice') {
        const validValues = new Set(definition.values.map((option) => option.id));
        const values = selection.values.filter((option) => validValues.has(option.id));
        return values.length > 0 ? [{ ...selection, values }] : [];
      }
      return [selection];
    });
    if (nextAttributes.length !== document.attributes.length) {
      setFormValue(fieldName, serializeShopifyTaxonomyAttributes({ ...document, attributes: nextAttributes }));
    }
  }, [category, definitions, document, fieldName, setFormValue]);

  const updateDocument = (next: ShopifyTaxonomyAttributesDocument) => setFormValue(fieldName, serializeShopifyTaxonomyAttributes(next));
  const selectionById = new Map((document?.attributes ?? []).map((selection) => [selection.id, selection]));

  if (value.trim() && !parsedDocument) {
    return <p className="col-span-1 text-sm text-rose-300 md:col-span-2">Shopify taxonomy attributes JSON is malformed or from an unsupported version. Choose the category attributes again to replace it.</p>;
  }

  if (!category && !loading) {
    return <p className="col-span-1 text-sm text-[var(--muted)] md:col-span-2">Choose a verified Shopify category before editing taxonomy attributes.</p>;
  }

  return (
    <section className="col-span-1 space-y-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 md:col-span-2">
      <div>
        <h3 className="m-0 text-sm font-semibold text-[var(--ink)]">Shopify taxonomy attributes</h3>
        <p className="m-0 mt-1 text-xs text-[var(--muted)]">Values are saved with Shopify IDs and written to native Shopify taxonomy metafields when their definitions are available.</p>
      </div>
      {loading && <p className="m-0 text-sm text-[var(--muted)]">Loading category attributes...</p>}
      {error && <p className="m-0 text-sm text-rose-300">{error}</p>}
      {!loading && !error && definitions.map((definition) => {
        const selection = selectionById.get(definition.id);
        if (definition.type === 'choice') {
          const selected = new Set(selection?.type === 'choice' ? selection.values.map((option) => option.id) : []);
          return (
            <fieldset key={definition.id} className="space-y-2">
              <legend className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{definition.name}</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {definition.values.map((option) => (
                  <label key={option.id} className="flex items-center gap-2 text-sm text-[var(--ink)]">
                    <input
                      type="checkbox"
                      checked={selected.has(option.id)}
                      disabled={disabled}
                      onChange={(event) => {
                        const nextValues = definition.values.filter((candidate) => event.target.checked ? selected.has(candidate.id) || candidate.id === option.id : selected.has(candidate.id) && candidate.id !== option.id);
                        const nextAttributes = (document?.attributes ?? []).filter((candidate) => candidate.id !== definition.id);
                        if (nextValues.length > 0) nextAttributes.push({ id: definition.id, name: definition.name, type: 'choice', values: nextValues });
                        updateDocument({ ...(document ?? buildEmptyShopifyTaxonomyAttributes(category?.id ?? '', category?.fullName ?? '')), attributes: nextAttributes });
                      }}
                    />
                    {option.name}
                  </label>
                ))}
              </div>
            </fieldset>
          );
        }

        if (definition.type === 'measurement') {
          const measurement = selection?.type === 'measurement' ? selection : undefined;
          return (
            <div key={definition.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,220px)]">
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                {definition.name}
                <input className={inputClass} type="number" step="any" value={measurement?.value ?? ''} disabled={disabled} onChange={(event) => {
                  const nextAttributes = (document?.attributes ?? []).filter((candidate) => candidate.id !== definition.id);
                  const numericValue = Number(event.target.value);
                  if (Number.isFinite(numericValue) && event.target.value.trim()) nextAttributes.push({ id: definition.id, name: definition.name, type: 'measurement', value: numericValue, option: measurement?.option ?? definition.options[0] });
                  updateDocument({ ...(document ?? buildEmptyShopifyTaxonomyAttributes(category?.id ?? '', category?.fullName ?? '')), attributes: nextAttributes });
                }} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                Unit
                <select className={inputClass} value={measurement?.option.key ?? definition.options[0]?.key ?? ''} disabled={disabled} onChange={(event) => {
                  const option = definition.options.find((candidate) => candidate.key === event.target.value) ?? definition.options[0];
                  if (!option) return;
                  const nextAttributes = (document?.attributes ?? []).filter((candidate) => candidate.id !== definition.id);
                  if (measurement) nextAttributes.push({ ...measurement, option });
                  updateDocument({ ...(document ?? buildEmptyShopifyTaxonomyAttributes(category?.id ?? '', category?.fullName ?? '')), attributes: nextAttributes });
                }}>
                  {definition.options.map((option) => <option key={option.key} value={option.key}>{option.value}</option>)}
                </select>
              </label>
            </div>
          );
        }

        const text = selection?.type === 'text' ? selection.value : '';
        return <label key={definition.id} className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{definition.name}<input className={inputClass} value={text} disabled={disabled} onChange={(event) => updateDocument({ ...(document ?? buildEmptyShopifyTaxonomyAttributes(category?.id ?? '', category?.fullName ?? '')), attributes: [...(document?.attributes ?? []).filter((candidate) => candidate.id !== definition.id), ...(event.target.value ? [{ id: definition.id, name: definition.name, type: 'text' as const, value: event.target.value }] : [])] })} /></label>;
      })}
    </section>
  );
}
