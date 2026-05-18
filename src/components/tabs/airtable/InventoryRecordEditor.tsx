import { Suspense, lazy, useMemo, useState } from 'react';
import { AppSectionTitle } from '@/components/app/AppSectionTitle';
import { ShopifyTagsEditor } from '@/components/approval/ShopifyTagsEditor';
import {
  isEbayMarketplaceIdField,
  isEbayPrimaryCategoryField,
  isEbaySecondaryCategoryField,
} from '@/components/approval/approvalFormFieldsEbayHelpers';
import { isShopifyCompoundTagsField } from '@/components/approval/approvalFormFieldsShopifyTagHelpers';
import { ComponentTypeSearchField } from '@/components/tabs/component-type-search-field';
import { DatePickerField } from '@/components/tabs/date-picker-field';
import type { InventoryDraftValue, InventoryFieldMetadata } from '@/components/tabs/airtable/inventoryDirectoryTypes';
import {
  displayInventoryValue,
  extractInventoryScalarValue,
  inventoryFieldSupportsNumericInput,
  inventoryFieldSupportsTextInput,
  inventoryFieldSupportsTextarea,
  inventoryFieldUsesSingleSelectUi,
} from '@/services/inventoryDirectory';
import type { AirtableRecord } from '@/types/airtable';

interface InventoryRecordEditorProps {
  record: AirtableRecord | null;
  editableFields: InventoryFieldMetadata[];
  draftValues: Record<string, InventoryDraftValue>;
  dirtyFieldNames: string[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  saveMessage: string | null;
  onFieldChange: (fieldName: string, value: InventoryDraftValue) => void;
  onReset: () => void;
  onReload: () => void;
  onSave: () => void;
  showIntro?: boolean;
  copy?: {
    eyebrow: string;
    title: string;
    description: string;
    emptyMessage: string;
  };
}

const FIELD_CLASS = 'w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20';
const LABEL_CLASS = 'text-sm font-semibold text-[var(--ink)]';
const HELP_CLASS = 'mt-1 text-xs text-[var(--muted)]';
const DATE_BUTTON_CLASS = 'inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20';

const EbayCategoriesSelect = lazy(() => import('@/components/approval/EbayCategoriesSelect').then((module) => ({ default: module.EbayCategoriesSelect })));
const LAZY_EDITOR_FALLBACK = <div className="mt-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--muted)]">Loading editor...</div>;

type InventoryEditorFieldKind = 'checkbox' | 'text' | 'textarea' | 'select' | 'searchable-select' | 'date' | 'number' | 'unsupported';

interface InventoryEditorFieldConfig {
  label?: string;
  kind?: InventoryEditorFieldKind;
  rows?: number;
  description?: string;
  step?: string;
}

type InventoryEditorSectionKey = 'intake' | 'testing' | 'photography' | 'listing' | 'workflow';

const INVENTORY_EDITOR_SECTION_ORDER: InventoryEditorSectionKey[] = ['intake', 'testing', 'photography', 'listing', 'workflow'];

const INVENTORY_EDITOR_SECTION_COPY: Record<InventoryEditorSectionKey, { title: string; description: string }> = {
  intake: {
    title: 'Intake',
    description: 'Core intake, identification, acquisition, and baseline inventory details.',
  },
  testing: {
    title: 'Testing',
    description: 'Condition, evaluation, testing notes, and service details for the testing stage.',
  },
  photography: {
    title: 'Photography',
    description: 'Photography-specific notes and completion fields for the photo stage.',
  },
  listing: {
    title: 'Listing',
    description: 'Marketplace-facing content, tags, pricing, and eBay or Shopify listing inputs.',
  },
  workflow: {
    title: 'Workflow',
    description: 'Operational workflow, approvals, assignments, signoffs, and lifecycle tracking.',
  },
};

const FIELD_CONFIG_BY_NAME: Record<string, InventoryEditorFieldConfig> = {
  'Component Type': {
    kind: 'searchable-select',
    description: 'Start typing to search, then choose a single component type.',
  },
  'Inventory Notes': {
    kind: 'textarea',
    rows: 4,
  },
  'Testing Cosmetic Notes': {
    label: 'Cosmetic Notes',
    kind: 'textarea',
    rows: 4,
  },
  'Photography Cosmetic Notes': {
    label: 'Photography Cosmetic Notes',
    kind: 'textarea',
    rows: 4,
  },
  'Internal Cosmetic Notes': {
    label: 'Internal Cosmetic Notes',
    kind: 'textarea',
    rows: 4,
  },
  'Additional Items': {
    kind: 'textarea',
    rows: 3,
  },
  'Audiogon Rating': {
    kind: 'select',
  },
  'Original Box': {
    kind: 'select',
  },
  Manual: {
    kind: 'select',
  },
  Remote: {
    kind: 'select',
  },
  'Power Cable': {
    kind: 'select',
  },
  'Shipping Method': {
    kind: 'select',
  },
  'Testing Notes': {
    kind: 'textarea',
    rows: 4,
  },
  'Service Notes': {
    kind: 'textarea',
    rows: 4,
  },
  'Testing Time': {
    kind: 'number',
    description: 'Enter total testing time in minutes.',
    step: '1',
  },
  'Service Time': {
    kind: 'number',
    description: 'Enter total service time in minutes.',
    step: '1',
  },
  Tested: {
    label: 'Testing Date',
    kind: 'date',
  },
  "Photo'd": {
    label: 'Photo Date',
    kind: 'date',
  },
};

function getInventoryEditorFieldConfig(field: InventoryFieldMetadata): Required<InventoryEditorFieldConfig> {
  const override = FIELD_CONFIG_BY_NAME[field.name] ?? {};

  let defaultKind: InventoryEditorFieldKind = 'unsupported';
  if (field.type === 'checkbox') {
    defaultKind = 'checkbox';
  } else if (field.type === 'date') {
    defaultKind = 'date';
  } else if (field.type === 'singleSelect') {
    defaultKind = 'select';
  } else if (field.type === 'multipleSelects') {
    defaultKind = inventoryFieldUsesSingleSelectUi(field.name) ? 'select' : 'unsupported';
  } else if (field.type === 'duration') {
    defaultKind = 'number';
  } else if (inventoryFieldSupportsTextarea(field)) {
    defaultKind = 'textarea';
  } else if (inventoryFieldSupportsNumericInput(field)) {
    defaultKind = 'number';
  } else if (inventoryFieldSupportsTextInput(field)) {
    defaultKind = 'text';
  }

  return {
    label: override.label ?? field.name,
    kind: override.kind ?? defaultKind,
    rows: override.rows ?? 4,
    description: override.description ?? '',
    step: override.step ?? (field.type === 'currency' ? '0.01' : '1'),
  };
}

function toggleMultiSelectValue(currentValue: string[], option: string): string[] {
  return currentValue.includes(option)
    ? currentValue.filter((value) => value !== option)
    : [...currentValue, option];
}

function getInventoryEditorSectionKey(fieldName: string): InventoryEditorSectionKey {
  const normalized = fieldName.trim().toLowerCase();

  if (
    normalized.includes('shopify')
    || normalized.includes('ebay')
    || normalized === 'template name'
    || normalized === 'item title'
    || normalized === 'description'
    || normalized.includes('key features')
    || normalized.includes('images (comma-separated)')
    || normalized.includes('images alt text')
    || normalized === 'condition'
    || normalized === 'images'
  ) {
    return 'listing';
  }

  if (
    normalized.includes('photography')
    || normalized === "photo'd"
    || normalized.startsWith('photo')
  ) {
    return 'photography';
  }

  if (
    normalized.includes('testing')
    || normalized.includes('service')
    || normalized.includes('audiogon')
    || normalized === 'tested'
  ) {
    return 'testing';
  }

  if (
    normalized.includes('workflow')
    || normalized.includes('accepted')
    || normalized.includes('signed by')
    || normalized.includes('signed at')
    || normalized.includes('pre-listing')
    || normalized.includes('stale recovery')
    || normalized.includes('relisted')
    || normalized.includes('trash status')
    || normalized.includes('qualification')
    || normalized.includes('unqualified')
    || normalized.includes('allocation')
    || normalized.includes('offer amount')
    || normalized.includes('paid amount')
    || normalized.includes('confirmed grand total')
    || normalized.includes('published at')
    || normalized.includes('offer id')
    || normalized.includes('listing id')
    || normalized.includes('owner')
  ) {
    return 'workflow';
  }

  return 'intake';
}

function getInventoryEbayMarketplaceId(record: AirtableRecord | null, editableFields: InventoryFieldMetadata[]): string {
  if (!record) return 'EBAY_US';

  const marketplaceField = editableFields.find((field) => isEbayMarketplaceIdField(field.name));
  if (!marketplaceField) {
    return 'EBAY_US';
  }

  const rawValue = record.fields[marketplaceField.name];
  return extractInventoryScalarValue(rawValue) || 'EBAY_US';
}

export function InventoryRecordEditor({
  record,
  editableFields,
  draftValues,
  dirtyFieldNames,
  loading,
  saving,
  error,
  saveMessage,
  onFieldChange,
  onReset,
  onReload,
  onSave,
  showIntro = true,
  copy = {
    eyebrow: 'SB Inventory',
    title: 'Edit Record',
    description: 'Review and update the editable Airtable fields for this inventory item, then save your changes back to SB Inventory.',
    emptyMessage: 'Load a record from the inventory directory to start editing its SB Inventory fields.',
  },
}: InventoryRecordEditorProps) {
  const [ebayCategoryLabelsByField, setEbayCategoryLabelsByField] = useState<Record<string, Record<string, string>>>({});

  if (!record) {
    return (
      <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
        <h3 className="m-0 text-xl font-semibold text-[var(--ink)]">{copy.title}</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{copy.emptyMessage}</p>
      </section>
    );
  }

  const hasStandaloneEbayCategoriesField = editableFields.some((field) => field.name.trim().toLowerCase() === 'ebay categories');
  const ebayMarketplaceId = getInventoryEbayMarketplaceId(record, editableFields);
  const sectionedFields = useMemo(
    () => INVENTORY_EDITOR_SECTION_ORDER
      .map((key) => ({
        key,
        fields: editableFields.filter((field) => getInventoryEditorSectionKey(field.name) === key),
      }))
      .filter((section) => section.fields.length > 0),
    [editableFields],
  );

  return (
    <div className="space-y-5">
      {showIntro ? (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4">
          <AppSectionTitle title={copy.title} />
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{copy.description}</p>
          <p className="mt-3 text-sm text-[var(--muted)]">
            SKU: <strong className="text-[var(--ink)]">{displayInventoryValue(record.fields.SKU)}</strong>
            {' '}· {displayInventoryValue(record.fields.Make)} {displayInventoryValue(record.fields.Model)}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Record ID: {record.id} · Created {new Date(record.createdTime).toLocaleString()}</p>
        </div>
      ) : null}

      {error ? <p className="rounded-xl border border-[#f7c8c4] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-text)]">{error}</p> : null}
      {saveMessage ? <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{saveMessage}</p> : null}

      <div className="space-y-8">
        {sectionedFields.map((section, sectionIndex) => (
          <section key={section.key} className="space-y-5">
            <AppSectionTitle
              title={INVENTORY_EDITOR_SECTION_COPY[section.key].title}
              className={sectionIndex === 0 ? 'pt-0' : 'border-t border-[var(--line)] pt-6'}
            />
            <p className="-mt-2 text-sm text-[var(--muted)]">{INVENTORY_EDITOR_SECTION_COPY[section.key].description}</p>

            {section.fields.map((field) => {
          const dirty = dirtyFieldNames.includes(field.name);
          const value = draftValues[field.name];
          const fieldConfig = getInventoryEditorFieldConfig(field);
          const isShopifyTagsField = isShopifyCompoundTagsField(field.name);
          const isStandaloneEbayCategoriesField = field.name.trim().toLowerCase() === 'ebay categories';
          const isPrimaryEbayCategoryField = !hasStandaloneEbayCategoriesField && isEbayPrimaryCategoryField(field.name);
          const isSecondaryEbayCategoryField = !hasStandaloneEbayCategoriesField && isEbaySecondaryCategoryField(field.name);
          const isEbayCategoriesField = isStandaloneEbayCategoriesField || isPrimaryEbayCategoryField;

          if (isSecondaryEbayCategoryField) {
            return null;
          }

          const ebayCategoryValue = isStandaloneEbayCategoriesField
            ? (Array.isArray(value) ? value : [])
            : [
              typeof draftValues[field.name] === 'string' ? draftValues[field.name] : '',
              ...editableFields
                .filter((candidate) => isEbaySecondaryCategoryField(candidate.name))
                .map((candidate) => draftValues[candidate.name])
                .filter((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0),
            ].filter((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0);

          return (
            <div key={field.id} className="block">
              <div className="flex items-center justify-between gap-3">
                <span className={LABEL_CLASS}>{fieldConfig.label}</span>
                {dirty ? <span className="rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">Changed</span> : null}
              </div>

              {fieldConfig.kind === 'checkbox' ? (
                <div className="mt-3 flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-[var(--line)] bg-[var(--bg)] text-[var(--accent)] focus:ring-[var(--accent)]/40"
                    checked={Boolean(value)}
                    onChange={(event) => onFieldChange(field.name, event.currentTarget.checked)}
                  />
                  <span className="text-sm text-[var(--muted)]">Enabled</span>
                </div>
              ) : null}

              {fieldConfig.kind === 'searchable-select' ? (
                field.choices.length > 0 ? (
                  <ComponentTypeSearchField
                    className={`${FIELD_CLASS} mt-2`}
                    helpClassName={HELP_CLASS}
                    listId={`inventory-editor-${field.id}-options`}
                    options={field.choices}
                    value={typeof value === 'string' ? value : ''}
                    onValueChange={(nextValue) => onFieldChange(field.name, nextValue)}
                  />
                ) : (
                  <input
                    type="text"
                    className={`${FIELD_CLASS} mt-2`}
                    value={typeof value === 'string' ? value : ''}
                    onChange={(event) => onFieldChange(field.name, event.currentTarget.value)}
                  />
                )
              ) : null}

              {fieldConfig.kind === 'select' ? (
                field.choices.length > 0 ? (
                  <select
                    className={`${FIELD_CLASS} mt-2`}
                    value={typeof value === 'string' ? value : ''}
                    onChange={(event) => onFieldChange(field.name, event.currentTarget.value)}
                  >
                    <option value="">Select an option</option>
                    {field.choices.map((choice, index) => (
                      <option key={`${choice}-${index}`} value={choice}>{choice}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    className={`${FIELD_CLASS} mt-2`}
                    value={typeof value === 'string' ? value : ''}
                    onChange={(event) => onFieldChange(field.name, event.currentTarget.value)}
                  />
                )
              ) : null}

              {isShopifyTagsField ? (
                <div className="mt-2">
                  <ShopifyTagsEditor
                    label={fieldConfig.label}
                    tags={Array.isArray(value) ? value : []}
                    onChange={(nextTags) => onFieldChange(field.name, nextTags)}
                    disabled={saving}
                  />
                </div>
              ) : null}

              {isEbayCategoriesField ? (
                <div className="mt-2">
                  <Suspense fallback={LAZY_EDITOR_FALLBACK}>
                    <EbayCategoriesSelect
                      fieldName={field.name}
                      label={fieldConfig.label}
                      marketplaceId={ebayMarketplaceId}
                      value={ebayCategoryValue}
                      labelsById={ebayCategoryLabelsByField[field.name] ?? {}}
                      onChange={(nextIds, labelsById) => {
                        if (isStandaloneEbayCategoriesField) {
                          onFieldChange(field.name, nextIds);
                        } else {
                          onFieldChange(field.name, nextIds[0] ?? '');
                          editableFields
                            .filter((candidate) => isEbaySecondaryCategoryField(candidate.name))
                            .forEach((candidate, index) => {
                              onFieldChange(candidate.name, nextIds[index + 1] ?? '');
                            });
                        }

                        if (labelsById) {
                          setEbayCategoryLabelsByField((current) => ({
                            ...current,
                            [field.name]: labelsById,
                          }));
                        }
                      }}
                      disabled={saving}
                    />
                  </Suspense>
                </div>
              ) : null}

              {field.type === 'multipleSelects' && !inventoryFieldUsesSingleSelectUi(field.name) && !isShopifyTagsField && !isEbayCategoriesField ? (
                field.choices.length > 0 ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {field.choices.map((choice, index) => {
                      const currentValue = Array.isArray(value) ? value : [];

                      return (
                        <label key={`${choice}-${index}`} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-[var(--ink)]">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-[var(--line)] bg-[var(--bg)] text-[var(--accent)] focus:ring-[var(--accent)]/40"
                            checked={currentValue.includes(choice)}
                            onChange={() => onFieldChange(field.name, toggleMultiSelectValue(currentValue, choice))}
                          />
                          <span>{choice}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <textarea
                    rows={3}
                    className={`${FIELD_CLASS} mt-2`}
                    value={Array.isArray(value) ? value.join(', ') : ''}
                    onChange={(event) => {
                      const nextValues = event.currentTarget.value
                        .split(',')
                        .map((entry) => entry.trim())
                        .filter(Boolean);
                      onFieldChange(field.name, nextValues);
                    }}
                  />
                )
              ) : null}

              {fieldConfig.kind === 'date' ? (
                <DatePickerField
                  containerClassName="mt-2 flex gap-2"
                  inputClassName={`${FIELD_CLASS} flex-1`}
                  buttonClassName={DATE_BUTTON_CLASS}
                  value={typeof value === 'string' ? value : ''}
                  pickerLabel={fieldConfig.label}
                  onValueChange={(nextValue) => onFieldChange(field.name, nextValue)}
                />
              ) : null}

              {fieldConfig.kind === 'textarea' ? (
                <textarea
                  rows={fieldConfig.rows}
                  className={`${FIELD_CLASS} mt-2`}
                  value={typeof value === 'string' ? value : ''}
                  onChange={(event) => onFieldChange(field.name, event.currentTarget.value)}
                />
              ) : null}

              {fieldConfig.kind === 'number' ? (
                <input
                  type="number"
                  step={fieldConfig.step}
                  className={`${FIELD_CLASS} mt-2`}
                  value={typeof value === 'string' ? value : ''}
                  onChange={(event) => onFieldChange(field.name, event.currentTarget.value)}
                />
              ) : null}

              {fieldConfig.kind === 'text' ? (
                <input
                  type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
                  className={`${FIELD_CLASS} mt-2`}
                  value={typeof value === 'string' ? value : ''}
                  onChange={(event) => onFieldChange(field.name, event.currentTarget.value)}
                />
              ) : null}

              {fieldConfig.description ? <p className={HELP_CLASS}>{fieldConfig.description}</p> : null}

              {fieldConfig.kind === 'unsupported' ? (
                  <p className="mt-3 text-sm text-[var(--muted)]">This field type is currently read-only in the Inventory editor.</p>
                ) : null}
            </div>
          );
            })}
          </section>
        ))}

        <div className="flex flex-col gap-3 border-t border-[var(--line)] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="m-0 text-sm text-[var(--muted)]">
            {dirtyFieldNames.length === 0
              ? 'No unsaved changes. Reload to pull the latest Airtable values, or update any field and save.'
              : `${dirtyFieldNames.length} field${dirtyFieldNames.length === 1 ? '' : 's'} changed. Reset to discard local edits or save to Airtable.`}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              onClick={onReload}
              disabled={loading || saving}
            >
              {loading ? 'Loading...' : 'Reload'}
            </button>
            <button
              type="button"
              className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={onReset}
              disabled={saving || dirtyFieldNames.length === 0}
            >
              Reset
            </button>
            <button
              type="button"
              className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={onSave}
              disabled={saving || dirtyFieldNames.length === 0}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}