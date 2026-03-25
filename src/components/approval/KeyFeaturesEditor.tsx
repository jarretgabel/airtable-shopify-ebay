import { useMemo, useState } from 'react';
import { parseKeyFeatureEntries } from '@/services/shopifyBodyHtml';

interface KeyFeatureRow {
  feature: string;
  value: string;
}

interface KeyFeaturesEditorProps {
  keyFeaturesFieldName: string;
  keyFeaturesValue: string;
  setFormValue: (fieldName: string, value: string) => void;
  disabled?: boolean;
  label?: string;
}

const inputClass =
  'w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-400/30 disabled:cursor-not-allowed disabled:opacity-70';
const labelClass = 'mb-1 block text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]';
const iconButtonClass = 'flex h-7 w-7 items-center justify-center rounded-md border border-[var(--line)] text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-45';
const dragHandleClass = 'flex h-7 w-7 cursor-grab items-center justify-center rounded-md border border-[var(--line)] text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] active:cursor-grabbing';

function parseKeyFeatures(raw: string): KeyFeatureRow[] {
  const rows = parseKeyFeatureEntries(raw).map((entry) => ({
    feature: entry.feature,
    value: entry.value,
  }));

  return rows.length > 0 ? rows : [{ feature: '', value: '' }];
}

function serializeKeyFeatures(rows: KeyFeatureRow[]): string {
  const normalized = rows
    .map((row) => ({
      feature: row.feature,
      value: row.value,
    }))
    .filter((row) => row.feature.trim() || row.value.trim());

  if (normalized.length === 0) return '';

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
  disabled = false,
  label = 'Key Features',
}: KeyFeaturesEditorProps) {
  const rows = useMemo(() => parseKeyFeatures(keyFeaturesValue), [keyFeaturesValue]);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  function updateRow(index: number, patch: Partial<KeyFeatureRow>) {
    const next = rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row));
    setFormValue(keyFeaturesFieldName, serializeKeyFeatures(next));
  }

  function addRow() {
    setFormValue(keyFeaturesFieldName, serializeKeyFeatures([...rows, { feature: '', value: '' }]));
  }

  function removeRow(index: number) {
    const next = rows.filter((_, rowIndex) => rowIndex !== index);
    setFormValue(keyFeaturesFieldName, serializeKeyFeatures(next));
  }

  function moveRow(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;

    const next = [...rows];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    setFormValue(keyFeaturesFieldName, serializeKeyFeatures(next));
  }

  function moveRowToIndex(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= rows.length) return;
    if (toIndex < 0 || toIndex >= rows.length) return;

    const next = [...rows];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setFormValue(keyFeaturesFieldName, serializeKeyFeatures(next));
  }

  return (
    <div className="col-span-1 flex flex-col gap-2 md:col-span-2">
      <span className={labelClass}>{label}</span>
        {rows.map((row, index) => (
          <div
            key={index}
            className={`grid grid-cols-1 gap-3 rounded-lg border border-[var(--line)] bg-[var(--bg)] p-3 md:grid-cols-[1fr_1fr_auto] ${draggingIndex === index ? 'opacity-60' : ''}`}
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
            <input
              className={inputClass}
              value={row.feature}
              onChange={(event) => updateRow(index, { feature: event.target.value })}
              placeholder="Feature (e.g. Condition)"
              disabled={disabled}
              aria-label={`Key feature ${index + 1}`}
            />
            <input
              className={inputClass}
              value={row.value}
              onChange={(event) => updateRow(index, { value: event.target.value })}
              placeholder="Value (e.g. Used Excellent)"
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
  );
}
