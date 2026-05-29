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
  type ManualIntakeFormLoadResult,
  type ManualIntakeFormSubmitResult,
  type ManualIntakeRecordSource,
} from '@/services/manualIntakeForm';
import { buildJotFormSubmissionUrl } from '@/services/jotform';

type ManualIntakeOptionSets = Record<ManualIntakeFormOptionFieldName, string[]>;

const FIELD_CLASS = 'mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20';
const LABEL_CLASS = 'text-sm font-semibold text-[var(--ink)]';
const HELP_CLASS = 'mt-1 text-xs text-[var(--muted)]';
const DATE_BUTTON_CLASS = 'mt-2 inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20';

function validateForm(values: ManualIntakeFormValues): string | null {
  if (!values.cost.trim()) return 'Cost is required.';
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

type FieldGroup = ManualIntakeFormFieldDefinition | [ManualIntakeFormFieldDefinition, ManualIntakeFormFieldDefinition];

function groupFields(fields: ManualIntakeFormFieldDefinition[]): FieldGroup[] {
  const groups: FieldGroup[] = [];
  let i = 0;
  while (i < fields.length) {
    const curr = fields[i];
    const next = fields[i + 1];
    if (curr.halfWidth && next?.halfWidth) {
      groups.push([curr, next]);
      i += 2;
    } else {
      groups.push(curr);
      i++;
    }
  }
  return groups;
}

interface AirtableEmbeddedFormProps {
  recordId?: string | null;
  onLoadResult?: (result: ManualIntakeFormLoadResult) => void;
}

export function AirtableEmbeddedForm({
  recordId,
  onLoadResult,
}: AirtableEmbeddedFormProps) {
  const [formValues, setFormValues] = useState<ManualIntakeFormValues>(() => createManualIntakeFormDefaults());
  const [initialFormValues, setInitialFormValues] = useState<ManualIntakeFormValues>(() => createManualIntakeFormDefaults());
  const [recordSource, setRecordSource] = useState<ManualIntakeRecordSource>('used-gear-workflow');
  const [workflowSource, setWorkflowSource] = useState('');
  const [jotFormSubmissionId, setJotFormSubmissionId] = useState('');
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
            : Promise.resolve({
              source: 'used-gear-workflow' as ManualIntakeRecordSource,
              itemTitle: '',
              workflowSource: '',
              jotFormSubmissionId: '',
              values: createManualIntakeFormDefaults(),
            }),
        ]);
        if (!cancelled) {
          setOptionSets(nextOptionSets);
          setRecordSource(nextFormValues.source);
          setWorkflowSource(nextFormValues.workflowSource ?? '');
          setJotFormSubmissionId(nextFormValues.jotFormSubmissionId ?? '');
          setFormValues(nextFormValues.values);
          setInitialFormValues(nextFormValues.values);
          onLoadResult?.(nextFormValues);
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
  }, [onLoadResult, recordId]);

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
      const result = await submitManualIntakeForm(formValues, recordId, { recordSource });
      if (result.action === 'updated') {
        const nextValues = { ...formValues, imageFiles: [] };
        setFormValues(nextValues);
        setInitialFormValues(nextValues);
        setSubmitSuccess(result);
        return;
      } else {
        const nextValues = createManualIntakeFormDefaults();
        setFormValues(nextValues);
        setInitialFormValues(nextValues);
        setSubmitSuccess(result);
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to submit the Manual Intake form.');
    } finally {
      setSubmitting(false);
    }
  }

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

  const jotFormSubmissionUrl = buildJotFormSubmissionUrl(jotFormSubmissionId);

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
            ? <>Manual Intake fields updated for record <strong>{submitSuccess.recordId}</strong>.</>
            : <>Submission saved to Airtable. Record ID: <strong>{submitSuccess.recordId}</strong>.</>}
        </div>
      ) : null}

      <form className="space-y-5 rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5" onSubmit={handleSubmit}>
          {recordId && recordSource === 'used-gear-workflow' && workflowSource ? (
            <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Workflow Source</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--ink)]">
                  <span className="inline-flex rounded-full border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
                    {workflowSource}
                  </span>
                  {jotFormSubmissionId ? (
                    <span className="text-[var(--muted)]">Submission ID: <span className="font-medium text-[var(--ink)]">{jotFormSubmissionId}</span></span>
                  ) : null}
                </div>
                {workflowSource === 'JotForm' && jotFormSubmissionUrl ? (
                  <a
                    className="inline-flex items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    href={jotFormSubmissionUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in JotForm
                  </a>
                ) : null}
              </div>
            </section>
          ) : null}

          {groupFields(manualIntakeFormFields).map((group) => {
            if (Array.isArray(group)) {
              return (
                <div key={`${group[0].name}-${group[1].name}`} className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  {group.map((field) => (
                    <FieldShell key={field.name} definition={field}>{renderField(field)}</FieldShell>
                  ))}
                </div>
              );
            }
            return (
              <div key={group.name}>
                <FieldShell definition={group}>{renderField(group)}</FieldShell>
              </div>
            );
          })}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                onClick={() => {
                  setSubmitError(null);
                  setSubmitSuccess(null);
                  setFormValues(initialFormValues);
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
                {submitting ? (recordId ? 'Saving...' : 'Creating...') : (recordId ? 'Save Intake' : 'Create Manual Entry')}
              </button>
            </div>
          </div>
        </form>
    </div>
  );
}