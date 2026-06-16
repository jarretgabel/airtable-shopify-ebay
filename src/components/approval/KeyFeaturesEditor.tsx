import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { parseKeyFeatureEntries } from '@/services/shopifyBodyHtml';
import {
  detailDisclosureBodyClass,
  detailDisclosureClass,
  detailDisclosureSummaryClass,
} from '@/components/tabs/uiClasses';

interface KeyFeatureRow {
  feature: string;
  value: string;
}

interface KeyFeaturesEditorProps {
  keyFeaturesFieldName: string;
  keyFeaturesValue: string;
  setFormValue: (fieldName: string, value: string) => void;
  syncFieldNames?: string[];
  disabled?: boolean;
  label?: string;
  helperText?: string;
  helperNotice?: ReactNode;
  headerAction?: ReactNode;
  componentTypeValue?: string;
  hiddenFeatureNames?: string[];
}

type KeyFeaturePresetId =
  | 'general-component'
  | 'receiver-amplifier'
  | 'turntable'
  | 'speaker'
  | 'cable'
  | 'cd-media'
  | 'dac-streamer'
  | 'phono-stage';

interface KeyFeaturePreset {
  id: KeyFeaturePresetId;
  label: string;
  rows: ReadonlyArray<KeyFeatureRow>;
}

const inputClass =
  'w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-400/30 disabled:cursor-not-allowed disabled:opacity-70';
const iconButtonClass = 'flex h-7 w-7 items-center justify-center rounded-md border border-[var(--line)] text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-45';
const dragHandleClass = 'flex h-7 w-7 cursor-grab items-center justify-center rounded-md border border-[var(--line)] text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] active:cursor-grabbing';

const AUTO_INCLUDED_FEATURE_NAMES = new Set([
  'make',
  'model',
  'serial number',
  'condition',
  'component type',
  'cosmetic notes',
  'includes',
  'original box',
  'remote',
  'power cable',
  'manual',
  'voltage',
  'audiogon rating',
]);

const KEY_FEATURE_PRESETS: ReadonlyArray<KeyFeaturePreset> = [
  {
    id: 'general-component',
    label: 'General Component',
    rows: [
      { feature: 'Service History', value: '' },
      { feature: 'Finish', value: '' },
      { feature: 'Best For', value: '' },
    ],
  },
  {
    id: 'receiver-amplifier',
    label: 'Receiver / Amplifier',
    rows: [
      { feature: 'Power Output', value: '' },
      { feature: 'Inputs', value: '' },
      { feature: 'Phono Stage', value: '' },
    ],
  },
  {
    id: 'turntable',
    label: 'Turntable',
    rows: [
      { feature: 'Cartridge', value: '' },
      { feature: 'Tonearm', value: '' },
      { feature: 'Dust Cover', value: '' },
    ],
  },
  {
    id: 'speaker',
    label: 'Speaker',
    rows: [
      { feature: 'Driver Complement', value: '' },
      { feature: 'Impedance', value: '' },
      { feature: 'Sensitivity', value: '' },
      { feature: 'Finish', value: '' },
    ],
  },
  {
    id: 'cable',
    label: 'Cable',
    rows: [
      { feature: 'Cable Type', value: '' },
      { feature: 'Termination', value: '' },
      { feature: 'Length', value: '' },
      { feature: 'Shielding', value: '' },
    ],
  },
  {
    id: 'cd-media',
    label: 'CD / Media',
    rows: [
      { feature: 'Artist', value: '' },
      { feature: 'Release Title', value: '' },
      { feature: 'Format', value: '' },
      { feature: 'Edition', value: '' },
    ],
  },
  {
    id: 'dac-streamer',
    label: 'DAC / Streamer',
    rows: [
      { feature: 'Inputs', value: '' },
      { feature: 'DAC Chip', value: '' },
      { feature: 'Streaming Support', value: '' },
    ],
  },
  {
    id: 'phono-stage',
    label: 'Phono Stage',
    rows: [
      { feature: 'MM / MC Support', value: '' },
      { feature: 'Gain Options', value: '' },
      { feature: 'Loading Options', value: '' },
    ],
  },
] as const;

function normalizeFeatureKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function isAutoIncludedFeature(value: string): boolean {
  return AUTO_INCLUDED_FEATURE_NAMES.has(normalizeFeatureKey(value));
}

function stripAutoIncludedRows(rows: ReadonlyArray<KeyFeatureRow>): KeyFeatureRow[] {
  return rows.filter((row) => !isAutoIncludedFeature(row.feature));
}

function normalizeHiddenFeatureNames(hiddenFeatureNames: readonly string[]): Set<string> {
  return new Set(hiddenFeatureNames.map((value) => normalizeFeatureKey(value)).filter(Boolean));
}

function splitVisibleAndHiddenRows(raw: string, hiddenFeatureNames: Set<string>): {
  visibleRows: KeyFeatureRow[];
  hiddenRows: KeyFeatureRow[];
} {
  const parsedRows = parseKeyFeatureEntries(raw).map((entry) => ({
    feature: entry.feature,
    value: entry.value,
  }));

  if (hiddenFeatureNames.size === 0) {
    return {
      visibleRows: parsedRows.length > 0 ? parsedRows : [{ feature: '', value: '' }],
      hiddenRows: [],
    };
  }

  const visibleRows = parsedRows.filter((row) => !hiddenFeatureNames.has(normalizeFeatureKey(row.feature)));
  const hiddenRows = parsedRows.filter((row) => hiddenFeatureNames.has(normalizeFeatureKey(row.feature)));

  return {
    visibleRows: visibleRows.length > 0 ? visibleRows : [{ feature: '', value: '' }],
    hiddenRows,
  };
}

function inferPresetIdFromComponentType(componentTypeValue: string): KeyFeaturePresetId {
  const normalized = componentTypeValue.trim().toLowerCase();

  if (
    normalized.includes('dac')
    || normalized.includes('streamer')
    || normalized.includes('network player')
    || normalized.includes('digital audio')
  ) {
    return 'dac-streamer';
  }

  if (normalized.includes('phono stage') || normalized.includes('phono preamp')) {
    return 'phono-stage';
  }

  if (normalized.includes('speaker') || normalized.includes('subwoofer') || normalized.includes('monitor') || normalized.includes('soundbar')) {
    return 'speaker';
  }

  if (normalized.includes('cable') || normalized.includes('interconnect') || normalized.includes('power cord') || normalized.includes('speaker wire')) {
    return 'cable';
  }

  if (normalized.includes('turntable')) {
    return 'turntable';
  }

  if (normalized.includes('cd') || normalized.includes('disc') || normalized.includes('media')) {
    return 'cd-media';
  }

  if (
    normalized.includes('receiver')
    || normalized.includes('amplifier')
    || normalized.includes('integrated')
    || normalized.includes('preamp')
    || normalized.includes('power amp')
    || normalized.includes('phono')
  ) {
    return 'receiver-amplifier';
  }

  return 'general-component';
}

function shouldSerializeKeyFeaturesAsJson(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized.includes('json') || normalized.endsWith('_json');
}

function serializeKeyFeatures(rows: KeyFeatureRow[], fieldName: string): string {
  const normalized = rows
    .map((row) => ({
      feature: row.feature,
      value: row.value,
    }))
    .filter((row) => row.feature.trim() || row.value.trim());

  if (normalized.length === 0) return '';

  if (shouldSerializeKeyFeaturesAsJson(fieldName)) {
    return JSON.stringify(normalized);
  }

  const escapeCsvCell = (cell: string): string => {
    if (!/[",\n\r]/.test(cell)) return cell;
    return `"${cell.replace(/"/g, '""')}"`;
  };

  return normalized
    .map((row) => `${escapeCsvCell(row.feature)},${escapeCsvCell(row.value)}`)
    .join('\n');
}

export function KeyFeaturesEditor({
  keyFeaturesFieldName,
  keyFeaturesValue,
  setFormValue,
  syncFieldNames = [],
  disabled = false,
  label = 'Other Key Features',
  helperText,
  helperNotice,
  headerAction,
  componentTypeValue,
  hiddenFeatureNames = [],
}: KeyFeaturesEditorProps) {
  const hiddenFeatureNamesKey = hiddenFeatureNames
    .map((value) => normalizeFeatureKey(value))
    .filter(Boolean)
    .join('|');
  const normalizedHiddenFeatureNames = useMemo(
    () => normalizeHiddenFeatureNames(hiddenFeatureNames),
    [hiddenFeatureNamesKey],
  );
  const initialRows = splitVisibleAndHiddenRows(keyFeaturesValue, normalizedHiddenFeatureNames);
  const [rows, setRows] = useState<KeyFeatureRow[]>(initialRows.visibleRows);
  const [hiddenRows, setHiddenRows] = useState<KeyFeatureRow[]>(initialRows.hiddenRows);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<KeyFeaturePresetId | ''>(componentTypeValue ? inferPresetIdFromComponentType(componentTypeValue) : '');
  const lastCommittedValueRef = useRef(keyFeaturesValue);
  const availablePresets = useMemo(
    () => KEY_FEATURE_PRESETS.map((preset) => ({
      ...preset,
      rows: stripAutoIncludedRows(preset.rows),
    })),
    [],
  );

  useEffect(() => {
    if (keyFeaturesValue === lastCommittedValueRef.current) return;

    const nextRows = splitVisibleAndHiddenRows(keyFeaturesValue, normalizedHiddenFeatureNames);
    setRows(nextRows.visibleRows);
    setHiddenRows(nextRows.hiddenRows);
    lastCommittedValueRef.current = keyFeaturesValue;
  }, [keyFeaturesValue, normalizedHiddenFeatureNames]);

  useEffect(() => {
    setSelectedPresetId(componentTypeValue ? inferPresetIdFromComponentType(componentTypeValue) : '');
  }, [componentTypeValue]);

  function commitRows(nextRows: KeyFeatureRow[]) {
    setRows(nextRows);

    const allRows = [...hiddenRows, ...nextRows];
    const currentFieldValue = serializeKeyFeatures(allRows, keyFeaturesFieldName);
    lastCommittedValueRef.current = currentFieldValue;

    const uniqueFieldNames = Array.from(new Set([keyFeaturesFieldName, ...syncFieldNames]));
    for (const fieldName of uniqueFieldNames) {
      const nextFieldValue = fieldName === keyFeaturesFieldName
        ? currentFieldValue
        : serializeKeyFeatures(allRows, fieldName);
      setFormValue(fieldName, nextFieldValue);
    }
  }

  function updateRow(index: number, patch: Partial<KeyFeatureRow>) {
    const next = rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row));
    commitRows(next);
  }

  function addRow() {
    commitRows([...rows, { feature: '', value: '' }]);
  }

  function applyPreset() {
    if (!selectedPresetId) return;

    const preset = availablePresets.find((candidate) => candidate.id === selectedPresetId);
    if (!preset) return;

    const nextRows = [...rows];
    const existingFeatureKeys = new Set(nextRows.map((row) => normalizeFeatureKey(row.feature)).filter(Boolean));

    preset.rows.forEach((row) => {
      const normalizedFeature = normalizeFeatureKey(row.feature);
      if (existingFeatureKeys.has(normalizedFeature)) return;
      nextRows.push({ ...row });
      existingFeatureKeys.add(normalizedFeature);
    });

    commitRows(nextRows);
  }

  function removeRow(index: number) {
    const next = rows.filter((_, rowIndex) => rowIndex !== index);
    commitRows(next.length > 0 ? next : [{ feature: '', value: '' }]);
  }

  function moveRow(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;

    const next = [...rows];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    commitRows(next);
  }

  function moveRowToIndex(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= rows.length) return;
    if (toIndex < 0 || toIndex >= rows.length) return;

    const next = [...rows];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    commitRows(next);
  }

  const filledRowCount = rows.filter((row) => row.feature.trim() || row.value.trim()).length;

  return (
    <details className={`${detailDisclosureClass} col-span-1 md:col-span-2`} open>
      <summary className={`${detailDisclosureSummaryClass} flex list-none items-center justify-between gap-3`}>
        <span className="inline-flex items-center gap-2">
          <span>{label}</span>
          <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[0.68rem] font-medium text-[var(--muted)]">
            {filledRowCount} rows
          </span>
        </span>
        {headerAction ? <span onClick={(event) => event.stopPropagation()}>{headerAction}</span> : null}
      </summary>
      <div className={`${detailDisclosureBodyClass} flex flex-col gap-2`}>
        {helperText ? (
          <p className="m-0 text-[0.74rem] leading-5 text-[var(--muted)]">
            {helperText}
          </p>
        ) : null}
        {helperNotice ? (
          <div className="rounded-lg border border-amber-400/35 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-100">
            {helperNotice}
          </div>
        ) : null}
        {componentTypeValue ? (
          <div className="rounded-lg border border-[var(--line)] bg-[var(--bg)] p-3">
            <div className="space-y-1">
              <span className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Suggested Defaults</span>
              <p className="m-0 text-xs text-[var(--muted)]">
                Suggested from component type: <span className="font-medium text-[var(--ink)]">{componentTypeValue}</span>
              </p>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <label className="flex flex-col gap-2">
                <span className="sr-only">Select key feature preset</span>
                <select
                  className={`${inputClass} appearance-none pr-12`}
                  value={selectedPresetId}
                  onChange={(event) => setSelectedPresetId(event.target.value as KeyFeaturePresetId | '')}
                  disabled={disabled}
                  aria-label="Select key feature preset"
                >
                  <option value="">Select a feature preset</option>
                  {availablePresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>{preset.label}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={applyPreset}
                disabled={disabled || !selectedPresetId}
                className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-medium text-[var(--ink)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add defaults
              </button>
            </div>
          </div>
        ) : null}
        {rows.map((row, index) => (
          (() => {
            const autoIncludedFeature = isAutoIncludedFeature(row.feature);
            const overrideAutoMappedRow = normalizedHiddenFeatureNames.has(normalizeFeatureKey(row.feature));

            return (
          <div
            key={index}
            className={`grid grid-cols-1 gap-3 rounded-lg border bg-[var(--bg)] p-3 md:grid-cols-[1fr_1fr_auto] ${overrideAutoMappedRow ? 'border-amber-400/60 bg-amber-500/10' : 'border-[var(--line)]'} ${draggingIndex === index ? 'opacity-60' : ''}`}
            onDragOver={(event) => {
              if (disabled) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(event) => {
              if (disabled || draggingIndex === null) return;
              event.preventDefault();
              moveRowToIndex(draggingIndex, index);
              setDraggingIndex(null);
            }}
          >
            <div className="flex flex-col gap-2">
              <input
                className={`${inputClass} ${overrideAutoMappedRow || autoIncludedFeature ? 'border-amber-400/70 focus:border-amber-300 focus:ring-amber-300/30' : ''}`}
                value={row.feature}
                onChange={(event) => updateRow(index, { feature: event.target.value })}
                placeholder="Feature (e.g. Service History)"
                disabled={disabled}
                aria-label={`Key feature ${index + 1}`}
                aria-describedby={overrideAutoMappedRow || autoIncludedFeature ? `key-feature-warning-${index}` : undefined}
              />
              {overrideAutoMappedRow ? (
                <p
                  id={`key-feature-warning-${index}`}
                  className="m-0 rounded-md border border-amber-400/35 bg-amber-500/10 px-2.5 py-2 text-[0.72rem] leading-5 text-amber-100"
                >
                  {row.feature.trim() || 'This feature'} is auto-mapped from the listing. This manual value overrides the listing value in generated key features.
                </p>
              ) : autoIncludedFeature ? (
                <p
                  id={`key-feature-warning-${index}`}
                  className="m-0 rounded-md border border-amber-400/35 bg-amber-500/10 px-2.5 py-2 text-[0.72rem] leading-5 text-amber-100"
                >
                  {row.feature.trim() || 'This feature'} is auto-mapped from the listing. Add it here only when you want to override the listing value.
                </p>
              ) : null}
            </div>
            <input
              className={`${inputClass} ${overrideAutoMappedRow ? 'border-amber-400/70 focus:border-amber-300 focus:ring-amber-300/30' : ''}`}
              value={row.value}
              onChange={(event) => updateRow(index, { value: event.target.value })}
              placeholder="Value (e.g. Serviced in 2024)"
              disabled={disabled}
              aria-label={`Key value ${index + 1}`}
            />
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                className={dragHandleClass}
                disabled={disabled}
                draggable={!disabled}
                onDragStart={(event) => {
                  setDraggingIndex(index);
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', String(index));
                }}
                onDragEnd={() => setDraggingIndex(null)}
                aria-label={`Drag feature ${index + 1}`}
                title="Drag to reorder"
              >
                ::
              </button>
              <button
                type="button"
                className={iconButtonClass}
                onClick={() => moveRow(index, -1)}
                disabled={disabled || index === 0}
                aria-label={`Move feature ${index + 1} up`}
                title="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                className={iconButtonClass}
                onClick={() => moveRow(index, 1)}
                disabled={disabled || index === rows.length - 1}
                aria-label={`Move feature ${index + 1} down`}
                title="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                className={iconButtonClass}
                onClick={() => removeRow(index)}
                disabled={disabled}
                aria-label={`Remove feature ${index + 1}`}
                title="Remove"
              >
                ×
              </button>
            </div>
          </div>
            );
          })()
        ))}

        <button
          type="button"
          onClick={addRow}
          disabled={disabled}
          className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--line)] py-2 text-[0.78rem] font-medium text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add feature
        </button>
      </div>
    </details>
  );
}
