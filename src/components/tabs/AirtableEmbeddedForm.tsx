import { useEffect, useState } from 'react';
import { ErrorSurface, LoadingSurface } from '@/components/app/StateSurfaces';
import { ComponentTypeSearchField } from '@/components/tabs/component-type-search-field';
import { DatePickerField } from '@/components/tabs/date-picker-field';
import {
  createManualIntakeFormDefaults,
  manualIntakeFormFields,
  type ManualIntakeFormFieldDefinition,
  type ManualIntakeFormOptionFieldName,
  type ManualIntakeFormValues,
} from '@/components/tabs/manual-intake/manualIntakeFormSchema';
import {
  loadManualIntakeFormOptionSets,
  loadManualIntakeFormValues,
  submitManualIntakeForm,
  type ManualIntakeRoute,
  type ManualIntakeFormSubmitResult,
  type ManualIntakeRecordSource,
} from '@/services/manualIntakeForm';

type ManualIntakeOptionSets = Record<ManualIntakeFormOptionFieldName, string[]>;

const FIELD_CLASS = 'mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20';
const LABEL_CLASS = 'text-sm font-semibold text-[var(--ink)]';
const HELP_CLASS = 'mt-1 text-xs text-[var(--muted)]';
const DATE_BUTTON_CLASS = 'mt-2 inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20';

function validateForm(values: ManualIntakeFormValues): string | null {
  if (!values.arrivalDate.trim()) return 'Arrival Date is required.';
  if (!values.cost.trim()) return 'Cost is required.';
  if (!values.status.trim()) return 'Status is required.';
  if (!values.make.trim()) return 'Make is required.';
  if (!values.model.trim()) return 'Model is required.';
  if (!values.componentType.trim()) return 'Component Type is required.';
  return null;
}

function FieldShell({ definition, children }: { definition: ManualIntakeFormFieldDefinition; children: React.ReactNode }) {
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

interface AirtableEmbeddedFormProps {
  recordId?: string | null;
}

const MANUAL_ENTRY_ROUTE_OPTIONS: Array<{ value: ManualIntakeRoute; label: string; description: string }> = [
  {
    value: 'lot-1',
    label: 'Route to Parking Lot 1',
    description: 'Create the row as pending review so purchasing can qualify it in-app.',
  },
  {
    value: 'lot-2-awaiting-arrival',
    label: 'Route to Lot 2: Awaiting Arrival',
    description: 'Use when the manual deal is accepted but the item has not physically arrived yet.',
  },
  {
    value: 'lot-2-awaiting-sku',
    label: 'Route to Lot 2: Arrived, Awaiting SKU',
    description: 'Use when the item has already arrived and still needs SKU assignment.',
  },
  {
    value: 'lot-2-awaiting-missing-item',
    label: 'Route to Lot 2: Arrived, Awaiting Missing Item',
    description: 'Use when intake is accepted but follow-up is still required for a missing unit or missing pieces.',
  },
];

export function AirtableEmbeddedForm({ recordId }: AirtableEmbeddedFormProps) {
  const [formValues, setFormValues] = useState<ManualIntakeFormValues>(() => createManualIntakeFormDefaults());
  const [initialFormValues, setInitialFormValues] = useState<ManualIntakeFormValues>(() => createManualIntakeFormDefaults());
  const [recordSource, setRecordSource] = useState<ManualIntakeRecordSource>('used-gear-workflow');
  const [manualEntryRoute, setManualEntryRoute] = useState<ManualIntakeRoute>('lot-1');
  const [submissionGroupId, setSubmissionGroupId] = useState('');
  const [pickUpId, setPickUpId] = useState('');
  const [qualificationNotes, setQualificationNotes] = useState('');
  const [optionSets, setOptionSets] = useState<ManualIntakeOptionSets | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<ManualIntakeFormSubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadOptions = async () => {
      setLoadingOptions(true);
      setOptionsError(null);
      try {
        const [nextOptionSets, nextFormValues] = await Promise.all([
          loadManualIntakeFormOptionSets(),
          recordId
            ? loadManualIntakeFormValues(recordId)
            : Promise.resolve({ source: 'used-gear-workflow' as ManualIntakeRecordSource, values: createManualIntakeFormDefaults() }),
        ]);
        if (!cancelled) {
          setOptionSets(nextOptionSets);
          setRecordSource(nextFormValues.source);
          setFormValues(nextFormValues.values);
          setInitialFormValues(nextFormValues.values);
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
  }, [recordId]);

  const setFieldValue = <K extends keyof ManualIntakeFormValues>(fieldName: K, value: ManualIntakeFormValues[K]) => {
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
      const result = await submitManualIntakeForm(formValues, recordId, {
        recordSource,
        manualEntryRoute,
        submissionGroupId,
        pickUpId,
        qualificationNotes,
      });
      setSubmitSuccess(result);
      if (result.action === 'updated') {
        const nextValues = { ...formValues, imageFiles: [] };
        setFormValues(nextValues);
        setInitialFormValues(nextValues);
      } else {
        const nextValues = createManualIntakeFormDefaults();
        setFormValues(nextValues);
        setInitialFormValues(nextValues);
        setManualEntryRoute('lot-1');
        setSubmissionGroupId('');
        setPickUpId('');
        setQualificationNotes('');
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to submit the Manual Intake form.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (definition: ManualIntakeFormFieldDefinition) => {
    const value = formValues[definition.name];

    if (definition.type === 'textarea') {
      return (
        <textarea
          className={FIELD_CLASS}
          rows={definition.rows ?? 4}
          value={value as string}
          placeholder={definition.placeholder}
          onChange={(event) => setFieldValue(definition.name, event.currentTarget.value as ManualIntakeFormValues[typeof definition.name])}
        />
      );
    }

    if (definition.type === 'date') {
      return (
        <DatePickerField
          containerClassName="flex gap-2"
          inputClassName={`${FIELD_CLASS} mt-2 flex-1`}
          buttonClassName={DATE_BUTTON_CLASS}
          value={value as string}
          pickerLabel={definition.label}
          placeholder={definition.placeholder}
          onValueChange={(nextValue) => setFieldValue(definition.name, nextValue as ManualIntakeFormValues[typeof definition.name])}
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
            onChange={(event) => {
              const nextFiles = Array.from(event.currentTarget.files ?? []);
              setFieldValue(definition.name, nextFiles as ManualIntakeFormValues[typeof definition.name]);
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
          onChange={(event) => setFieldValue(definition.name, event.currentTarget.value as ManualIntakeFormValues[typeof definition.name])}
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
      const datalistId = `manual-intake-${definition.name}-options`;
      return (
        <ComponentTypeSearchField
          className={FIELD_CLASS}
          helpClassName={HELP_CLASS}
          listId={datalistId}
          options={options}
          value={value as string}
          onValueChange={(nextValue) => setFieldValue(definition.name, nextValue as ManualIntakeFormValues[typeof definition.name])}
        />
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
        onChange={(event) => setFieldValue(definition.name, event.currentTarget.value as ManualIntakeFormValues[typeof definition.name])}
      />
    );
  };

  if (loadingOptions) {
    return <LoadingSurface message="Loading Manual Intake form configuration from Airtable..." />;
  }

  if (optionsError || !optionSets) {
    return <ErrorSurface title="Unable to load Manual Intake" message={optionsError ?? 'The Airtable form configuration is unavailable.'} />;
  }

  return (
    <div className="flex w-full flex-col gap-5">
      {submitError ? (
        <div className="rounded-xl border border-[#f7c8c4] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-text)]">
          {submitError}
        </div>
      ) : null}

      {submitSuccess ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {submitSuccess.action === 'updated'
            ? <>Manual Intake fields updated for record <strong>{submitSuccess.recordId}</strong>. SKU: <strong>{submitSuccess.sku || 'N/A'}</strong>.</>
            : <>Submission saved to Airtable. Record ID: <strong>{submitSuccess.recordId}</strong>. Temporary SKU: <strong>{submitSuccess.sku}</strong>.</>}
        </div>
      ) : null}

      <form className="space-y-5 rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5" onSubmit={handleSubmit}>
          {!recordId ? (
            <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Routing Context</p>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <label className="block">
                  <span className={LABEL_CLASS}>Entry Route</span>
                  <select
                    className={FIELD_CLASS}
                    value={manualEntryRoute}
                    onChange={(event) => setManualEntryRoute(event.currentTarget.value as ManualIntakeRoute)}
                  >
                    {MANUAL_ENTRY_ROUTE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <p className={HELP_CLASS}>{MANUAL_ENTRY_ROUTE_OPTIONS.find((option) => option.value === manualEntryRoute)?.description}</p>
                </label>
                <label className="block">
                  <span className={LABEL_CLASS}>Submission Group ID</span>
                  <input
                    className={FIELD_CLASS}
                    type="text"
                    value={submissionGroupId}
                    placeholder="Optional shared deal/group key"
                    onChange={(event) => setSubmissionGroupId(event.currentTarget.value)}
                  />
                  <p className={HELP_CLASS}>Optional. Use when multiple manual rows belong to the same deal and should stay grouped through intake review.</p>
                </label>
                <label className="block">
                  <span className={LABEL_CLASS}>Pick Up ID</span>
                  <input
                    className={FIELD_CLASS}
                    type="text"
                    value={pickUpId}
                    placeholder="Optional pickup/arrival batch key"
                    onChange={(event) => setPickUpId(event.currentTarget.value)}
                  />
                  <p className={HELP_CLASS}>Optional. Use when this intake should stay tied to an existing pickup or arrival batch tracked elsewhere.</p>
                </label>
                <label className="block lg:col-span-2">
                  <span className={LABEL_CLASS}>Qualification Notes</span>
                  <textarea
                    className={FIELD_CLASS}
                    rows={3}
                    value={qualificationNotes}
                    placeholder="Optional routing or qualification notes for the operational record"
                    onChange={(event) => setQualificationNotes(event.currentTarget.value)}
                  />
                  <p className={HELP_CLASS}>Required when routing a manual-entry row directly into Parking Lot 2.</p>
                </label>
              </div>
            </section>
          ) : null}

          {manualIntakeFormFields.map((field) => (
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
                  setFormValues(initialFormValues);
                  if (!recordId) {
                    setManualEntryRoute('lot-1');
                    setSubmissionGroupId('');
                    setPickUpId('');
                    setQualificationNotes('');
                  }
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
                {submitting ? (recordId ? 'Saving...' : 'Creating...') : (recordId ? 'Save Manual Intake' : 'Create Manual Entry')}
              </button>
            </div>
          </div>
        </form>
    </div>
  );
}