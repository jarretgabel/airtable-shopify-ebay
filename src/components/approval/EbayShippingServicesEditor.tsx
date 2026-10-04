import { SHIPPING_SERVICE_FIELD } from '@/stores/approvalStore';

interface EbayShippingServicesEditorProps {
  domesticService1FieldName?: string;
  domesticService2FieldName?: string;
  internationalService1FieldName?: string;
  internationalService2FieldName?: string;
  values: Record<string, string>;
  setFormValue: (fieldName: string, value: string) => void;
  disabled?: boolean;
}

const DOMESTIC_SERVICE_OPTIONS = [
  'UPS Ground',
  'UPS 3-Day Select',
] as const;

const INTERNATIONAL_SERVICE_OPTIONS = [
  'International',
  'USPS Priority Mail International',
  'eBay International Standard Delivery',
] as const;

const selectClass = 'w-full appearance-none rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 pr-10 text-sm font-normal text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-400/30 disabled:cursor-not-allowed disabled:opacity-60';

function uniqueOptions(baseOptions: readonly string[], selectedValues: string[]): string[] {
  const seen = new Set<string>();
  return [...baseOptions, ...selectedValues]
    .map((option) => option.trim())
    .filter((option) => {
      if (!option) return false;
      const key = option.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function getSelectedValues(values: Record<string, string>, fieldNames: Array<string | undefined>): string[] {
  return fieldNames
    .map((fieldName) => (fieldName ? values[fieldName] ?? '' : ''))
    .map((value) => value.trim())
    .filter(Boolean);
}

export function EbayShippingServicesEditor({
  domesticService1FieldName,
  domesticService2FieldName,
  internationalService1FieldName,
  internationalService2FieldName,
  values,
  setFormValue,
  disabled = false,
}: EbayShippingServicesEditorProps) {
  const domesticFieldNames = [domesticService1FieldName, domesticService2FieldName];
  const internationalFieldNames = [internationalService1FieldName, internationalService2FieldName];

  const selectedDomesticServices = getSelectedValues(values, domesticFieldNames);
  const selectedInternationalServices = getSelectedValues(values, internationalFieldNames);

  const domesticOptions = uniqueOptions(DOMESTIC_SERVICE_OPTIONS, selectedDomesticServices);
  const internationalOptions = uniqueOptions(INTERNATIONAL_SERVICE_OPTIONS, selectedInternationalServices);

  function writeSingleService(fieldNames: Array<string | undefined>, nextValue: string, updateFallback: boolean) {
    const [primaryFieldName, secondaryFieldName] = fieldNames;
    if (primaryFieldName) setFormValue(primaryFieldName, nextValue);
    if (secondaryFieldName) setFormValue(secondaryFieldName, '');
    if (updateFallback) setFormValue(SHIPPING_SERVICE_FIELD, nextValue);
  }

  const selectedDomesticService = selectedDomesticServices[0] ?? '';
  const selectedInternationalService = selectedInternationalServices[0] ?? '';

  return (
    <section className="col-span-1 rounded-lg border border-[var(--line)] bg-white/5 md:col-span-2">
      <div className="border-b border-[var(--line)] px-3 py-2 text-sm font-semibold text-[var(--ink)]">
        Shipping Services
      </div>
      <div className="grid grid-cols-1 gap-4 px-3 py-3 md:grid-cols-2">
        <section className="rounded-lg border border-[var(--line)] bg-[var(--bg)] p-3">
          <label className="flex flex-col gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
            Domestic
            <span className="relative">
              <select
                className={selectClass}
                value={selectedDomesticService}
                onChange={(event) => writeSingleService(domesticFieldNames, event.target.value, true)}
                disabled={disabled}
              >
                <option value="">Select a domestic service</option>
                {domesticOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <span className="pointer-events-none absolute right-4 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 border-b-2 border-r-2 border-[var(--muted)]" aria-hidden="true" />
            </span>
          </label>
        </section>

        <section className="rounded-lg border border-[var(--line)] bg-[var(--bg)] p-3">
          <label className="flex flex-col gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
            International
            <span className="relative">
              <select
                className={selectClass}
                value={selectedInternationalService}
                onChange={(event) => writeSingleService(internationalFieldNames, event.target.value, false)}
                disabled={disabled}
              >
                <option value="">No international shipping</option>
                {internationalOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <span className="pointer-events-none absolute right-4 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 border-b-2 border-r-2 border-[var(--muted)]" aria-hidden="true" />
            </span>
          </label>
        </section>
      </div>
    </section>
  );
}