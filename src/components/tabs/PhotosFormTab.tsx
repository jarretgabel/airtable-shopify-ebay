import { useEffect, useState, type ReactNode } from 'react';
import { ErrorSurface, LoadingSurface, PanelSurface } from '@/components/app/StateSurfaces';
import { WorkflowPageHeader } from '@/components/app/WorkflowPageHeader';
import { ComponentTypeSearchField } from '@/components/tabs/component-type-search-field';
import { DatePickerField } from '@/components/tabs/date-picker-field';
import { FormImageUploadEditor } from '@/components/tabs/FormImageUploadEditor';
import { WorkflowImageMetadataEditor } from '@/components/tabs/WorkflowImageMetadataEditor';
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
  type PhotosFormContextAttachment,
  type PhotosFormCustomerReference,
  type PhotosFormRecordSource,
  type PhotosFormStageContext,
  type PhotosFormSubmitResult,
} from '@/services/photosForm';
import type { WorkflowImageMetadataRecord } from '@/services/workflowImageMetadata';

const EMPTY_CUSTOMER_REFERENCE: PhotosFormCustomerReference = {
  cosmeticNotes: '',
  functionalNotes: '',
  inclusionNotes: '',
  submittedPhotosNotes: '',
};

const EMPTY_STAGE_CONTEXT: PhotosFormStageContext = {
  inventoryNotes: '',
  testingNotes: '',
  existingAttachments: [],
  imageMetadata: [],
};

type PhotosOptionSets = Record<PhotosFormOptionFieldName, string[]>;

const FIELD_CLASS = 'mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20';
const LABEL_CLASS = 'text-sm font-semibold text-[var(--ink)]';
const HELP_CLASS = 'mt-1 text-xs text-[var(--muted)]';
const DATE_BUTTON_CLASS = 'mt-2 inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20';

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
  recordSource: PhotosFormRecordSource,
  stageContext: PhotosFormStageContext,
  inclusionConfirmations: Partial<Record<InclusionConfirmationKey, boolean>>,
): string | null {
  if (!values.sku.trim()) return 'SKU is required.';
  if (!values.make.trim()) return 'Make is required.';
  if (!values.model.trim()) return 'Model is required.';
  if (!values.componentType.trim()) return 'Component Type is required.';
  if (!values.photoDate.trim()) return 'Photo Date is required.';
  if (!values.status.trim()) return 'Status is required.';
  if (recordSource !== 'used-gear-workflow' && values.imageFiles.length === 0 && stageContext.existingAttachments.length === 0) {
    return 'Upload at least one image before submitting the Photos form.';
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
  const [recordSource, setRecordSource] = useState<PhotosFormRecordSource>('inventory-directory');
  const [customerReference, setCustomerReference] = useState<PhotosFormCustomerReference>(EMPTY_CUSTOMER_REFERENCE);
  const [stageContext, setStageContext] = useState<PhotosFormStageContext>(EMPTY_STAGE_CONTEXT);
  const [imageMetadata, setImageMetadata] = useState<WorkflowImageMetadataRecord[]>([]);
  const [initialImageMetadata, setInitialImageMetadata] = useState<WorkflowImageMetadataRecord[]>([]);
  const [inclusionConfirmations, setInclusionConfirmations] = useState<Partial<Record<InclusionConfirmationKey, boolean>>>({});
  const [optionSets, setOptionSets] = useState<PhotosOptionSets | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<PhotosFormSubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadEditorResetKey, setUploadEditorResetKey] = useState(0);

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
                values: createPhotosFormDefaults(),
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
          setInclusionConfirmations({});
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

  const setFieldValue = <K extends keyof PhotosFormValues>(fieldName: K, value: PhotosFormValues[K]) => {
    setFormValues((current) => ({ ...current, [fieldName]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    const validationError = validateForm(formValues, recordSource, stageContext, inclusionConfirmations);
    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitPhotosForm(formValues, recordId, { recordSource, imageMetadata });
      setSubmitSuccess(result);
      if (result.action === 'updated') {
        const nextValues = { ...formValues, imageFiles: [] };
        setFormValues(nextValues);
        setInitialFormValues(nextValues);
        setInitialImageMetadata(imageMetadata);
        setUploadEditorResetKey((current) => current + 1);
      } else {
        const nextValues = createPhotosFormDefaults();
        setFormValues(nextValues);
        setInitialFormValues(nextValues);
        setImageMetadata([]);
        setInitialImageMetadata([]);
        setUploadEditorResetKey((current) => current + 1);
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
      return (
        <FormImageUploadEditor
          title={definition.label}
          description="Upload, crop, resize, watermark, rename, and compare files before they are attached to the operational record. Saved defaults persist locally for future photo sessions."
          disabled={submitting}
          resetKey={uploadEditorResetKey}
          onFilesChange={(files) => setFieldValue(definition.name, files as PhotosFormValues[typeof definition.name])}
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

  const hasCustomerReference = Object.values(customerReference).some((value) => value.trim().length > 0);
  const applicableIncludedItems = buildApplicableIncludedItems(formValues);
  const hasOperationalContext = Boolean(stageContext.inventoryNotes.trim() || stageContext.testingNotes.trim() || stageContext.existingAttachments.length > 0);
  const stageImageMetadata = filterWorkflowImageMetadataByStage(imageMetadata, 'photos');

  const handleInclusionConfirmationChange = (key: InclusionConfirmationKey, checked: boolean) => {
    setInclusionConfirmations((current) => ({
      ...current,
      [key]: checked,
    }));
  };

  const renderAttachmentLink = (attachment: PhotosFormContextAttachment) => {
    if (attachment.url) {
      return (
        <a
          href={attachment.url}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          {attachment.filename}
        </a>
      );
    }

    return (
      <span className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-semibold text-[var(--ink)]">
        {attachment.filename}
      </span>
    );
  };

  return (
    <PanelSurface>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <WorkflowPageHeader
          eyebrow="Forms"
          title="Photos"
          detail={recordId ? <>Editing record <strong>{recordId}</strong>. Saving here updates only the Photos fields for this inventory row.</> : undefined}
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
              ? <>Photos fields updated for record <strong>{submitSuccess.recordId}</strong>. SKU: <strong>{submitSuccess.sku}</strong>.</>
              : <>Photos submission saved to Airtable. Record ID: <strong>{submitSuccess.recordId}</strong>. SKU: <strong>{submitSuccess.sku}</strong>.</>}
          </div>
        ) : null}

        {hasCustomerReference ? (
          <div className="rounded-2xl border border-sky-400/25 bg-sky-500/10 p-5">
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-sky-100">Customer Intake Reference</p>
            <p className="mt-2 text-sm leading-6 text-sky-50/90">
              Keep customer-submitted context separate from the photography assessment below so listing media notes remain clearly staff-owned.
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
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Photography Context</p>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] p-3 text-sm text-[var(--muted)]">
              <span className="font-semibold text-[var(--ink)]">Make:</span> {formValues.make || 'Not set'}
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] p-3 text-sm text-[var(--muted)]">
              <span className="font-semibold text-[var(--ink)]">Model:</span> {formValues.model || 'Not set'}
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] p-3 text-sm text-[var(--muted)]">
              <span className="font-semibold text-[var(--ink)]">Component Type:</span> {formValues.componentType || 'Not set'}
            </div>
          </div>

          {hasOperationalContext ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] p-4 text-sm text-[var(--muted)]">
                <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Inventory Notes</p>
                <p className="mt-2 leading-6 text-[var(--ink)]">{stageContext.inventoryNotes || 'No inventory notes available.'}</p>
              </div>
              <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] p-4 text-sm text-[var(--muted)]">
                <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Testing Notes</p>
                <p className="mt-2 leading-6 text-[var(--ink)]">{stageContext.testingNotes || 'No testing notes available yet.'}</p>
              </div>
            </div>
          ) : null}

          <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-500/10 p-4">
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-amber-100">Included Items To Photograph</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { label: 'Original Box', value: formValues.originalBox },
                { label: 'Manual', value: formValues.manual },
                { label: 'Remote', value: formValues.remote },
                { label: 'Power Cable', value: formValues.powerCable },
                { label: 'Additional Items', value: formValues.additionalItems },
              ].map((item) => {
                const emphasized = isApplicableIncludedValue(item.value);
                return (
                  <span
                    key={item.label}
                    className={emphasized
                      ? 'rounded-full border border-amber-300/35 bg-amber-400/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-amber-50'
                      : 'rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]'}
                  >
                    {item.label}: {item.value || 'Not provided'}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--bg)] p-4">
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Existing Workflow Images</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {stageContext.existingAttachments.length > 0
                ? stageContext.existingAttachments.map((attachment) => (
                    <div key={attachment.id ?? attachment.filename}>{renderAttachmentLink(attachment)}</div>
                  ))
                : <span className="text-sm text-[var(--muted)]">No existing workflow images are attached yet.</span>}
            </div>
          </div>

          <WorkflowImageMetadataEditor
            metadata={stageImageMetadata}
            onChange={(nextMetadata) => setImageMetadata((current) => replaceWorkflowImageMetadataStage(current, 'photos', nextMetadata))}
            allowReorder
            disabled={submitting}
            title="Photography Images"
            description="Photography edits only photo-stage images here. Testing images stay separate on the testing form, while workflow and listing views still combine both stages."
            emptyMessage="Upload and save photography images first. Once Airtable has attached the files, you can manage photo-stage alt text, order, and listing defaults here."
            className="mt-4"
          />
        </div>

        <form className="space-y-5 rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5" onSubmit={handleSubmit}>
          {photosFormFields.map((field) => (
            <div key={field.airtableFieldName}>
              {field.type === 'file'
                ? renderField(field)
                : <FieldShell definition={field}>{renderField(field)}</FieldShell>}
            </div>
          ))}

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

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="m-0 text-sm text-[var(--muted)]">Required fields are marked with an asterisk. Submit requires either newly uploaded photos or existing workflow images plus any applicable included-item confirmations.</p>
            <div className="flex gap-3">
              <button
                type="button"
                className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                onClick={() => {
                  setSubmitError(null);
                  setSubmitSuccess(null);
                  setFormValues(initialFormValues);
                  setImageMetadata(initialImageMetadata);
                  setInclusionConfirmations({});
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
                {submitting ? (recordId ? 'Saving...' : 'Submitting...') : (recordId ? 'Save Photos' : 'Submit Photos')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </PanelSurface>
  );
}