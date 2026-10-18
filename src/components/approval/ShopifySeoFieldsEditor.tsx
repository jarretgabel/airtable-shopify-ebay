import { useState } from 'react';
import { tabFormControlMultilineClass } from '@/components/tabs/uiClasses';
import { generateListingSeoText } from '@/services/app-api/ai';

export const SHOPIFY_SEO_TITLE_FIELD_NAME = 'Shopify Extra SEO Title';
export const SHOPIFY_SEO_DESCRIPTION_FIELD_NAME = 'Shopify Extra SEO Description';

const SEO_FIELDS = [
  { kind: 'seoTitle', fieldName: SHOPIFY_SEO_TITLE_FIELD_NAME, label: 'SEO Title', noun: 'SEO title', max: 60, multiline: false },
  { kind: 'seoDescription', fieldName: SHOPIFY_SEO_DESCRIPTION_FIELD_NAME, label: 'SEO Description', noun: 'SEO description', max: 160, multiline: true },
] as const;

interface ShopifySeoFieldsEditorProps {
  formValues: Record<string, string>;
  setFormValue: (fieldName: string, value: string) => void;
  saving: boolean;
}

export function ShopifySeoFieldsEditor({ formValues, setFormValue, saving }: ShopifySeoFieldsEditorProps) {
  const [generating, setGenerating] = useState<'' | 'seoTitle' | 'seoDescription'>('');
  const [error, setError] = useState('');

  const collectListingFields = (excludedFieldName: string) => Object.fromEntries(
    Object.entries(formValues).filter(([name, value]) => (
      name !== excludedFieldName
      && name !== SHOPIFY_SEO_TITLE_FIELD_NAME
      && name !== SHOPIFY_SEO_DESCRIPTION_FIELD_NAME
      && typeof value === 'string'
      && value.trim().length > 0
      && value.length <= 1500
      && !/json|html|image|photo|url|^id$|record/i.test(name)
    )),
  );

  const handleGenerate = async (kind: 'seoTitle' | 'seoDescription') => {
    const config = SEO_FIELDS.find((field) => field.kind === kind)!;
    const existing = formValues[config.fieldName] ?? '';
    if (existing.trim() && !window.confirm(`Replace the current ${config.noun} with an AI-generated one?`)) {
      return;
    }

    setGenerating(kind);
    setError('');
    try {
      setFormValue(config.fieldName, await generateListingSeoText(kind, collectListingFields(config.fieldName), existing));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate SEO text.');
    } finally {
      setGenerating('');
    }
  };

  return (
    <div className="flex flex-col gap-3 md:col-span-2">
      {SEO_FIELDS.map(({ kind, fieldName, label, max, multiline }) => {
        const value = formValues[fieldName] ?? '';
        const inputId = `shopify-${kind}-field`;
        return (
          <div key={kind} className="flex flex-col gap-2">
            <div className="mb-1 flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
              <label htmlFor={inputId}>{label}</label>
              <span className={`normal-case tracking-normal ${value.length > max ? 'text-rose-400' : ''}`}>{value.length}/{max}</span>
              <button
                type="button"
                className="ml-auto rounded-md border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1 text-[0.68rem] font-semibold normal-case tracking-normal text-[var(--ink)] hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => { void handleGenerate(kind); }}
                disabled={saving || generating !== ''}
              >
                {generating === kind ? 'Generating…' : 'Generate with AI'}
              </button>
            </div>
            {multiline ? (
              <textarea
                id={inputId}
                className={`${tabFormControlMultilineClass} min-h-[72px] bg-[var(--panel)] disabled:cursor-not-allowed disabled:opacity-70`}
                value={value}
                onChange={(event) => setFormValue(fieldName, event.target.value)}
                disabled={saving}
              />
            ) : (
              <input
                id={inputId}
                type="text"
                className={`${tabFormControlMultilineClass} bg-[var(--panel)] disabled:cursor-not-allowed disabled:opacity-70`}
                value={value}
                onChange={(event) => setFormValue(fieldName, event.target.value)}
                disabled={saving}
              />
            )}
          </div>
        );
      })}
      {error && <span role="alert" className="text-xs text-rose-400">{error}</span>}
    </div>
  );
}
