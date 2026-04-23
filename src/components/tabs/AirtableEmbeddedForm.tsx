import { useEffect, useMemo, useState } from 'react';
import { ErrorSurface, LoadingSurface, PanelSurface } from '@/components/app/StateSurfaces';
import {
  createIncomingGearFormDefaults,
  incomingGearFormFields,
  incomingGearFormIntro,
  type IncomingGearFormFieldDefinition,
  type IncomingGearFormIntroBlock,
  type IncomingGearFormOptionFieldName,
  type IncomingGearFormValues,
} from '@/components/tabs/incoming-gear/incomingGearFormSchema';
import { loadIncomingGearFormOptionSets, submitIncomingGearForm } from '@/services/incomingGearForm';

type IncomingGearOptionSets = Record<IncomingGearFormOptionFieldName, string[]>;

const FIELD_CLASS = 'mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20';
const LABEL_CLASS = 'text-sm font-semibold text-[var(--ink)]';
const HELP_CLASS = 'mt-1 text-xs text-[var(--muted)]';
const DATE_BUTTON_CLASS = 'mt-2 inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20';

function CalendarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 14h.01" />
      <path d="M12 14h.01" />
      <path d="M16 14h.01" />
      <path d="M8 18h.01" />
      <path d="M12 18h.01" />
      <path d="M16 18h.01" />
    </svg>
  );
}

function getIncomingGearFormUrl(): string | null {
  const rawUrl = [import.meta.env.VITE_AIRTABLE_INCOMING_GEAR_FORM_URL, import.meta.env.VITE_AIRTABLE_INCOMING_GEAR_FORM_EMBED_URL]
    .find((value) => typeof value === 'string' && value.trim().length > 0)
    ?.trim();

  if (!rawUrl) return null;

  try {
    return new URL(rawUrl).toString();
  } catch {
    return null;
  }
}

function validateForm(values: IncomingGearFormValues): string | null {
  if (!values.arrivalDate.trim()) return 'Arrival Date is required.';
  if (!values.cost.trim()) return 'Cost is required.';
  if (!values.status.trim()) return 'Status is required.';
  if (!values.make.trim()) return 'Make is required.';
  if (!values.model.trim()) return 'Model is required.';
  if (!values.componentType.trim()) return 'Component Type is required.';
  return null;
}

function FieldShell({ definition, children }: { definition: IncomingGearFormFieldDefinition; children: React.ReactNode }) {
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

function IntroBlock({ block }: { block: IncomingGearFormIntroBlock }) {
  if (block.type === 'lead') {
    return <p className="m-0 max-w-3xl text-[15px] font-medium leading-7 text-[var(--ink)]">{block.text}</p>;
  }

  if (block.type === 'sectionHeading') {
    return <p className="m-0 pb-3 pt-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{block.text}</p>;
  }

  if (block.type === 'labelBody') {
    const isProcessingBlock = block.label === 'PRE-PROCESSING' || block.label === 'ACTIVE-PROCESSING';

    if (isProcessingBlock) {
      return (
        <p className="m-0 max-w-3xl text-[14px] leading-7 text-[var(--muted)]">
          <span className="mr-1 text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--ink)]">{block.label}</span>
          <span>{block.body}</span>
        </p>
      );
    }

    return (
      <p className="m-0 max-w-3xl text-[14px] leading-7 text-[var(--muted)]">
        <span className="font-semibold text-[var(--ink)]">{block.label} </span>
        <span>{block.body}</span>
      </p>
    );
  }

  if (block.type === 'divider') {
    return (
      <div className="flex items-center gap-4 py-1">
        <div className="h-px flex-1 bg-[var(--line)]" />
        <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{block.text}</span>
        <div className="h-px flex-1 bg-[var(--line)]" />
      </div>
    );
  }

  return <p className="m-0 max-w-3xl text-[14px] leading-7 text-[var(--muted)]">{block.text}</p>;
}

export function AirtableEmbeddedForm() {
  const [formValues, setFormValues] = useState<IncomingGearFormValues>(() => createIncomingGearFormDefaults());
  const [optionSets, setOptionSets] = useState<IncomingGearOptionSets | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<{ recordId: string; sku: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const incomingGearFormUrl = getIncomingGearFormUrl();

  useEffect(() => {
    let cancelled = false;

    const loadOptions = async () => {
      setLoadingOptions(true);
      setOptionsError(null);
      try {
        const nextOptionSets = await loadIncomingGearFormOptionSets();
        if (!cancelled) {
          setOptionSets(nextOptionSets);
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Unable to load form options.';
          setOptionsError(message);
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
    if (!search) {
      return options.slice(0, 12);
    }
    return options.filter((option) => option.toLowerCase().includes(search)).slice(0, 12);
  }, [formValues.componentType, optionSets]);

  const setFieldValue = <K extends keyof IncomingGearFormValues>(fieldName: K, value: IncomingGearFormValues[K]) => {
    setFormValues((current) => ({
      ...current,
      [fieldName]: value,
    }));
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
      const result = await submitIncomingGearForm(formValues);
      setSubmitSuccess(result);
      setFormValues(createIncomingGearFormDefaults());
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to submit the Incoming Gear form.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (definition: IncomingGearFormFieldDefinition) => {
    const value = formValues[definition.name];

    if (definition.type === 'textarea') {
      return (
        <textarea
          className={FIELD_CLASS}
          rows={definition.rows ?? 4}
          value={value as string}
          placeholder={definition.placeholder}
          onChange={(event) => setFieldValue(definition.name, event.currentTarget.value as IncomingGearFormValues[typeof definition.name])}
        />
      );
    }

    if (definition.type === 'date') {
      let inputNode: HTMLInputElement | null = null;

      const openDatePicker = () => {
        if (!inputNode) return;

        inputNode.focus();
        if (typeof inputNode.showPicker === 'function') {
          inputNode.showPicker();
        }
      };

      return (
        <div className="flex gap-2">
          <input
            ref={(node) => {
              inputNode = node;
            }}
            className={`${FIELD_CLASS} mt-2 flex-1`}
            type="date"
            value={value as string}
            placeholder={definition.placeholder}
            onChange={(event) => setFieldValue(definition.name, event.currentTarget.value as IncomingGearFormValues[typeof definition.name])}
          />
          <button
            type="button"
            className={DATE_BUTTON_CLASS}
            onClick={openDatePicker}
            aria-label={`Open ${definition.label} date picker`}
            title={`Open ${definition.label} date picker`}
          >
            <CalendarIcon />
          </button>
        </div>
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
            onChange={(event) => {
              const nextFiles = Array.from(event.currentTarget.files ?? []);
              setFieldValue(definition.name, nextFiles as IncomingGearFormValues[typeof definition.name]);
            }}
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
          onChange={(event) => setFieldValue(definition.name, event.currentTarget.value as IncomingGearFormValues[typeof definition.name])}
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
      const datalistId = `incoming-gear-${definition.name}-options`;
      return (
        <>
          <input
            className={FIELD_CLASS}
            type="text"
            list={datalistId}
            value={value as string}
            placeholder="Search component types"
            onChange={(event) => setFieldValue(definition.name, event.currentTarget.value as IncomingGearFormValues[typeof definition.name])}
          />
          <datalist id={datalistId}>
            {options.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
          <p className={HELP_CLASS}>
            {filteredComponentTypeOptions.length > 0
              ? `Matching options: ${filteredComponentTypeOptions.join(', ')}`
              : 'No matching component types.'}
          </p>
        </>
      );
    }

    const inputType = definition.type === 'currency' ? 'number' : definition.type;

    return (
      <input
        className={FIELD_CLASS}
        type={inputType}
        step={definition.type === 'currency' ? '0.01' : undefined}
        value={value as string}
        placeholder={definition.placeholder}
        onChange={(event) => setFieldValue(definition.name, event.currentTarget.value as IncomingGearFormValues[typeof definition.name])}
      />
    );
  };

  if (loadingOptions) {
    return <LoadingSurface message="Loading Incoming Gear form configuration from Airtable..." />;
  }

  if (optionsError || !optionSets) {
    return <ErrorSurface title="Unable to load Incoming Gear Form" message={optionsError ?? 'The Airtable form configuration is unavailable.'} />;
  }

  return (
    <PanelSurface>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 px-5 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
          <p className="m-0 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{incomingGearFormIntro.eyebrow}</p>
          <h2 className="mt-2 text-3xl font-semibold text-[var(--ink)]">{incomingGearFormIntro.title}</h2>
          <div className="mt-4 space-y-3.5 pb-4">
            {incomingGearFormIntro.blocks.map((block, index) => (
              <IntroBlock key={`${block.type}-${index}`} block={block} />
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          {incomingGearFormUrl ? (
            <a
              className="inline-flex items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--bg)] px-4 py-2 text-sm font-semibold text-[var(--ink)] no-underline transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              href={incomingGearFormUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open Airtable version
            </a>
          ) : null}
        </div>

        {submitError ? (
          <div className="rounded-xl border border-[#f7c8c4] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-text)]">
            {submitError}
          </div>
        ) : null}

        {submitSuccess ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            Submission saved to Airtable. Record ID: <strong>{submitSuccess.recordId}</strong>. Temporary SKU: <strong>{submitSuccess.sku}</strong>.
          </div>
        ) : null}

        <form className="space-y-5 rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5" onSubmit={handleSubmit}>
          {incomingGearFormFields.map((field) => (
            <div key={field.airtableFieldName}>
              <FieldShell definition={field}>{renderField(field)}</FieldShell>
            </div>
          ))}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="m-0 text-sm text-[var(--muted)]">Required fields are marked with an asterisk. Images upload to the Airtable image attachment field.</p>
            <div className="flex gap-3">
              <button
                type="button"
                className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                onClick={() => {
                  setSubmitError(null);
                  setSubmitSuccess(null);
                  setFormValues(createIncomingGearFormDefaults());
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
                {submitting ? 'Submitting...' : 'Submit Incoming Gear'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </PanelSurface>
  );
}