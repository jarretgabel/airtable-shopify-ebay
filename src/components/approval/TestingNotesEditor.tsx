import { useEffect, useState } from 'react';
import { parseKeyFeatureEntries } from '@/services/shopifyBodyHtml';

interface TestingNotesEditorProps {
  fieldName: string;
  value: string;
  setFormValue: (fieldName: string, value: string) => void;
  disabled?: boolean;
  label?: string;
}

interface TestingNotesTemplateRow {
  feature: string;
  aliases?: string[];
  placeholder?: string;
  helperText?: string;
  multiline?: boolean;
}

interface TestingNotesRow {
  feature: string;
  value: string;
  placeholder: string;
  helperText: string;
  multiline: boolean;
  lockedFeature: boolean;
}

const DEFAULT_TESTING_NOTES_ROWS: ReadonlyArray<TestingNotesTemplateRow> = [
  {
    feature: 'Cosmetic Condition',
    aliases: ['Cosmetic Condition (1-10)'],
    placeholder: '8/10',
    helperText: '1-10 on the Audiogon scale. Fill this in while testing.',
  },
  {
    feature: 'Functional Notes',
    placeholder: 'Describe testing results and any quirks.',
    helperText: 'Fill this in while testing.',
    multiline: true,
  },
  {
    feature: 'Voltage',
    placeholder: '120V',
  },
  {
    feature: 'Serial #',
    aliases: ['Serial Number'],
    placeholder: 'Enter serial number',
  },
  {
    feature: 'Original Box',
    placeholder: 'Yes / No',
    helperText: 'Fill this in while testing.',
  },
  {
    feature: 'Manual',
    placeholder: 'Yes / No',
    helperText: 'Fill this in while testing.',
  },
  {
    feature: 'Remote Control',
    placeholder: 'Yes / No',
    helperText: 'Fill this in while testing. Leave blank to keep it out of the listing.',
  },
  {
    feature: 'Shipping Method',
    aliases: ['Shipping Method Notes'],
    placeholder: 'USPS Standard, FedEx Ground (Domestic) / USPS Priority, Ebay Standard Delivery (International)',
    helperText: 'Usually stays the same, but keep it editable for special cases.',
    multiline: true,
  },
  {
    feature: 'Shipping Dimensions',
    aliases: ['Shipping Dimensions Notes'],
    placeholder: 'Enter dimensions from testing',
    helperText: 'Fill this in while testing.',
  },
  {
    feature: 'Shipping Weight',
    placeholder: 'Enter boxed shipping weight',
    helperText: 'Fill this in while testing.',
  },
] as const;

const inputClass =
  'w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-400/30 disabled:cursor-not-allowed disabled:opacity-70';
const helperTextClass = 'text-[0.74rem] leading-5 text-[var(--muted)]';
const iconButtonClass = 'flex h-7 w-7 items-center justify-center rounded-md border border-[var(--line)] text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-45';

function normalizeFeatureName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function shouldSerializeAsJson(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized.includes('json') || normalized.endsWith('_json');
}

function createLockedRow(template: TestingNotesTemplateRow, value = ''): TestingNotesRow {
  return {
    feature: template.feature,
    value,
    placeholder: template.placeholder ?? '',
    helperText: template.helperText ?? '',
    multiline: Boolean(template.multiline),
    lockedFeature: true,
  };
}

function createCustomRow(feature = '', value = ''): TestingNotesRow {
  return {
    feature,
    value,
    placeholder: 'Custom note value',
    helperText: '',
    multiline: false,
    lockedFeature: false,
  };
}

function parseTestingNotes(raw: string): TestingNotesRow[] {
  const parsedEntries = parseKeyFeatureEntries(raw);
  const usedEntryIndexes = new Set<number>();

  const lockedRows = DEFAULT_TESTING_NOTES_ROWS.map((template) => {
    const aliases = [template.feature, ...(template.aliases ?? [])].map(normalizeFeatureName);
    const matchedEntryIndex = parsedEntries.findIndex((entry, index) => {
      if (usedEntryIndexes.has(index)) return false;
      return aliases.includes(normalizeFeatureName(entry.feature));
    });

    if (matchedEntryIndex === -1) {
      return createLockedRow(template);
    }

    usedEntryIndexes.add(matchedEntryIndex);
    return createLockedRow(template, parsedEntries[matchedEntryIndex]?.value ?? '');
  });

  const customRows = parsedEntries
    .filter((_entry, index) => !usedEntryIndexes.has(index))
    .map((entry) => createCustomRow(entry.feature, entry.value));

  return [...lockedRows, ...customRows];
}

function serializeTestingNotes(rows: TestingNotesRow[], fieldName: string): string {
  const normalizedRows = rows
    .map((row) => ({
      feature: row.feature.trim(),
      value: row.value.trim(),
      lockedFeature: row.lockedFeature,
    }))
    .filter((row) => (row.lockedFeature ? row.value.length > 0 : row.feature.length > 0 && row.value.length > 0))
    .map(({ feature, value }) => ({ feature, value }));

  if (normalizedRows.length === 0) return '';

  if (shouldSerializeAsJson(fieldName)) {
    return JSON.stringify(normalizedRows);
  }

  const escapeCsvCell = (cell: string): string => {
    if (!/[",\n\r]/.test(cell)) return cell;
    return `"${cell.replace(/"/g, '""')}"`;
  };

  return normalizedRows
    .map((row) => `${escapeCsvCell(row.feature)},${escapeCsvCell(row.value)}`)
    .join('\n');
}

export function TestingNotesEditor({
  fieldName,
  value,
  setFormValue,
  disabled = false,
  label = 'Testing Notes',
}: TestingNotesEditorProps) {
  const [rows, setRows] = useState<TestingNotesRow[]>(() => parseTestingNotes(value));

  useEffect(() => {
    setRows(parseTestingNotes(value));
  }, [value]);

  function commitRows(nextRows: TestingNotesRow[]) {
    setRows(nextRows);
    setFormValue(fieldName, serializeTestingNotes(nextRows, fieldName));
  }

  function updateRow(index: number, patch: Partial<TestingNotesRow>) {
    const nextRows = rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row));
    commitRows(nextRows);
  }

  function addRow() {
    commitRows([...rows, createCustomRow()]);
  }

  function clearOrRemoveRow(index: number) {
    const targetRow = rows[index];
    if (!targetRow) return;

    if (targetRow.lockedFeature) {
      updateRow(index, {
        feature: DEFAULT_TESTING_NOTES_ROWS[index]?.feature ?? targetRow.feature,
        value: '',
      });
      return;
    }

    commitRows(rows.filter((_, rowIndex) => rowIndex !== index));
  }

  const filledRowCount = rows.filter((row) => row.value.trim().length > 0).length;

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
          Default testing rows stay available here, and you can still add custom note rows when a listing needs something extra.
        </p>
        {rows.map((row, index) => (
          <div
            key={`${row.lockedFeature ? 'locked' : 'custom'}-${row.feature || 'row'}-${index}`}
            className="rounded-lg border border-[var(--line)] bg-[var(--bg)] p-3"
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(180px,0.9fr)_minmax(0,1.4fr)_auto] md:items-start">
              <input
                className={inputClass}
                value={row.feature}
                onChange={(event) => updateRow(index, { feature: event.target.value })}
                placeholder={row.lockedFeature ? 'Testing note label' : 'Custom testing note label'}
                disabled={disabled}
                aria-label={`Testing note label ${index + 1}`}
              />
              <div className="min-w-0">
                {row.multiline ? (
                  <textarea
                    className={`${inputClass} min-h-[88px] resize-y leading-[1.4]`}
                    value={row.value}
                    onChange={(event) => updateRow(index, { value: event.target.value })}
                    placeholder={row.placeholder}
                    disabled={disabled}
                    aria-label={`Testing note value ${index + 1}`}
                  />
                ) : (
                  <input
                    className={inputClass}
                    value={row.value}
                    onChange={(event) => updateRow(index, { value: event.target.value })}
                    placeholder={row.placeholder}
                    disabled={disabled}
                    aria-label={`Testing note value ${index + 1}`}
                  />
                )}
              </div>
              <button
                type="button"
                className={`self-start ${iconButtonClass}`}
                onClick={() => clearOrRemoveRow(index)}
                disabled={disabled}
                aria-label={row.lockedFeature ? `Clear ${row.feature || `testing note ${index + 1}`}` : `Remove testing note ${index + 1}`}
                title={row.lockedFeature ? 'Clear value' : 'Remove row'}
              >
                ×
              </button>
            </div>

            {row.helperText ? <p className={`mt-2 mb-0 ${helperTextClass}`}>{row.helperText}</p> : null}
          </div>
        ))}

        <button
          type="button"
          onClick={addRow}
          disabled={disabled}
          className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--line)] py-2 text-[0.78rem] font-medium text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add testing note
        </button>
      </div>
    </details>
  );
}