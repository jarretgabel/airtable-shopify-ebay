import { useState, type ReactNode } from 'react';
import { ErrorSurface, LoadingSurface, PanelSurface } from '@/components/app/StateSurfaces';
import { WorkflowPageHeader } from '@/components/app/WorkflowPageHeader';
import { ComponentTypeSearchField } from '@/components/tabs/component-type-search-field';
import { DatePickerField } from '@/components/tabs/date-picker-field';
import { FormImageUploadEditor } from '@/components/tabs/FormImageUploadEditor';
import { WorkflowImageMetadataEditor } from '@/components/tabs/WorkflowImageMetadataEditor';
import { filterWorkflowImageMetadataByStage, replaceWorkflowImageMetadataStage } from '@/services/workflowImageMetadata';
import {
  createTestingFormDefaults,
  testingFormFields,
  type TestingFormFieldDefinition,
  type TestingFormValues,
  type TestingFormOptionFieldName,
} from '@/components/tabs/testing/testingFormSchema';
import {
  loadTestingFormOptionSets,
  loadTestingFormValues,
  submitTestingForm,
  type TestingFormCustomerReference,
  type TestingFormRecordSource,
  type TestingFormStageContext,
  type TestingFormSubmitResult,
} from '@/services/testingForm';
import { useEffect } from 'react';
import type { WorkflowImageMetadataRecord } from '@/services/workflowImageMetadata';

const EMPTY_CUSTOMER_REFERENCE: TestingFormCustomerReference = {
  cosmeticNotes: '',
  functionalNotes: '',
  inclusionNotes: '',
  submittedPhotosNotes: '',
};

const EMPTY_STAGE_CONTEXT: TestingFormStageContext = {
  existingAttachments: [],
  imageMetadata: [],
};

type TestingOptionSets = Record<TestingFormOptionFieldName, string[]>;

const FIELD_CLASS = 'mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20';
const LABEL_CLASS = 'text-sm font-semibold text-[var(--ink)]';
const HELP_CLASS = 'mt-1 text-xs text-[var(--muted)]';
const DATE_BUTTON_CLASS = 'mt-2 inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20';

function validateForm(values: TestingFormValues): string | null {
  if (!values.sku.trim()) return 'SKU is required.';
  if (!values.status.trim()) return 'Status is required.';
  if (!values.make.trim()) return 'Make is required.';
  if (!values.model.trim()) return 'Model is required.';
  if (!values.componentType.trim()) return 'Component Type is required.';
  return null;
}

function FieldShell({ definition, children }: { definition: TestingFormFieldDefinition; children: ReactNode }) {
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

interface TestingFormTabProps {
  recordId?: string | null;
  onBackToDirectory?: () => void;
}

export function TestingFormTab({ recordId, onBackToDirectory }: TestingFormTabProps) {
  const [formValues, setFormValues] = useState<TestingFormValues>(() => createTestingFormDefaults());
  const [initialFormValues, setInitialFormValues] = useState<TestingFormValues>(() => createTestingFormDefaults());
  const [recordSource, setRecordSource] = useState<TestingFormRecordSource>('inventory-directory');
  const [customerReference, setCustomerReference] = useState<TestingFormCustomerReference>(EMPTY_CUSTOMER_REFERENCE);
  const [stageContext, setStageContext] = useState<TestingFormStageContext>(EMPTY_STAGE_CONTEXT);
  const [imageMetadata, setImageMetadata] = useState<WorkflowImageMetadataRecord[]>([]);
  const [initialImageMetadata, setInitialImageMetadata] = useState<WorkflowImageMetadataRecord[]>([]);
  const [optionSets, setOptionSets] = useState<TestingOptionSets | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<TestingFormSubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadEditorResetKey, setUploadEditorResetKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadOptions = async () => {
      setLoadingOptions(true);
      setOptionsError(null);
      try {
        const [nextOptionSets, nextFormValues] = await Promise.all([
          loadTestingFormOptionSets(),
          recordId
            ? loadTestingFormValues(recordId)
            : Promise.resolve({
                source: 'inventory-directory' as const,
                values: createTestingFormDefaults(),
                customerReference: EMPTY_CUSTOMER_REFERENCE,
                stageContext: EMPTY_STAGE_CONTEXT,
              }),
        ]);
        if (!cancelled) {
          setOptionSets(nextOptionSets);
          setRecordSource(nextFormValues.source);
          setCustomerReference(nextFormValues.customerReference);
          setStageContext(nextFormValues.stageContext);
          setImageMetadata(nextFormValues.stageContext.imageMetadata);
          setInitialImageMetadata(nextFormValues.stageContext.imageMetadata);
          setFormValues(nextFormValues.values);
          setInitialFormValues(nextFormValues.values);
          setUploadEditorResetKey((current) => current + 1);
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

  const setFieldValue = <K extends keyof TestingFormValues>(fieldName: K, value: TestingFormValues[K]) => {
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
      const result = await submitTestingForm(formValues, recordId, { recordSource, imageMetadata });
      setSubmitSuccess(result);
      if (result.action === 'updated') {
        const nextValues = { ...formValues, imageFiles: [] };
        setFormValues(nextValues);
        setInitialFormValues(nextValues);
        setInitialImageMetadata(imageMetadata);
        setUploadEditorResetKey((current) => current + 1);
      } else {
        const nextValues = createTestingFormDefaults();
        setFormValues(nextValues);
        setInitialFormValues(nextValues);
        setImageMetadata([]);
        setInitialImageMetadata([]);
        setUploadEditorResetKey((current) => current + 1);
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to submit the Testing form.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (definition: TestingFormFieldDefinition) => {
    const value = formValues[definition.name];

    if (definition.type === 'textarea') {
      return (
        <textarea
          className={FIELD_CLASS}
          rows={definition.rows ?? 4}
          value={value as string}
          placeholder={definition.placeholder}
          onChange={(event) => setFieldValue(definition.name, event.currentTarget.value as TestingFormValues[typeof definition.name])}
        />
      );
    }

    if (definition.type === 'file') {
      return (
        <FormImageUploadEditor
          title={definition.label}
          description="Upload, crop, resize, watermark, rename, and compare files before they are attached to the operational record. Saved defaults persist locally for future testing sessions."
          disabled={submitting}
          resetKey={uploadEditorResetKey}
          onFilesChange={(files) => setFieldValue(definition.name, files as TestingFormValues[typeof definition.name])}
        />
      );
    }

    if (definition.type === 'select') {
      const options = definition.optionFieldName && optionSets ? optionSets[definition.optionFieldName] : [];
      return (
        <select
          className={FIELD_CLASS}
          value={value as string}
          onChange={(event) => setFieldValue(definition.name, event.currentTarget.value as TestingFormValues[typeof definition.name])}
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
      const datalistId = `testing-form-${definition.name}-options`;
      return (
        <ComponentTypeSearchField
          className={FIELD_CLASS}
          helpClassName={HELP_CLASS}
          listId={datalistId}
          options={options}
          value={value as string}
          onValueChange={(nextValue) => setFieldValue(definition.name, nextValue as TestingFormValues[typeof definition.name])}
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
          onValueChange={(nextValue) => setFieldValue(definition.name, nextValue as TestingFormValues[typeof definition.name])}
        />
      );
    }

    const inputType = definition.type === 'currency' ? 'number' : definition.type;
    return (
      <input
        className={FIELD_CLASS}
        type={inputType}
        step={definition.type === 'currency' ? '0.01' : definition.type === 'number' ? '1' : undefined}
        value={value as string}
        placeholder={definition.placeholder}
        onChange={(event) => setFieldValue(definition.name, event.currentTarget.value as TestingFormValues[typeof definition.name])}
      />
    );
  };

  if (loadingOptions) {
    return <LoadingSurface message="Loading Testing form configuration from Airtable..." />;
  }

  if (optionsError || !optionSets) {
    return <ErrorSurface title="Unable to load Testing form" message={optionsError ?? 'The Airtable Testing form configuration is unavailable.'} />;
  }

  const hasCustomerReference = Object.values(customerReference).some((value) => value.trim().length > 0);
  const stageImageMetadata = filterWorkflowImageMetadataByStage(imageMetadata, 'testing');

  return (
    <PanelSurface>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <WorkflowPageHeader
          eyebrow="SB Inventory"
          title="Testing"
          description="Confirm testing details and service notes before the item moves forward."
          descriptionHint="In addition to general testing and service, please double check all previously entered details to ensure accuracy of information."
          detail={recordId ? <>Editing record <strong>{recordId}</strong>. Saving here updates only the Testing fields for this inventory row.</> : undefined}
          actions={onBackToDirectory ? (
            <button
              type="button"
              className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              onClick={onBackToDirectory}
            >
              Back to Directory
            </button>
          ) : undefined}
        />

        {submitError ? (
          <div className="rounded-xl border border-[#f7c8c4] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-text)]">
            {submitError}
          </div>
        ) : null}

        {submitSuccess ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {submitSuccess.action === 'updated'
              ? <>Testing fields updated for record <strong>{submitSuccess.recordId}</strong>. SKU: <strong>{submitSuccess.sku}</strong>.</>
              : <>Testing submission saved to Airtable. Record ID: <strong>{submitSuccess.recordId}</strong>. SKU: <strong>{submitSuccess.sku}</strong>.</>}
          </div>
        ) : null}

        {hasCustomerReference ? (
          <div className="rounded-2xl border border-sky-400/25 bg-sky-500/10 p-5">
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-sky-100">Customer Intake Reference</p>
            <p className="mt-2 text-sm leading-6 text-sky-50/90">
              Use these customer-submitted notes as reference only. Keep testing findings and staff assessments in the Testing fields below.
            </p>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-sky-300/20 bg-slate-950/20 p-3 text-sm text-sky-50/90">
                <span className="font-semibold text-sky-50">Customer Cosmetic Notes:</span> {customerReference.cosmeticNotes || 'None provided'}
              </div>
              <div className="rounded-xl border border-sky-300/20 bg-slate-950/20 p-3 text-sm text-sky-50/90">
                <span className="font-semibold text-sky-50">Customer Functional Notes:</span> {customerReference.functionalNotes || 'None provided'}
              </div>
              <div className="rounded-xl border border-sky-300/20 bg-slate-950/20 p-3 text-sm text-sky-50/90">
                <span className="font-semibold text-sky-50">Customer Inclusion Notes:</span> {customerReference.inclusionNotes || 'None provided'}
              </div>
              <div className="rounded-xl border border-sky-300/20 bg-slate-950/20 p-3 text-sm text-sky-50/90">
                <span className="font-semibold text-sky-50">Customer Submitted Photos Notes:</span> {customerReference.submittedPhotosNotes || 'None provided'}
              </div>
            </div>
          </div>
        ) : null}

        <WorkflowImageMetadataEditor
          metadata={stageImageMetadata}
          onChange={(nextMetadata) => setImageMetadata((current) => replaceWorkflowImageMetadataStage(current, 'testing', nextMetadata))}
          disabled={submitting}
          title="Testing Images"
          description="Testing edits only testing-stage images here. Photography images stay separate on the photo form, while workflow and listing views still combine both stages."
          emptyMessage={stageContext.existingAttachments.length > 0
            ? 'Testing images were found, but no editable testing metadata could be derived yet.'
            : 'No testing images are attached yet. Upload and save testing images to begin drafting metadata.'}
          className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70"
        />

        <form className="space-y-5 rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5" onSubmit={handleSubmit}>
          {testingFormFields.map((field) => (
            <div key={field.airtableFieldName}>
              {field.type === 'file'
                ? renderField(field)
                : <FieldShell definition={field}>{renderField(field)}</FieldShell>}
            </div>
          ))}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="m-0 text-sm text-[var(--muted)]">Required fields are marked with an asterisk. Testing Time is submitted to Airtable as minutes converted to duration seconds.</p>
            <div className="flex gap-3">
              <button
                type="button"
                className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                onClick={() => {
                  setSubmitError(null);
                  setSubmitSuccess(null);
                  setFormValues(initialFormValues);
                  setImageMetadata(initialImageMetadata);
                  setUploadEditorResetKey((current) => current + 1);
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
                {submitting ? (recordId ? 'Saving...' : 'Submitting...') : (recordId ? 'Save Testing' : 'Submit Testing')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </PanelSurface>
  );
}