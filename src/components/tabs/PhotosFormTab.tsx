import { useEffect, useState, type ReactNode } from 'react';
import { AppPageLayout } from '@/components/app/AppPageLayout';
import { AppSectionTitle } from '@/components/app/AppSectionTitle';
import { BackToolbarButton } from '@/components/app/BackToolbarButton';
import { ErrorSurface, LoadingSurface } from '@/components/app/StateSurfaces';
import { WorkflowPageHeader } from '@/components/app/WorkflowPageHeader';
import { WorkflowFormSnapshotSection } from '@/components/tabs/WorkflowFormSnapshotSection';
import {
  tabFormControlClass,
  tabFormDateButtonClass,
  tabFormHelpClass,
  tabFormLabelClass,
  tabFormSecondaryActionClass,
  uploadProgressBannerClass,
} from '@/components/tabs/uiClasses';
import { useConfirmationDialog } from '@/hooks/useConfirmationDialog';
import { ComponentTypeSearchField } from '@/components/tabs/component-type-search-field';
import { DatePickerField } from '@/components/tabs/date-picker-field';
import { FormImageUploadEditor } from '@/components/tabs/FormImageUploadEditor';
import { WorkflowReferenceImagesPanel } from '@/components/tabs/WorkflowReferenceImagesPanel';
import { WorkflowImageMetadataEditor } from '@/components/tabs/WorkflowImageMetadataEditor';
import type { FormImageProcessingSummary } from '@/components/tabs/FormImageUploadEditor';
import type { FormImageUploadAsset } from '@/services/formImageUploads';
import { isImageRoleComplete } from '@/services/imageNamingFormatter';
import { filterWorkflowImageMetadataByStage, replaceWorkflowImageMetadataStage } from '@/services/workflowImageMetadata';
import {
  createPhotosFormDefaults,
  photosFormFields,
  type PhotosFormFieldDefinition,
  type PhotosFormOptionFieldName,
  type PhotosFormValues,
} from '@/components/tabs/photos/photosFormSchema';
import {
  loadPhotosFormOptionSets,
  loadPhotosFormValues,
  submitPhotosForm,
  type PhotosFormCustomerReference,
  type PhotosFormImageUploadProgress,
  type PhotosFormRecordSource,
  type PhotosFormStageContext,
  type PhotosFormSubmitResult,
} from '@/services/photosForm';
import type { WorkflowImageMetadataRecord } from '@/services/workflowImageMetadata';

const EMPTY_CUSTOMER_REFERENCE: PhotosFormCustomerReference = {
  cosmeticNotes: '',
  functionalNotes: '',
  inclusionNotes: '',
};

const EMPTY_STAGE_CONTEXT: PhotosFormStageContext = {
  inventoryNotes: '',
  testingNotes: '',
  testingCosmeticNotes: '',
  existingAttachments: [],
  intakeReferenceAttachments: [],
  testingReferenceAttachments: [],
  imageMetadata: [],
};

const EMPTY_IMAGE_PROCESSING_SUMMARY: FormImageProcessingSummary = {
  total: 0,
  processed: 0,
  processing: 0,
  failed: 0,
};

type PhotosOptionSets = Record<PhotosFormOptionFieldName, string[]>;

const FIELD_CLASS = tabFormControlClass;
const LABEL_CLASS = tabFormLabelClass;
const HELP_CLASS = tabFormHelpClass;
const DATE_BUTTON_CLASS = tabFormDateButtonClass;

const EDITABLE_PHOTOS_FIELD_NAMES: Array<keyof PhotosFormValues> = [
  'cosmeticConditionNotes',
  'imageFiles',
  'photoDate',
];

type PhotosSubmitIntent = 'save' | 'complete';

type InclusionConfirmationKey = 'originalBox' | 'manual' | 'remote' | 'powerCable' | 'additionalItems';

interface InclusionConfirmationItem {
  key: InclusionConfirmationKey;
  label: string;
  value: string;
}

function isApplicableIncludedValue(value: string): boolean {
  const normalizedValue = value.trim().toLowerCase();
  if (!normalizedValue) {
    return false;
  }

  return !['no', 'none', 'n/a', 'na', 'not included', 'missing'].includes(normalizedValue);
}

function buildApplicableIncludedItems(values: PhotosFormValues): InclusionConfirmationItem[] {
  const candidateItems: InclusionConfirmationItem[] = [
    { key: 'originalBox', label: 'Original Box', value: values.originalBox },
    { key: 'manual', label: 'Manual', value: values.manual },
    { key: 'remote', label: 'Remote', value: values.remote },
    { key: 'powerCable', label: 'Power Cable', value: values.powerCable },
    { key: 'additionalItems', label: 'Additional Items', value: values.additionalItems },
  ];

  return candidateItems.filter((item) => isApplicableIncludedValue(item.value));
}

function validateForm(
  values: PhotosFormValues,
  stageContext: PhotosFormStageContext,
  inclusionConfirmations: Partial<Record<InclusionConfirmationKey, boolean>>,
  submitIntent: PhotosSubmitIntent,
  imagesProcessing: boolean,
): string | null {
  if (!values.sku.trim()) return 'SKU is required.';
  if (!values.make.trim()) return 'Make is required.';
  if (!values.model.trim()) return 'Model is required.';
  if (!values.componentType.trim()) return 'Component Type is required.';
  if (!values.photoDate.trim()) return 'Photo Date is required.';
  if (imagesProcessing) return 'Wait for image processing to finish before saving Photos.';
  if (values.imageFiles.length === 0 && stageContext.existingAttachments.length === 0) {
    return 'Upload at least one image before submitting the Photos form.';
  }

  if (submitIntent !== 'complete') {
    return null;
  }

  const applicableIncludedItems = buildApplicableIncludedItems(values);
  const missingConfirmations = applicableIncludedItems
    .filter((item) => !inclusionConfirmations[item.key])
    .map((item) => item.label);

  if (missingConfirmations.length > 0) {
    return `Confirm that the following included items were checked and photographed: ${missingConfirmations.join(', ')}.`;
  }

  return null;
}

function getFieldLayoutClass(definition: PhotosFormFieldDefinition): string {
  if (definition.type === 'textarea' || definition.type === 'file') {
    return 'lg:col-span-2';
  }

  return '';
}

function FieldShell({ definition, children }: { definition: PhotosFormFieldDefinition; children: ReactNode }) {
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

interface PhotosFormTabProps {
  recordId?: string | null;
  onBackToDirectory?: () => void;
  eyebrow?: string;
}

export function PhotosFormTab({ recordId, onBackToDirectory, eyebrow = 'Forms' }: PhotosFormTabProps) {
  const [formValues, setFormValues] = useState<PhotosFormValues>(() => createPhotosFormDefaults());
  const [itemTitle, setItemTitle] = useState('');
  const [recordSource, setRecordSource] = useState<PhotosFormRecordSource>('inventory-directory');
  const [customerReference, setCustomerReference] = useState<PhotosFormCustomerReference>(EMPTY_CUSTOMER_REFERENCE);
  const [stageContext, setStageContext] = useState<PhotosFormStageContext>(EMPTY_STAGE_CONTEXT);
  const [imageMetadata, setImageMetadata] = useState<WorkflowImageMetadataRecord[]>([]);
  const [imageUploadAssets, setImageUploadAssets] = useState<FormImageUploadAsset[]>([]);
  const [inclusionConfirmations, setInclusionConfirmations] = useState<Partial<Record<InclusionConfirmationKey, boolean>>>({});
  const [optionSets, setOptionSets] = useState<PhotosOptionSets | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<PhotosFormSubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [imagesProcessing, setImagesProcessing] = useState(false);
  const [imageProcessingSummary, setImageProcessingSummary] = useState<FormImageProcessingSummary>(EMPTY_IMAGE_PROCESSING_SUMMARY);
  const [imageUploadProgress, setImageUploadProgress] = useState<PhotosFormImageUploadProgress | null>(null);
  const [uploadEditorResetKey, setUploadEditorResetKey] = useState(0);
  const { requestConfirmation, confirmationModal } = useConfirmationDialog();

  useEffect(() => {
    let cancelled = false;

    const loadOptions = async () => {
      setLoadingOptions(true);
      setOptionsError(null);
      try {
        const [nextOptionSets, nextFormValues] = await Promise.all([
          loadPhotosFormOptionSets(),
          recordId
            ? loadPhotosFormValues(recordId)
            : Promise.resolve({
                source: 'inventory-directory' as const,
                itemTitle: '',
                values: createPhotosFormDefaults(),
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
          setInclusionConfirmations({});
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

  const setFieldValue = <K extends keyof PhotosFormValues>(fieldName: K, value: PhotosFormValues[K]) => {
    setFormValues((current) => ({ ...current, [fieldName]: value }));
  };

  const submitPhotos = async (submitIntent: PhotosSubmitIntent) => {
    setSubmitError(null);
    setSubmitSuccess(null);

    const missingImageRole = imageUploadAssets.some((asset) => !isImageRoleComplete(asset.imageRole, asset.customImageRole));
    if (missingImageRole) {
      setSubmitError('Select an image role for every uploaded photography image before saving.');
      return;
    }

    const validationError = validateForm(formValues, stageContext, inclusionConfirmations, submitIntent, imagesProcessing);
    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    setSubmitting(true);
    setImageUploadProgress(null);
    try {
      const result = await submitPhotosForm(formValues, recordId, {
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
        const nextValues = createPhotosFormDefaults();
        setFormValues(nextValues);
        setImageMetadata([]);
        setImageUploadAssets([]);
        setUploadEditorResetKey((current) => current + 1);
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to submit the Photos form.');
    } finally {
      setSubmitting(false);
      setImageUploadProgress(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitPhotos('save');
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
      return (
        <FormImageUploadEditor
          title={definition.label}
          required={definition.required}
          description={definition.description}
          disabled={submitting}
          resetKey={uploadEditorResetKey}
          onFilesChange={(files) => setFieldValue(definition.name, files as PhotosFormValues[typeof definition.name])}
          onUploadAssetsChange={setImageUploadAssets}
          onProcessingStateChange={setImagesProcessing}
          onProcessingSummaryChange={setImageProcessingSummary}
        />
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

  const applicableIncludedItems = buildApplicableIncludedItems(formValues);
  const hasOperationalContext = Boolean(
    stageContext.inventoryNotes.trim()
    || stageContext.testingNotes.trim()
    || stageContext.testingCosmeticNotes.trim()
    || stageContext.existingAttachments.length > 0,
  );
  const stageImageMetadata = filterWorkflowImageMetadataByStage(imageMetadata, 'photos');
  const editableFields = photosFormFields.filter((field) => EDITABLE_PHOTOS_FIELD_NAMES.includes(field.name));

  const handleInclusionConfirmationChange = (key: InclusionConfirmationKey, checked: boolean) => {
    setInclusionConfirmations((current) => ({
      ...current,
      [key]: checked,
    }));
  };


  return (
    <AppPageLayout>
      <div className="flex flex-col gap-6">
        <WorkflowPageHeader
          eyebrow={eyebrow}
          title={itemTitle || formValues.sku.trim() || 'Photography'}
          actions={onBackToDirectory ? (
            <BackToolbarButton label="Back to Photography" onClick={onBackToDirectory} />
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
          <div className={uploadProgressBannerClass}>
            {imageUploadProgress.phase === 'finalizing'
              ? `Finalizing saved image metadata for ${imageUploadProgress.total} ${imageUploadProgress.total === 1 ? 'image' : 'images'}.`
              : `Uploading images: ${imageUploadProgress.completed} of ${imageUploadProgress.total} complete.${imageUploadProgress.currentFilename ? ` Current file: ${imageUploadProgress.currentFilename}.` : ''}`}
          </div>
        ) : null}

        {submitSuccess ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {submitSuccess.action === 'updated'
              ? <>Photos fields updated for record <strong>{submitSuccess.recordId}</strong>. SKU: <strong>{submitSuccess.sku}</strong>.</>
              : <>Photos submission saved to Airtable. Record ID: <strong>{submitSuccess.recordId}</strong>. SKU: <strong>{submitSuccess.sku}</strong>.</>}
          </div>
        ) : null}

        <WorkflowFormSnapshotSection
          values={{
            cost: formValues.cost,
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
          customerCosmeticNotes={customerReference.cosmeticNotes}
          inventoryNotes={stageContext.inventoryNotes}
          extraCards={[
            { title: 'Testing Cosmetic Notes', value: stageContext.testingCosmeticNotes, emptyValue: 'No testing cosmetic notes available yet.' },
            ...(hasOperationalContext ? [{ title: 'Testing Notes', value: stageContext.testingNotes, emptyValue: 'No testing notes available yet.' }] : []),
          ]}
        >
          <div className="mt-4 space-y-4">
            <AppSectionTitle title="Image Snapshot" titleClassName="text-base" />

            {stageContext.intakeReferenceAttachments.length > 0 ? (
              <WorkflowReferenceImagesPanel
                title="Intake Images"
                description="These intake-stage images are available for reference while you photograph the current stage."
                images={stageContext.intakeReferenceAttachments}
              />
            ) : (
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/60 p-4">
                <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Intake Images</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">No intake reference images are available for this record yet.</p>
              </div>
            )}

            {stageContext.testingReferenceAttachments.length > 0 ? (
              <WorkflowReferenceImagesPanel
                title="Testing Images"
                description="These testing-stage images are available for reference while you photograph the current stage."
                images={stageContext.testingReferenceAttachments}
              />
            ) : (
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/60 p-4">
                <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Testing Images</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">No testing reference images are available for this record yet.</p>
              </div>
            )}
          </div>
        </WorkflowFormSnapshotSection>

        <form className="space-y-5 rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5" onSubmit={handleSubmit}>
          <AppSectionTitle title="Photography Details" titleClassName="text-lg" />
          <div className="grid gap-5 lg:grid-cols-2">
            {editableFields.map((field) => (
            <div key={field.airtableFieldName} className={getFieldLayoutClass(field)}>
              {field.type === 'file'
                ? (
                  <FormImageUploadEditor
                    title={field.label}
                    required={field.required}
                    description={field.description}
                    disabled={submitting}
                    namingContext={{
                      brand: formValues.make,
                      model: formValues.model,
                      productType: formValues.componentType,
                      companyName: 'Resolution AV',
                    }}
                    requireImageRole
                    resetKey={uploadEditorResetKey}
                    onFilesChange={(files) => setFieldValue(field.name, files as PhotosFormValues[typeof field.name])}
                    onUploadAssetsChange={setImageUploadAssets}
                    onProcessingStateChange={setImagesProcessing}
                    onProcessingSummaryChange={setImageProcessingSummary}
                    afterUploadContent={stageImageMetadata.length > 0 ? (
                      <WorkflowImageMetadataEditor
                        metadata={stageImageMetadata}
                        onChange={(nextMetadata) => setImageMetadata((current) => replaceWorkflowImageMetadataStage(current, 'photos', nextMetadata))}
                        allowReorder
                        disabled={submitting}
                        title="Photography Images"
                        description="Manage saved photo-stage image alt text, ordering, and listing defaults here."
                        emptyMessage=""
                        className="border-0 bg-transparent p-0"
                      />
                    ) : null}
                  />
                )
                : <FieldShell definition={field}>{renderField(field)}</FieldShell>}
            </div>
          ))}
          </div>

          {applicableIncludedItems.length > 0 ? (
            <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-5">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-amber-100">Required Included Item Confirmations</p>
              <p className="mt-2 text-sm leading-6 text-amber-50/90">
                Before the photo stage can be completed, confirm that each applicable included item was checked and photographed.
              </p>
              <div className="mt-4 space-y-3">
                {applicableIncludedItems.map((item) => (
                  <label key={item.key} className="flex items-start gap-3 rounded-xl border border-amber-300/25 bg-slate-950/20 px-4 py-3 text-sm text-amber-50/90">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-amber-200/50 bg-transparent text-[var(--accent)] focus:ring-[var(--accent)]"
                      checked={Boolean(inclusionConfirmations[item.key])}
                      onChange={(event) => handleInclusionConfirmationChange(item.key, event.currentTarget.checked)}
                    />
                    <span>I checked and photographed <strong>{item.label}</strong> for this unit.</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex justify-end">
            <div className="flex gap-3">
              <button
                type="submit"
                className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={submitting || imagesProcessing}
              >
                {submitting ? (recordId ? 'Saving...' : 'Submitting...') : imagesProcessing ? 'Processing images...' : (recordId ? 'Save Photos' : 'Submit Photos')}
              </button>
              <button
                type="button"
                className={tabFormSecondaryActionClass}
                onClick={async () => {
                  const confirmed = await requestConfirmation({
                    title: 'Mark photography as complete?',
                    message: 'This will mark the photography step complete for this record and move it to the next workflow state when the handoff requirements are satisfied.',
                    confirmLabel: 'Yes, complete photography',
                    cancelLabel: 'Cancel',
                    bullets: [
                      'Save Photos keeps the record in the photography step so the photographer can come back later.',
                      'Photos Complete advances the workflow only after the required confirmations are satisfied.',
                    ],
                  });

                  if (!confirmed) {
                    return;
                  }

                  void submitPhotos('complete');
                }}
                disabled={submitting || imagesProcessing}
              >
                Photos Complete
              </button>
            </div>
          </div>
        </form>
        {confirmationModal}
      </div>
    </AppPageLayout>
  );
}