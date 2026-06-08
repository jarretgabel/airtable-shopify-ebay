import { useEffect, useState, type ReactNode } from 'react';
import { AppPageLayout } from '@/components/app/AppPageLayout';
import { AppSectionTitle } from '@/components/app/AppSectionTitle';
import { BackToolbarButton } from '@/components/app/BackToolbarButton';
import { ErrorSurface, LoadingSurface } from '@/components/app/StateSurfaces';
import { WorkflowPageHeader } from '@/components/app/WorkflowPageHeader';
import { WorkflowFormSnapshotSection } from '@/components/tabs/WorkflowFormSnapshotSection';
import { useConfirmationDialog } from '@/hooks/useConfirmationDialog';
import { ComponentTypeSearchField } from '@/components/tabs/component-type-search-field';
import { DatePickerField } from '@/components/tabs/date-picker-field';
import { FormImageUploadEditor } from '@/components/tabs/FormImageUploadEditor';
import { WorkflowReferenceImagesPanel } from '@/components/tabs/WorkflowReferenceImagesPanel';
import { WorkflowImageMetadataEditor } from '@/components/tabs/WorkflowImageMetadataEditor';
import type { FormImageProcessingSummary } from '@/components/tabs/FormImageUploadEditor';
import type { FormImageUploadAsset } from '@/services/formImageUploads';
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
  type TestingFormImageUploadProgress,
  type TestingFormRecordSource,
  type TestingFormStageContext,
  type TestingFormSubmitResult,
} from '@/services/testingForm';
import type { WorkflowImageMetadataRecord } from '@/services/workflowImageMetadata';

const EMPTY_CUSTOMER_REFERENCE: TestingFormCustomerReference = {
  cosmeticNotes: '',
  functionalNotes: '',
  inclusionNotes: '',
};

const EMPTY_STAGE_CONTEXT: TestingFormStageContext = {
  existingAttachments: [],
  referenceAttachments: [],
  imageMetadata: [],
};

const EMPTY_IMAGE_PROCESSING_SUMMARY: FormImageProcessingSummary = {
  total: 0,
  processed: 0,
  processing: 0,
  failed: 0,
};

type TestingOptionSets = Record<TestingFormOptionFieldName, string[]>;

const FIELD_CLASS = 'mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20';
const LABEL_CLASS = 'text-sm font-semibold text-[var(--ink)]';
const HELP_CLASS = 'mt-1 text-xs text-[var(--muted)]';
const DATE_BUTTON_CLASS = 'mt-2 inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20';

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

interface TestingFormTabProps {
  recordId?: string | null;
  onBackToDirectory?: () => void;
  eyebrow?: string;
}

export function TestingFormTab({ recordId, onBackToDirectory, eyebrow = 'Forms' }: TestingFormTabProps) {
  const [formValues, setFormValues] = useState<TestingFormValues>(() => createTestingFormDefaults());
  const [itemTitle, setItemTitle] = useState('');
  const [recordSource, setRecordSource] = useState<TestingFormRecordSource>('inventory-directory');
  const [customerReference, setCustomerReference] = useState<TestingFormCustomerReference>(EMPTY_CUSTOMER_REFERENCE);
  const [stageContext, setStageContext] = useState<TestingFormStageContext>(EMPTY_STAGE_CONTEXT);
  const [imageMetadata, setImageMetadata] = useState<WorkflowImageMetadataRecord[]>([]);
  const [imageUploadAssets, setImageUploadAssets] = useState<FormImageUploadAsset[]>([]);
  const [optionSets, setOptionSets] = useState<TestingOptionSets | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<TestingFormSubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [imagesProcessing, setImagesProcessing] = useState(false);
  const [imageProcessingSummary, setImageProcessingSummary] = useState<FormImageProcessingSummary>(EMPTY_IMAGE_PROCESSING_SUMMARY);
  const [imageUploadProgress, setImageUploadProgress] = useState<TestingFormImageUploadProgress | null>(null);
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
                itemTitle: '',
                values: createTestingFormDefaults(),
                customerReference: EMPTY_CUSTOMER_REFERENCE,
                stageContext: EMPTY_STAGE_CONTEXT,
              }),
        ]);
        if (!cancelled) {
          setOptionSets(nextOptionSets);
          setItemTitle(nextFormValues.itemTitle);
          setRecordSource(nextFormValues.source);
          setCustomerReference(nextFormValues.customerReference);
          setStageContext(nextFormValues.stageContext);
          setImageMetadata(nextFormValues.stageContext.imageMetadata);
          setImageUploadAssets([]);
          setImageProcessingSummary(EMPTY_IMAGE_PROCESSING_SUMMARY);
          setImageUploadProgress(null);
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

    if (imagesProcessing) {
      setSubmitError('Wait for image processing to finish before saving Testing.');
      return;
    }

    setSubmitting(true);
    setImageUploadProgress(null);
    try {
      const result = await submitTestingForm(formValues, recordId, {
        recordSource,
        imageMetadata,
        imageUploadAssets,
        completeWorkflowStage: submitIntent === 'complete',
        onImageUploadProgress: setImageUploadProgress,
      });
      setSubmitSuccess(result);
      if (result.action === 'updated') {
        const nextValues = { ...formValues, imageFiles: [] };
        setFormValues(nextValues);
        setImageUploadAssets([]);
        setUploadEditorResetKey((current) => current + 1);
      } else {
        const nextValues = createTestingFormDefaults();
        setFormValues(nextValues);
        setImageMetadata([]);
        setImageUploadAssets([]);
        setUploadEditorResetKey((current) => current + 1);
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to submit the Testing form.');
    } finally {
      setSubmitting(false);
      setImageUploadProgress(null);
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
          onUploadAssetsChange={setImageUploadAssets}
          onProcessingStateChange={setImagesProcessing}
          onProcessingSummaryChange={setImageProcessingSummary}
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

  const stageImageMetadata = filterWorkflowImageMetadataByStage(imageMetadata, 'testing');
  const editableFields = testingFormFields.filter((field) => EDITABLE_TESTING_FIELD_NAMES.includes(field.name));

  return (
    <AppPageLayout>
      <div className="flex flex-col gap-6">
        <WorkflowPageHeader
          eyebrow={eyebrow}
          title={itemTitle || formValues.sku.trim() || 'Testing'}
          actions={onBackToDirectory ? (
            <BackToolbarButton label="Back to Testing" onClick={onBackToDirectory} />
          ) : undefined}
        />

        {submitError ? (
          <div className="rounded-xl border border-[#f7c8c4] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-text)]">
            {submitError}
          </div>
        ) : null}

        {imagesProcessing ? (
          <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-50/90">
            Preparing images: {imageProcessingSummary.processed} of {imageProcessingSummary.total} ready.
            {imageProcessingSummary.processing > 0 ? ` ${imageProcessingSummary.processing} still processing.` : ''}
            {imageProcessingSummary.failed > 0 ? ` ${imageProcessingSummary.failed} need attention before submit.` : ''}
          </div>
        ) : null}

        {submitting && imageUploadProgress && imageUploadProgress.total > 0 ? (
          <div className="rounded-xl border border-sky-400/25 bg-sky-500/10 px-4 py-3 text-sm text-sky-50/90">
            {imageUploadProgress.phase === 'finalizing'
              ? `Finalizing saved image metadata for ${imageUploadProgress.total} ${imageUploadProgress.total === 1 ? 'image' : 'images'}.`
              : `Uploading images: ${imageUploadProgress.completed} of ${imageUploadProgress.total} complete.${imageUploadProgress.currentFilename ? ` Current file: ${imageUploadProgress.currentFilename}.` : ''}`}
          </div>
        ) : null}

        {submitSuccess ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {submitSuccess.action === 'updated'
              ? <>Testing fields updated for record <strong>{submitSuccess.recordId}</strong>. SKU: <strong>{submitSuccess.sku}</strong>.</>
              : <>Testing submission saved to Airtable. Record ID: <strong>{submitSuccess.recordId}</strong>. SKU: <strong>{submitSuccess.sku}</strong>.</>}
          </div>
        ) : null}

        <WorkflowFormSnapshotSection
          values={{
            sku: formValues.sku,
            make: formValues.make,
            model: formValues.model,
            componentType: formValues.componentType,
            originalBox: formValues.originalBox,
            manual: formValues.manual,
            remote: formValues.remote,
            powerCable: formValues.powerCable,
            additionalItems: formValues.additionalItems,
            audiogonRating: formValues.audiogonRating,
          }}
          omittedFieldKeys={['audiogonRating']}
          customerCosmeticNotes={customerReference.cosmeticNotes}
          inventoryNotes={formValues.inventoryNotes}
        >
          <WorkflowReferenceImagesPanel
            title="Intake Images"
            description="These intake-stage images are available for reference while you test the current stage. They do not become part of the active testing upload set unless you upload them here again."
            images={stageContext.referenceAttachments}
          />
        </WorkflowFormSnapshotSection>

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
                disabled={submitting || imagesProcessing}
              >
                {submitting ? (recordId ? 'Saving...' : 'Submitting...') : imagesProcessing ? 'Processing images...' : (recordId ? 'Save Testing' : 'Submit Testing')}
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
                disabled={submitting || imagesProcessing}
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