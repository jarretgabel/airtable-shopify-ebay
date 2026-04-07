import { useEffect, useState } from 'react';

import { flattenEbayAspects, serializeEbayAspects } from '@/services/ebayAspects';
import { ApprovalSelect } from './ApprovalSelect';

interface EbayAttributesEditorProps {
  fieldName: string;
  value: string;
  setFormValue: (fieldName: string, value: string) => void;
  syncFieldNames?: string[];
  disabled?: boolean;
  label?: string;
}

type AttributePresetId = 'cable' | 'speaker' | 'cd' | 'general-component';

interface AttributeTemplateRow {
  name: string;
  aliases?: string[];
  placeholder?: string;
  options?: readonly string[];
}

interface AttributePreset {
  id: AttributePresetId;
  label: string;
  rows: ReadonlyArray<AttributeTemplateRow>;
}

interface AttributeRow {
  name: string;
  value: string;
  placeholder: string;
  options?: readonly string[];
  lockedName: boolean;
}

const inputClass =
  'w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-400/30 disabled:cursor-not-allowed disabled:opacity-70';
const iconButtonClass = 'flex h-7 w-7 items-center justify-center rounded-md border border-[var(--line)] text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-45';

const YES_NO_OPTIONS = ['Yes', 'No'] as const;
const SPEAKER_TYPE_OPTIONS = [
  'Bookshelf',
  'Floorstanding',
  'Center Channel',
  'Satellite',
  'Subwoofer',
  'Studio Monitor',
  'Soundbar',
  'Full-Range',
  'Outdoor',
  'In-Wall',
  'In-Ceiling',
] as const;
const SPEAKER_CONNECTIVITY_OPTIONS = [
  'Wired',
  'Bluetooth',
  'Wi-Fi',
  'USB',
  '3.5 mm Jack',
  'RCA',
  'XLR',
  'Banana Jack',
  'Speakon',
  'Ethernet',
] as const;

const ATTRIBUTE_PRESETS: ReadonlyArray<AttributePreset> = [
  {
    id: 'cable',
    label: 'Cable Listing',
    rows: [
      { name: 'Brand', placeholder: 'AudioQuest' },
      { name: 'Cable Type', placeholder: 'Interconnect' },
      { name: 'Connector A Type', placeholder: 'XLR Male' },
      { name: 'Connector B Type', placeholder: 'XLR Female' },
      { name: 'Cable Length, meters', placeholder: '1.5' },
      { name: 'Bi-Wire', options: YES_NO_OPTIONS },
      { name: 'Model', placeholder: 'Red River' },
    ],
  },
  {
    id: 'speaker',
    label: 'Speaker Listing',
    rows: [
      { name: 'Brand', placeholder: 'KEF' },
      { name: 'Type', options: SPEAKER_TYPE_OPTIONS },
      { name: 'Connectivity', options: SPEAKER_CONNECTIVITY_OPTIONS },
      { name: 'Model', placeholder: 'LS50 Meta' },
    ],
  },
  {
    id: 'cd',
    label: 'CD Listing',
    rows: [
      { name: 'Artist', placeholder: 'Miles Davis' },
      { name: 'Release Title', placeholder: 'Kind of Blue' },
      { name: 'Format', placeholder: 'CD' },
      { name: 'Grade', placeholder: 'VG+' },
    ],
  },
  {
    id: 'general-component',
    label: 'General Component Listing',
    rows: [
      { name: 'Brand', placeholder: 'McIntosh' },
      { name: 'Type', placeholder: 'Stereo Receiver' },
      { name: 'Model', placeholder: 'MAC4100' },
    ],
  },
] as const;

function normalizeAttributeName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function findTemplateRow(name: string): AttributeTemplateRow | undefined {
  const normalizedName = normalizeAttributeName(name);

  return ATTRIBUTE_PRESETS
    .flatMap((preset) => preset.rows)
    .find((row) => [row.name, ...(row.aliases ?? [])].some((candidate) => normalizeAttributeName(candidate) === normalizedName));
}

function createRowFromTemplate(template: AttributeTemplateRow, value = ''): AttributeRow {
  return {
    name: template.name,
    value,
    placeholder: template.placeholder ?? 'Enter attribute value',
    options: template.options,
    lockedName: true,
  };
}

function createCustomRow(name = '', value = ''): AttributeRow {
  const template = findTemplateRow(name);
  if (template) {
    return createRowFromTemplate(template, value);
  }

  return {
    name,
    value,
    placeholder: 'Enter attribute value',
    lockedName: false,
  };
}

function parseAttributeRows(raw: string): AttributeRow[] {
  return flattenEbayAspects(raw).map((row) => createCustomRow(row.name, row.value));
}

export function EbayAttributesEditor({
  fieldName,
  value,
  setFormValue,
  syncFieldNames = [],
  disabled = false,
  label = 'Attributes',
}: EbayAttributesEditorProps) {
  const [rows, setRows] = useState<AttributeRow[]>(() => parseAttributeRows(value));
  const [selectedPresetId, setSelectedPresetId] = useState<AttributePresetId | ''>('');

  useEffect(() => {
    setRows(parseAttributeRows(value));
  }, [value]);

  function commitRows(nextRows: AttributeRow[]) {
    setRows(nextRows);

    const serialized = serializeEbayAspects(nextRows.map((row) => ({ name: row.name, value: row.value })));
    const uniqueFieldNames = Array.from(new Set([fieldName, ...syncFieldNames]));
    uniqueFieldNames.forEach((candidateFieldName) => {
      setFormValue(candidateFieldName, serialized);
    });
  }

  function updateRow(index: number, patch: Partial<AttributeRow>) {
    const nextRows = rows.map((row, rowIndex) => {
      if (rowIndex !== index) return row;

      const nextName = patch.name ?? row.name;
      const matchedTemplate = findTemplateRow(nextName);
      if (!matchedTemplate) {
        return {
          ...row,
          ...patch,
          placeholder: patch.placeholder ?? row.placeholder,
          options: patch.options ?? row.options,
        };
      }

      return {
        ...row,
        ...patch,
        name: matchedTemplate.name,
        placeholder: matchedTemplate.placeholder ?? row.placeholder,
        options: matchedTemplate.options,
        lockedName: row.lockedName || patch.lockedName === true,
      };
    });

    commitRows(nextRows);
  }

  function addCustomRow() {
    commitRows([...rows, createCustomRow()]);
  }

  function clearOrRemoveRow(index: number) {
    const targetRow = rows[index];
    if (!targetRow) return;

    if (targetRow.lockedName) {
      updateRow(index, { value: '' });
      return;
    }

    const nextRows = rows.filter((_, rowIndex) => rowIndex !== index);
    commitRows(nextRows);
  }

  function clearAllRows() {
    commitRows([]);
    setSelectedPresetId('');
  }

  function applyPreset() {
    if (!selectedPresetId) return;

    const preset = ATTRIBUTE_PRESETS.find((candidate) => candidate.id === selectedPresetId);
    if (!preset) return;

    const nextRows = [...rows];

    preset.rows.forEach((template) => {
      const targetNames = [template.name, ...(template.aliases ?? [])].map(normalizeAttributeName);
      const existingIndex = nextRows.findIndex((row) => targetNames.includes(normalizeAttributeName(row.name)));

      if (existingIndex === -1) {
        nextRows.push(createRowFromTemplate(template));
        return;
      }

      nextRows[existingIndex] = {
        ...nextRows[existingIndex],
        name: template.name,
        placeholder: template.placeholder ?? nextRows[existingIndex]?.placeholder ?? 'Enter attribute value',
        options: template.options,
        lockedName: true,
      };
    });

    commitRows(nextRows);
  }

  const filledRowCount = rows.filter((row) => row.name.trim() && row.value.trim()).length;

  return (
    <details className="col-span-1 rounded-lg border border-[var(--line)] bg-white/5 md:col-span-2" open>
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]">
        <span className="inline-flex items-center gap-2">
          <span>{label}</span>
          <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[0.68rem] font-medium text-[var(--muted)]">
            {filledRowCount} filled
          </span>
        </span>
      </summary>
      <div className="flex flex-col gap-3 border-t border-[var(--line)] px-3 py-3">
        <p className="m-0 text-[0.74rem] leading-5 text-[var(--muted)]">
          eBay item specifics used for buyer filters and product attributes. Choose a preset to add the common rows for that listing type.
        </p>

        <div className="grid grid-cols-1 gap-3 rounded-lg border border-[var(--line)] bg-[var(--bg)] p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <label className="flex flex-col gap-2">
            <span className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Add Default Attributes</span>
            <ApprovalSelect
              selectClassName={`${inputClass} appearance-none pr-12`}
              value={selectedPresetId}
              onChange={(event) => setSelectedPresetId(event.target.value as AttributePresetId | '')}
              disabled={disabled}
            >
              <option value="">Select a listing type</option>
              {ATTRIBUTE_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>{preset.label}</option>
              ))}
            </ApprovalSelect>
          </label>
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={applyPreset}
              disabled={disabled || !selectedPresetId}
              className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-medium text-[var(--ink)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add defaults
            </button>
            <button
              type="button"
              onClick={clearAllRows}
              disabled={disabled || rows.every((row) => !row.name.trim() && !row.value.trim())}
              className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-medium text-[var(--muted)] transition-colors hover:border-rose-400/45 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear attributes
            </button>
          </div>
        </div>

        {rows.map((row, index) => (
          <div
            key={`${row.lockedName ? 'locked' : 'custom'}-${row.name || 'row'}-${index}`}
            className="rounded-lg border border-[var(--line)] bg-[var(--bg)] p-3"
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(180px,0.9fr)_minmax(0,1.4fr)_auto] md:items-start">
              <input
                className={inputClass}
                value={row.name}
                onChange={(event) => updateRow(index, { name: event.target.value })}
                placeholder={row.lockedName ? 'Attribute name' : 'Custom attribute name'}
                disabled={disabled || row.lockedName}
                aria-label={`Attribute name ${index + 1}`}
              />
              {row.options ? (
                <ApprovalSelect
                  selectClassName={`${inputClass} appearance-none pr-12`}
                  value={row.value}
                  onChange={(event) => updateRow(index, { value: event.target.value })}
                  disabled={disabled}
                >
                  <option value="">Select a value</option>
                  {row.options.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </ApprovalSelect>
              ) : (
                <input
                  className={inputClass}
                  value={row.value}
                  onChange={(event) => updateRow(index, { value: event.target.value })}
                  placeholder={row.placeholder}
                  disabled={disabled}
                  aria-label={`Attribute value ${index + 1}`}
                />
              )}
              <button
                type="button"
                className={`self-start ${iconButtonClass}`}
                onClick={() => clearOrRemoveRow(index)}
                disabled={disabled}
                aria-label={row.lockedName ? `Clear ${row.name || `attribute ${index + 1}`}` : `Remove attribute ${index + 1}`}
                title={row.lockedName ? 'Clear value' : 'Remove row'}
              >
                ×
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addCustomRow}
          disabled={disabled}
          className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--line)] py-2 text-[0.78rem] font-medium text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add custom attribute
        </button>
      </div>
    </details>
  );
}