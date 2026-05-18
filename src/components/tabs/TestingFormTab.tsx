import { useEffect, useState, type ReactNode } from 'react';
import { AppPageLayout } from '@/components/app/AppPageLayout';
import { AppSectionTitle } from '@/components/app/AppSectionTitle';
import { ErrorSurface, LoadingSurface } from '@/components/app/StateSurfaces';
import { ToolbarIconButton } from '@/components/app/ToolbarIconButton';
import { WorkflowPageHeader } from '@/components/app/WorkflowPageHeader';
import { useConfirmationDialog } from '@/hooks/useConfirmationDialog';
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
import type { WorkflowImageMetadataRecord } from '@/services/workflowImageMetadata';

const EMPTY_CUSTOMER_REFERENCE: TestingFormCustomerReference = {
  cosmeticNotes: '',
  functionalNotes: '',
  inclusionNotes: '',
  submittedPhotosNotes: '',
};

const EMPTY_STAGE_CONTEXT: TestingFormStageContext = {
  photographyCosmeticNotes: '',
  existingAttachments: [],
  imageMetadata: [],
};

type TestingOptionSets = Record<TestingFormOptionFieldName, string[]>;

const FIELD_CLASS = 'mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20';
const LABEL_CLASS = 'text-sm font-semibold text-[var(--ink)]';
const HELP_CLASS = 'mt-1 text-xs text-[var(--muted)]';
const DATE_BUTTON_CLASS = 'mt-2 inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20';

const READ_ONLY_TESTING_FIELD_NAMES: Array<keyof TestingFormValues> = [
  'sku',
  'make',
  'model',
  'componentType',
];

const EDITABLE_TESTING_FIELD_NAMES: Array<keyof TestingFormValues> = [
  'serialNumber',
  'voltage',
  'audiogonRating',
  'cosmeticConditionNotes',
  'originalBox',
  'manual',
  'remote',
  'powerCable',
  'additionalItems',
  'shippingWeight',
  'shippingDims',
  'imageFiles',
  'testingNotes',
  'testingTimeMinutes',
  'serviceNotes',
  'serviceTimeMinutes',
  'testingDate',
];

type TestingSubmitIntent = 'save' | 'complete';

function validateForm(values: TestingFormValues): string | null {
  if (!values.sku.trim()) return 'SKU is required.';
  if (!values.make.trim()) return 'Make is required.';
  if (!values.model.trim()) return 'Model is required.';
  if (!values.componentType.trim()) return 'Component Type is required.';
  if (!values.audiogonRating.trim()) return 'Audiogon Rating is required.';
  if (!values.testingNotes.trim()) return 'Testing Notes is required.';
  if (!values.testingTimeMinutes.trim()) return 'Testing Time is required.';
  if (!values.testingDate.trim()) return 'Testing Date is required.';
  return null;
}

function getFieldLayoutClass(definition: TestingFormFieldDefinition): string {
  if (definition.name === 'testingDate') {
    return 'lg:col-start-1';
  }

  if (definition.type === 'textarea' || definition.type === 'file') {
    return 'lg:col-span-2';
  }

  return '';
}

function FieldShell({ definition, children }: { definition: TestingFormFieldDefinition; children: ReactNode }) {
  return (
    <label className="block">
      <span className={LABEL_CLASS}>
        {definition.label}
        {definition.required ? <span className="text-red-400"> *</span> : null}
      </span>
      {definition.description ? <p className={HELP_CLASS}>{definition.description}</p> : null}
      {children}
    </label>
  );
}

function ReadOnlyFieldDisplay({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5">
      <p className="m-0 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-sm leading-5 text-[var(--ink)]">{value || 'Not provided'}</p>
      {description ? <p className="mt-1 text-[0.72rem] leading-5 text-[var(--muted)]">{description}</p> : null}
    </div>
  );
}

interface TestingFormTabProps {
  recordId?: string | null;
  onBackToDirectory?: () => void;
}

function BackIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path d="M15 10H5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m9 6-4 4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TestingFormTab({ recordId, onBackToDirectory }: TestingFormTabProps) {
  const [formValues, setFormValues] = useState<TestingFormValues>(() => createTestingFormDefaults());
  const [recordSource, setRecordSource] = useState<TestingFormRecordSource>('inventory-directory');
  const [customerReference, setCustomerReference] = useState<TestingFormCustomerReference>(EMPTY_CUSTOMER_REFERENCE);
  const [stageContext, setStageContext] = useState<TestingFormStageContext>(EMPTY_STAGE_CONTEXT);
  const [imageMetadata, setImageMetadata] = useState<WorkflowImageMetadataRecord[]>([]);
  const [optionSets, setOptionSets] = useState<TestingOptionSets | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<TestingFormSubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadEditorResetKey, setUploadEditorResetKey] = useState(0);
  const { requestConfirmation, confirmationModal } = useConfirmationDialog();

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
          setFormValues(nextFormValues.values);
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

  const submitTesting = async (submitIntent: TestingSubmitIntent) => {
    setSubmitError(null);
    setSubmitSuccess(null);

    const validationError = validateForm(formValues);
    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitTestingForm(formValues, recordId, {
        recordSource,
        imageMetadata,
        completeWorkflowStage: submitIntent === 'complete',
      });
      setSubmitSuccess(result);
      if (result.action === 'updated') {
        const nextValues = { ...formValues, imageFiles: [] };
        setFormValues(nextValues);
        setUploadEditorResetKey((current) => current + 1);
      } else {
        const nextValues = createTestingFormDefaults();
        setFormValues(nextValues);
        setImageMetadata([]);
        setUploadEditorResetKey((current) => current + 1);
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to submit the Testing form.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitTesting('save');
  };

  const renderField = (definition: TestingFormFieldDefinition) => {
    const value = formValues[definition.name];

    if (definition.type === 'textarea') {
      return (
        <textarea
          className={`${FIELD_CLASS} block`}
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
          required={definition.required}
          description={definition.description}
          disabled={submitting}
          resetKey={uploadEditorResetKey}
          onFilesChange={(files) => setFieldValue(definition.name, files as TestingFormValues[typeof definition.name])}
          afterUploadContent={stageImageMetadata.length > 0 ? (
            <WorkflowImageMetadataEditor
              metadata={stageImageMetadata}
              onChange={(nextMetadata) => setImageMetadata((current) => replaceWorkflowImageMetadataStage(current, 'testing', nextMetadata))}
              allowReorder
              disabled={submitting}
              title="Testing Images"
              description="Manage saved testing-stage image alt text, ordering, and listing defaults here."
              emptyMessage=""
              className="border-0 bg-transparent p-0"
            />
          ) : null}
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
  const readOnlyFields = testingFormFields.filter((field) => READ_ONLY_TESTING_FIELD_NAMES.includes(field.name));
  const editableFields = testingFormFields.filter((field) => EDITABLE_TESTING_FIELD_NAMES.includes(field.name));

  return (
    <AppPageLayout>
      <div className="flex flex-col gap-6">
        <WorkflowPageHeader
          eyebrow="Forms"
          title="Testing"
          actions={onBackToDirectory ? (
            <ToolbarIconButton label="Back to Directory" icon={<BackIcon />} onClick={onBackToDirectory} />
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

        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
          <AppSectionTitle title="Intake Snapshot" titleClassName="text-lg" />
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {readOnlyFields.map((field) => (
              <ReadOnlyFieldDisplay
                key={field.airtableFieldName}
                label={field.label}
                value={String(formValues[field.name] ?? '')}
                description={field.name === 'componentType' ? undefined : field.description}
              />
            ))}
            <ReadOnlyFieldDisplay label="Acquired From" value={formValues.acquiredFrom} />
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] p-4 text-sm text-[var(--muted)]">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Customer Cosmetic Notes</p>
              <p className="mt-2 leading-6 text-[var(--ink)]">{customerReference.cosmeticNotes || 'None provided'}</p>
            </div>

            <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] p-4 text-sm text-[var(--muted)]">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Inventory Notes</p>
              <p className="mt-2 leading-6 text-[var(--ink)]">{formValues.inventoryNotes || 'No inventory notes available.'}</p>
            </div>

            <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] p-4 text-sm text-[var(--muted)]">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Photography Cosmetic Notes</p>
              <p className="mt-2 leading-6 text-[var(--ink)]">{stageContext.photographyCosmeticNotes || 'No photography cosmetic notes available yet.'}</p>
            </div>
          </div>
        </div>

        <form className="space-y-5 rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5" onSubmit={handleSubmit}>
          <AppSectionTitle title="Testing Details" titleClassName="text-lg" />
          <div className="grid gap-5 lg:grid-cols-2">
            {editableFields.map((field) => (
              <div key={field.airtableFieldName} className={getFieldLayoutClass(field)}>
                {field.type === 'file'
                  ? renderField(field)
                  : <FieldShell definition={field}>{renderField(field)}</FieldShell>}
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <div className="flex gap-3">
              <button
                type="submit"
                className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={submitting}
              >
                {submitting ? (recordId ? 'Saving...' : 'Submitting...') : (recordId ? 'Save Testing' : 'Submit Testing')}
              </button>
              <button
                type="button"
                className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-5 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={async () => {
                  const confirmed = await requestConfirmation({
                    title: 'Mark testing as complete?',
                    message: 'This will mark the testing step complete for this record and move it to the next workflow state when the handoff requirements are satisfied.',
                    confirmLabel: 'Yes, complete testing',
                    cancelLabel: 'Cancel',
                    bullets: [
                      'Save Testing keeps the record in the testing step so the tester can come back later.',
                      'Testing Complete advances the workflow only when the record is ready for handoff.',
                    ],
                  });

                  if (!confirmed) {
                    return;
                  }

                  void submitTesting('complete');
                }}
                disabled={submitting}
              >
                Testing Complete
              </button>
            </div>
          </div>
        </form>
        {confirmationModal}
      </div>
    </AppPageLayout>
  );
}