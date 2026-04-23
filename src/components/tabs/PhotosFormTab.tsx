import { useEffect, useState, type ReactNode } from 'react';
import { ErrorSurface, LoadingSurface, PanelSurface } from '@/components/app/StateSurfaces';
import { ComponentTypeSearchField } from '@/components/tabs/component-type-search-field';
import { DatePickerField } from '@/components/tabs/date-picker-field';
import {
  createPhotosFormDefaults,
  photosFormFields,
  type PhotosFormFieldDefinition,
  type PhotosFormOptionFieldName,
  type PhotosFormValues,
} from '@/components/tabs/photos/photosFormSchema';
import { loadPhotosFormOptionSets, loadPhotosFormValues, submitPhotosForm, type PhotosFormSubmitResult } from '@/services/photosForm';

type PhotosOptionSets = Record<PhotosFormOptionFieldName, string[]>;

const FIELD_CLASS = 'mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20';
const LABEL_CLASS = 'text-sm font-semibold text-[var(--ink)]';
const HELP_CLASS = 'mt-1 text-xs text-[var(--muted)]';
const DATE_BUTTON_CLASS = 'mt-2 inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20';

function validateForm(values: PhotosFormValues): string | null {
  if (!values.sku.trim()) return 'SKU is required.';
  if (!values.make.trim()) return 'Make is required.';
  if (!values.model.trim()) return 'Model is required.';
  if (!values.componentType.trim()) return 'Component Type is required.';
  if (!values.photoDate.trim()) return 'Photo Date is required.';
  if (!values.status.trim()) return 'Status is required.';
  if (values.imageFiles.length === 0) {
    return 'Upload at least one image before submitting the Photos form.';
  }
  return null;
}

function FieldShell({ definition, children }: { definition: PhotosFormFieldDefinition; children: ReactNode }) {
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

interface PhotosFormTabProps {
  recordId?: string | null;
  onBackToDirectory?: () => void;
}

export function PhotosFormTab({ recordId, onBackToDirectory }: PhotosFormTabProps) {
  const [formValues, setFormValues] = useState<PhotosFormValues>(() => createPhotosFormDefaults());
  const [initialFormValues, setInitialFormValues] = useState<PhotosFormValues>(() => createPhotosFormDefaults());
  const [optionSets, setOptionSets] = useState<PhotosOptionSets | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<PhotosFormSubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadOptions = async () => {
      setLoadingOptions(true);
      setOptionsError(null);
      try {
        const [nextOptionSets, nextFormValues] = await Promise.all([
          loadPhotosFormOptionSets(),
          recordId ? loadPhotosFormValues(recordId) : Promise.resolve(createPhotosFormDefaults()),
        ]);
        if (!cancelled) {
          setOptionSets(nextOptionSets);
          setFormValues(nextFormValues);
          setInitialFormValues(nextFormValues);
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
  }, [recordId]);

  const setFieldValue = <K extends keyof PhotosFormValues>(fieldName: K, value: PhotosFormValues[K]) => {
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
      const result = await submitPhotosForm(formValues, recordId);
      setSubmitSuccess(result);
      if (result.action === 'updated') {
        const nextValues = { ...formValues, imageFiles: [] };
        setFormValues(nextValues);
        setInitialFormValues(nextValues);
      } else {
        const nextValues = createPhotosFormDefaults();
        setFormValues(nextValues);
        setInitialFormValues(nextValues);
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to submit the Photos form.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (definition: PhotosFormFieldDefinition) => {
    const value = formValues[definition.name];

    if (definition.type === 'textarea') {
      return (
        <textarea
          className={FIELD_CLASS}
          rows={definition.rows ?? 4}
          value={value as string}
          placeholder={definition.placeholder}
          onChange={(event) => setFieldValue(definition.name, event.currentTarget.value as PhotosFormValues[typeof definition.name])}
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
            onChange={(event) => setFieldValue(definition.name, Array.from(event.currentTarget.files ?? []) as PhotosFormValues[typeof definition.name])}
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
          onChange={(event) => setFieldValue(definition.name, event.currentTarget.value as PhotosFormValues[typeof definition.name])}
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
      const datalistId = `photos-form-${definition.name}-options`;
      return (
        <ComponentTypeSearchField
          className={FIELD_CLASS}
          helpClassName={HELP_CLASS}
          listId={datalistId}
          options={options}
          value={value as string}
          onValueChange={(nextValue) => setFieldValue(definition.name, nextValue as PhotosFormValues[typeof definition.name])}
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
          onValueChange={(nextValue) => setFieldValue(definition.name, nextValue as PhotosFormValues[typeof definition.name])}
        />
      );
    }

    return (
      <input
        className={FIELD_CLASS}
        type={definition.type}
        value={value as string}
        placeholder={definition.placeholder}
        onChange={(event) => setFieldValue(definition.name, event.currentTarget.value as PhotosFormValues[typeof definition.name])}
      />
    );
  };

  if (loadingOptions) {
    return <LoadingSurface message="Loading Photos form configuration from Airtable..." />;
  }

  if (optionsError || !optionSets) {
    return <ErrorSurface title="Unable to load Photos form" message={optionsError ?? 'The Airtable Photos form configuration is unavailable.'} />;
  }

  return (
    <PanelSurface>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 px-5 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="m-0 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">SB Inventory</p>
              <h2 className="mt-2 text-3xl font-semibold text-[var(--ink)]">Photos</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Use this form after testing is complete to upload the primary listing photos, capture Audiogon rating and cosmetic notes, and mark the unit as photo&apos;d for listing prep.</p>
              {recordId ? <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Editing record <strong>{recordId}</strong>. Saving here updates only the Photos fields for this inventory row.</p> : null}
            </div>
            {onBackToDirectory ? (
              <button
                type="button"
                className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                onClick={onBackToDirectory}
              >
                Back to Directory
              </button>
            ) : null}
          </div>
        </div>

        {submitError ? (
          <div className="rounded-xl border border-[#f7c8c4] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-text)]">
            {submitError}
          </div>
        ) : null}

        {submitSuccess ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {submitSuccess.action === 'updated'
              ? <>Photos fields updated for record <strong>{submitSuccess.recordId}</strong>. SKU: <strong>{submitSuccess.sku}</strong>.</>
              : <>Photos submission saved to Airtable. Record ID: <strong>{submitSuccess.recordId}</strong>. SKU: <strong>{submitSuccess.sku}</strong>.</>}
          </div>
        ) : null}

        <form className="space-y-5 rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5" onSubmit={handleSubmit}>
          {photosFormFields.map((field) => (
            <div key={field.airtableFieldName}>
              <FieldShell definition={field}>{renderField(field)}</FieldShell>
            </div>
          ))}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="m-0 text-sm text-[var(--muted)]">Required fields are marked with an asterisk. Upload at least one image before submitting.</p>
            <div className="flex gap-3">
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
                {submitting ? (recordId ? 'Saving...' : 'Submitting...') : (recordId ? 'Save Photos' : 'Submit Photos')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </PanelSurface>
  );
}