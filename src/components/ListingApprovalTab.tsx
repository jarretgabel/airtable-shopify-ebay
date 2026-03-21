import { useEffect, useMemo, useState } from 'react';
import airtableService from '@/services/airtable';
import { getOffers } from '@/services/ebay';
import { AirtableRecord } from '@/types/airtable';

const DEFAULT_TABLE_REFERENCE = '3yTb0JkzUMFNnS/viw21kEduXKNub4Vn';
const SHIPPING_SERVICE_FIELD = '__Shipping Services__';

const ITEM_CONDITION_OPTIONS = ['Used', 'New', 'Open Box', 'For Parts or not working'];
const SHIPPING_SERVICE_OPTIONS = [
  'UPS Ground',
  'UPS 3-Day Select',
  'International',
  'USPS Priority Mail International',
  'eBay International Standard Delivery',
];
const FALLBACK_LISTING_FORMAT_OPTIONS = ['Buy It Now', 'Auction'];

interface ListingApprovalTabProps {
  selectedRecordId: string | null;
  onSelectRecord: (recordId: string) => void;
  onBackToList: () => void;
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function inferFieldKind(value: unknown): 'boolean' | 'number' | 'json' | 'text' {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (Array.isArray(value)) return 'json';
  if (value && typeof value === 'object') return 'json';
  return 'text';
}

function toFormValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value) || typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function fromFormValue(raw: string, kind: 'boolean' | 'number' | 'json' | 'text'): unknown {
  if (raw === '') return null;

  if (kind === 'boolean') {
    return raw === 'true';
  }

  if (kind === 'number') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (kind === 'json') {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  return raw;
}

function getDropdownOptions(fieldName: string): string[] | null {
  const normalized = fieldName.trim().toLowerCase();

  if (normalized === 'item condition') {
    return ITEM_CONDITION_OPTIONS;
  }

  return null;
}

function isAllowOffersField(fieldName: string): boolean {
  return fieldName.trim().toLowerCase() === 'allow offers';
}

function normalizeListingFormat(raw: string): string {
  const normalized = raw.trim().toUpperCase();
  if (normalized === 'FIXED_PRICE') return 'Buy It Now';
  if (normalized === 'AUCTION') return 'Auction';
  return raw.trim();
}

function isShippingServiceField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'domestic service 1'
    || normalized === 'domestic service 2'
    || normalized === 'international service 1'
    || normalized === 'international service 2';
}

function mapShippingServiceToFields(values: Record<string, string>): Record<string, string> {
  const selected = values[SHIPPING_SERVICE_FIELD] ?? '';

  return {
    ...values,
    'Domestic Service 1': selected === 'UPS Ground' || selected === 'UPS 3-Day Select' ? selected : '',
    'Domestic Service 2': '',
    'International Service 1': selected === 'International' || selected === 'USPS Priority Mail International' || selected === 'eBay International Standard Delivery'
      ? selected
      : '',
    'International Service 2': '',
  };
}

export function ListingApprovalTab({
  selectedRecordId,
  onSelectRecord,
  onBackToList,
}: ListingApprovalTabProps) {
  const tableReference = (import.meta.env.VITE_AIRTABLE_APPROVAL_TABLE_REF as string | undefined)?.trim()
    || DEFAULT_TABLE_REFERENCE;
  const fallbackTableName = (import.meta.env.VITE_AIRTABLE_APPROVAL_TABLE_NAME as string | undefined)?.trim()
    || (import.meta.env.VITE_AIRTABLE_TABLE_NAME as string | undefined)?.trim()
    || 'Table 1';

  const [records, setRecords] = useState<AirtableRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listingFormatOptions, setListingFormatOptions] = useState<string[]>(FALLBACK_LISTING_FORMAT_OPTIONS);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [fieldKinds, setFieldKinds] = useState<Record<string, 'boolean' | 'number' | 'json' | 'text'>>({});

  const allFieldNames = useMemo(() => {
    const names = new Set<string>();
    records.forEach((record) => {
      Object.keys(record.fields).forEach((fieldName) => names.add(fieldName));
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [records]);

  const selectedRecord = useMemo(
    () => records.find((record) => record.id === selectedRecordId) ?? null,
    [records, selectedRecordId],
  );

  const approvedFieldName = useMemo(() => {
    const match = allFieldNames.find((fieldName) => fieldName.toLowerCase() === 'approved');
    return match ?? 'approved';
  }, [allFieldNames]);

  async function loadRecords() {
    try {
      setLoading(true);
      setError(null);
      const data = await airtableService.getRecordsFromReference(tableReference, fallbackTableName);
      setRecords(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load listing records');
    } finally {
      setLoading(false);
    }
  }

  async function loadListingFormatOptions() {
    try {
      const offersPage = await getOffers(undefined, 100);
      const formats = offersPage.offers
        .map((offer) => offer.format)
        .filter((format): format is string => Boolean(format))
        .map((format) => normalizeListingFormat(format));

      const uniqueFormats = Array.from(new Set([...FALLBACK_LISTING_FORMAT_OPTIONS, ...formats]))
        .filter((format) => format.length > 0);

      if (uniqueFormats.length > 0) {
        setListingFormatOptions(uniqueFormats);
      }
    } catch {
      // Keep fallback options when eBay session is unavailable.
      setListingFormatOptions(FALLBACK_LISTING_FORMAT_OPTIONS);
    }
  }

  function hydrateRecordForm(record: AirtableRecord) {
    const nextValues: Record<string, string> = {};
    const nextKinds: Record<string, 'boolean' | 'number' | 'json' | 'text'> = {};

    allFieldNames.forEach((fieldName) => {
      const value = record.fields[fieldName];
      nextValues[fieldName] = toFormValue(value);
      nextKinds[fieldName] = inferFieldKind(value);
    });

    nextValues[SHIPPING_SERVICE_FIELD] =
      nextValues['Domestic Service 1']
      || nextValues['Domestic Service 2']
      || nextValues['International Service 1']
      || nextValues['International Service 2']
      || '';
    nextKinds[SHIPPING_SERVICE_FIELD] = 'text';

    if (!nextValues[approvedFieldName]) {
      nextValues[approvedFieldName] = 'false';
      nextKinds[approvedFieldName] = 'boolean';
    }

    setFormValues(nextValues);
    setFieldKinds(nextKinds);
  }

  function openRecord(record: AirtableRecord) {
    hydrateRecordForm(record);
    onSelectRecord(record.id);
  }

  function buildPayload(values: Record<string, string>): Record<string, unknown> {
    const mappedValues = mapShippingServiceToFields(values);
    const payload: Record<string, unknown> = {};

    Object.entries(mappedValues).forEach(([fieldName, rawValue]) => {
      if (fieldName === SHIPPING_SERVICE_FIELD) {
        return;
      }

      const fieldKind = fieldKinds[fieldName] ?? 'text';
      payload[fieldName] = fromFormValue(rawValue, fieldKind);
    });

    return payload;
  }

  async function saveRecord(forceApproved: boolean) {
    if (!selectedRecord) return;

    try {
      setSaving(true);
      setError(null);

      const nextValues = {
        ...formValues,
        [approvedFieldName]: forceApproved ? 'true' : (formValues[approvedFieldName] || 'false'),
      };

      const payload = buildPayload(nextValues);
      await airtableService.updateRecordFromReference(
        tableReference,
        fallbackTableName,
        selectedRecord.id,
        payload,
      );

      await loadRecords();
      onBackToList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save listing record');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadRecords();
    loadListingFormatOptions();
  }, []);

  useEffect(() => {
    if (!selectedRecord) return;
    hydrateRecordForm(selectedRecord);
  }, [selectedRecord?.id, records]);

  if (selectedRecord) {
    return (
      <section className="panel listings-panel">
        <div className="approval-header">
          <button
            type="button"
            className="utility-button"
            onClick={onBackToList}
            disabled={saving}
          >
            Back to Listings
          </button>
          <div>
            <p className="approval-kicker">Listing Update</p>
            <h3 className="listing-title">{displayValue(selectedRecord.fields['Item Title'])}</h3>
            <p className="listing-subtitle">Record ID: <code>{selectedRecord.id}</code></p>
          </div>
        </div>

        {error && (
          <div className="error-panel" style={{ marginBottom: '0.9rem' }}>
            <p className="error-title">Save Error</p>
            <p className="error-message">{error}</p>
          </div>
        )}

        <div className="approval-form-grid">
          {allFieldNames.map((fieldName) => {
            if (isShippingServiceField(fieldName)) {
              return null;
            }

            const value = formValues[fieldName] ?? '';
            const kind = fieldKinds[fieldName] ?? 'text';
            const isLongText = kind === 'json' || value.length > 120;
            const dropdownOptions = fieldName.trim().toLowerCase() === 'listing format'
              ? listingFormatOptions
              : getDropdownOptions(fieldName);

            if (isAllowOffersField(fieldName)) {
              return (
                <label key={fieldName} className="approval-field">
                  <span className="approval-label">{fieldName}</span>
                  <select
                    className="approval-input"
                    value={value || 'false'}
                    onChange={(event) => {
                      setFormValues((prev) => ({
                        ...prev,
                        [fieldName]: event.target.value,
                      }));
                    }}
                    disabled={saving}
                  >
                    <option value="true">True</option>
                    <option value="false">False</option>
                  </select>
                </label>
              );
            }

            if (kind === 'boolean') {
              return (
                <label key={fieldName} className="approval-field">
                  <span className="approval-label">{fieldName}</span>
                  <select
                    className="approval-input"
                    value={value || 'false'}
                    onChange={(event) => {
                      setFormValues((prev) => ({ ...prev, [fieldName]: event.target.value }));
                    }}
                    disabled={saving}
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                </label>
              );
            }

            if (dropdownOptions) {
              const optionSet = new Set(dropdownOptions);
              const options = value && !optionSet.has(value)
                ? [value, ...dropdownOptions]
                : dropdownOptions;

              return (
                <label key={fieldName} className="approval-field">
                  <span className="approval-label">{fieldName}</span>
                  <select
                    className="approval-input"
                    value={value}
                    onChange={(event) => {
                      setFormValues((prev) => ({ ...prev, [fieldName]: event.target.value }));
                    }}
                    disabled={saving}
                  >
                    <option value="">Select an option</option>
                    {options.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
              );
            }

            if (isLongText) {
              return (
                <label key={fieldName} className="approval-field approval-field-full">
                  <span className="approval-label">{fieldName}</span>
                  <textarea
                    className="approval-input approval-input-textarea"
                    value={value}
                    onChange={(event) => {
                      setFormValues((prev) => ({ ...prev, [fieldName]: event.target.value }));
                    }}
                    disabled={saving}
                  />
                </label>
              );
            }

            return (
              <label key={fieldName} className="approval-field">
                <span className="approval-label">{fieldName}</span>
                <input
                  className="approval-input"
                  type={kind === 'number' ? 'number' : 'text'}
                  value={value}
                  onChange={(event) => {
                    setFormValues((prev) => ({ ...prev, [fieldName]: event.target.value }));
                  }}
                  disabled={saving}
                />
              </label>
            );
          })}

          <label className="approval-field">
            <span className="approval-label">Shipping Services</span>
            <select
              className="approval-input"
              value={formValues[SHIPPING_SERVICE_FIELD] ?? ''}
              onChange={(event) => {
                setFormValues((prev) => ({ ...prev, [SHIPPING_SERVICE_FIELD]: event.target.value }));
              }}
              disabled={saving}
            >
              <option value="">Select an option</option>
              {SHIPPING_SERVICE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="approval-actions">
          <button
            type="button"
            className="refresh-button"
            onClick={() => {
              const confirmed = window.confirm('Are you sure you want to save the listing details?');
              if (!confirmed) return;
              void saveRecord(false);
            }}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Updates'}
          </button>
          <button
            type="button"
            className="utility-button utility-button-accent"
            onClick={() => {
              const confirmed = window.confirm('Are you sure you want to approve this listing for publishing?');
              if (!confirmed) return;
              void saveRecord(true);
            }}
            disabled={saving}
          >
            {saving ? 'Approving...' : 'Approve Listing'}
          </button>
        </div>
      </section>
    );
  }

  return (
    <>
      {error && (
        <section className="panel error-panel">
          <p className="error-title">Error loading approval workflow</p>
          <p className="error-message">{error}</p>
        </section>
      )}

      {loading ? (
        <section className="panel loading-panel">
          <div className="loader" />
          <p>Loading listing approval queue...</p>
        </section>
      ) : (
        <section className="panel listings-panel">
          <div className="approval-header">
            <div>
              <p className="approval-kicker">Workflow</p>
              <h3 className="listing-title">Listing Update & Approval</h3>
              <p className="listing-subtitle">
                Source: <code>{tableReference}</code> · Table fallback: <code>{fallbackTableName}</code>
              </p>
            </div>
            <button type="button" className="refresh-button" onClick={loadRecords}>
              Refresh Queue
            </button>
          </div>

          <p className="listings-summary">
            <strong>{records.length}</strong> listing rows loaded.
          </p>

          <div className="shark-table-wrap">
            <table className="shark-table">
              <thead>
                <tr>
                  <th>Item Title</th>
                  <th>SKU</th>
                  <th>Approved</th>
                  <th>Condition</th>
                  <th>Format</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr
                    key={record.id}
                    className="shark-row approval-row"
                    onClick={() => openRecord(record)}
                  >
                    <td>{displayValue(record.fields['Item Title'])}</td>
                    <td>{displayValue(record.fields['Custom Label SKU'])}</td>
                    <td>{displayValue(record.fields[approvedFieldName])}</td>
                    <td>{displayValue(record.fields['Item Condition'])}</td>
                    <td>{displayValue(record.fields['Listing Format'])}</td>
                    <td>
                      <button
                        type="button"
                        className="approval-view-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectRecord(record.id);
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
