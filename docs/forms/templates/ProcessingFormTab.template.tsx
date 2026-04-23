import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ErrorSurface, PanelSurface } from '@/components/app/StateSurfaces';
import {
  createProcessingFormDefaults,
  processingFormFields,
  type ProcessingFormFieldDefinition,
  type ProcessingFormOptionFieldName,
  type ProcessingFormValues,
} from '@/components/tabs/<form-name>/processingFormSchema';
import { loadProcessingFormOptionSets, submitProcessingForm } from '@/services/processingForm';

type ProcessingFormOptionSets = Record<ProcessingFormOptionFieldName, string[]>;

const FIELD_CLASS = 'mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20';
const LABEL_CLASS = 'text-sm font-semibold text-[var(--ink)]';
const HELP_CLASS = 'mt-1 text-xs text-[var(--muted)]';

function validateForm(values: ProcessingFormValues): string | null {
  if (!values.sku.trim()) return 'SKU is required.';
  if (!values.make.trim()) return 'Make is required.';
  if (!values.model.trim()) return 'Model is required.';
  if (!values.componentType.trim()) return 'Component Type is required.';
  return null;
}

function FieldShell({ definition, children }: { definition: ProcessingFormFieldDefinition; children: ReactNode }) {
  return (
    <label className="block">
      <span className={LABEL_CLASS}>
        {definition.label}
        {definition.required ? ' *' : ''}
      </span>
      {children}
      {definition.description ? <p className={HELP_CLASS}>{definition.description}</p> : null}
    </label>
  );
}

export function ProcessingFormTab() {
  const [formValues, setFormValues] = useState<ProcessingFormValues>(() => createProcessingFormDefaults());
  const [optionSets, setOptionSets] = useState<ProcessingFormOptionSets | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<{ recordId: string; sku: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadOptions = async () => {
      setLoadingOptions(true);
      setOptionsError(null);
      try {
        const nextOptionSets = await loadProcessingFormOptionSets();
        if (!cancelled) {
          setOptionSets(nextOptionSets);
        }
      } catch (error) {
        if (!cancelled) {
          setOptionsError(error instanceof Error ? error.message : 'Unable to load form options.');
        }
      } finally {
        if (!cancelled) {
          setLoadingOptions(false);
        }
      }
    };

    void loadOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredComponentTypeOptions = useMemo(() => {
    const search = formValues.componentType.trim().toLowerCase();
    const options = optionSets?.['Component Type'] ?? [];
    if (!search) return options.slice(0, 12);
    return options.filter((option) => option.toLowerCase().includes(search)).slice(0, 12);
  }, [formValues.componentType, optionSets]);

  const setFieldValue = <K extends keyof ProcessingFormValues>(fieldName: K, value: ProcessingFormValues[K]) => {
    setFormValues((current) => ({ ...current, [fieldName]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    const validationError = validateForm(formValues);
    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitProcessingForm(formValues);
      setSubmitSuccess(result);
      setFormValues(createProcessingFormDefaults());
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to submit the form.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (definition: ProcessingFormFieldDefinition) => {
    const value = formValues[definition.name];

    if (definition.type === 'textarea') {
      return (
        <textarea
          className={FIELD_CLASS}
          rows={definition.rows ?? 4}
          value={value as string}
          placeholder={definition.placeholder}
          onChange={(event) => setFieldValue(definition.name, event.currentTarget.value as ProcessingFormValues[typeof definition.name])}
        />
      );
    }

    if (definition.type === 'file') {
      const files = value as File[];
      return (
        <>
          <input
            className={`${FIELD_CLASS} file:mr-4 file:rounded-lg file:border-0 file:bg-[var(--accent)] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:brightness-110`}
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => setFieldValue(definition.name, Array.from(event.currentTarget.files ?? []) as ProcessingFormValues[typeof definition.name])}
          />
          <p className={HELP_CLASS}>{files.length > 0 ? `${files.length} image${files.length === 1 ? '' : 's'} selected.` : 'No images selected.'}</p>
        </>
      );
    }

    if (definition.type === 'select') {
      const options = definition.optionFieldName && optionSets ? optionSets[definition.optionFieldName] : [];
      return (
        <select
          className={FIELD_CLASS}
          value={value as string}
          onChange={(event) => setFieldValue(definition.name, event.currentTarget.value as ProcessingFormValues[typeof definition.name])}
        >
          <option value="">Select an option</option>
          {options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      );
    }

    if (definition.type === 'searchable-select') {
      const options = definition.optionFieldName && optionSets ? optionSets[definition.optionFieldName] : [];
      const datalistId = `processing-form-${definition.name}-options`;
      return (
        <>
          <input
            className={FIELD_CLASS}
            type="text"
            list={datalistId}
            value={value as string}
            placeholder="Search options"
            onChange={(event) => setFieldValue(definition.name, event.currentTarget.value as ProcessingFormValues[typeof definition.name])}
          />
          <datalist id={datalistId}>
            {options.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
          <p className={HELP_CLASS}>
            {filteredComponentTypeOptions.length > 0
              ? `Matching options: ${filteredComponentTypeOptions.join(', ')}`
              : 'No matching options.'}
          </p>
        </>
      );
    }

    return (
      <input
        className={FIELD_CLASS}
        type={definition.type}
        value={value as string}
        placeholder={definition.placeholder}
        onChange={(event) => setFieldValue(definition.name, event.currentTarget.value as ProcessingFormValues[typeof definition.name])}
      />
    );
  };

  if (loadingOptions) {
    return <PanelSurface><div className="p-4 text-sm text-[var(--muted)]">Loading Processing Form configuration from Airtable...</div></PanelSurface>;
  }

  if (optionsError || !optionSets) {
    return <ErrorSurface title="Unable to load Processing Form" message={optionsError ?? 'The Airtable form configuration is unavailable.'} />;
  }

  return (
    <PanelSurface>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 px-5 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
          <p className="m-0 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">SB Inventory</p>
          <h2 className="mt-2 text-3xl font-semibold text-[var(--ink)]">Processing Form</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Replace this copy with the form-specific instruction text.</p>
        </div>

        {submitError ? (
          <div className="rounded-xl border border-[#f7c8c4] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-text)]">
            {submitError}
          </div>
        ) : null}

        {submitSuccess ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            Form submission saved to Airtable. Record ID: <strong>{submitSuccess.recordId}</strong>. SKU: <strong>{submitSuccess.sku}</strong>.
          </div>
        ) : null}

        <form className="space-y-5 rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5" onSubmit={handleSubmit}>
          {processingFormFields.map((field) => (
            <div key={field.airtableFieldName}>
              <FieldShell definition={field}>{renderField(field)}</FieldShell>
            </div>
          ))}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="m-0 text-sm text-[var(--muted)]">Required fields are marked with an asterisk.</p>
            <div className="flex gap-3">
              <button
                type="button"
                className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                onClick={() => {
                  setSubmitError(null);
                  setSubmitSuccess(null);
                  setFormValues(createProcessingFormDefaults());
                }}
                disabled={submitting}
              >
                Reset
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </PanelSurface>
  );
}