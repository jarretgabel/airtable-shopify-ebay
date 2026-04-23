import { ComponentTypeSearchField } from '@/components/tabs/component-type-search-field';
import { DatePickerField } from '@/components/tabs/date-picker-field';
import type { InventoryDraftValue, InventoryFieldMetadata } from '@/components/tabs/airtable/inventoryDirectoryTypes';
import {
  displayInventoryValue,
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
}

const FIELD_CLASS = 'w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20';
const LABEL_CLASS = 'text-sm font-semibold text-[var(--ink)]';
const HELP_CLASS = 'mt-1 text-xs text-[var(--muted)]';
const DATE_BUTTON_CLASS = 'inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20';

type InventoryEditorFieldKind = 'checkbox' | 'text' | 'textarea' | 'select' | 'searchable-select' | 'date' | 'number' | 'unsupported';

interface InventoryEditorFieldConfig {
  label?: string;
  kind?: InventoryEditorFieldKind;
  rows?: number;
  description?: string;
  step?: string;
}

const FIELD_CONFIG_BY_NAME: Record<string, InventoryEditorFieldConfig> = {
  'Component Type': {
    kind: 'searchable-select',
    description: 'Start typing to search, then choose a single component type.',
  },
  'Inventory Notes': {
    kind: 'textarea',
    rows: 4,
  },
  'Cosmetic Condition Notes': {
    label: 'Cosmetic Notes',
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
}: InventoryRecordEditorProps) {
  if (!record) {
    return (
      <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
        <h3 className="m-0 text-xl font-semibold text-[var(--ink)]">Inventory Record</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Load a record from the inventory directory to start editing its SB Inventory fields.</p>
      </section>
    );
  }

  return (
    <section className="space-y-5 rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4">
        <div>
          <p className="m-0 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">SB Inventory</p>
          <h3 className="mt-2 text-2xl font-semibold text-[var(--ink)]">Edit Record</h3>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Review and update the editable Airtable fields for this inventory item, then save your changes back to SB Inventory.</p>
          <p className="mt-3 text-sm text-[var(--muted)]">
            SKU: <strong className="text-[var(--ink)]">{displayInventoryValue(record.fields.SKU)}</strong>
            {' '}· {displayInventoryValue(record.fields.Make)} {displayInventoryValue(record.fields.Model)}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Record ID: {record.id} · Created {new Date(record.createdTime).toLocaleString()}</p>
        </div>
      </div>

      {error ? <p className="rounded-xl border border-[#f7c8c4] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-text)]">{error}</p> : null}
      {saveMessage ? <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{saveMessage}</p> : null}

      <div className="space-y-5 rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
        {editableFields.map((field) => {
          const dirty = dirtyFieldNames.includes(field.name);
          const value = draftValues[field.name];
          const fieldConfig = getInventoryEditorFieldConfig(field);

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

              {field.type === 'multipleSelects' && !inventoryFieldUsesSingleSelectUi(field.name) ? (
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
    </section>
  );
}