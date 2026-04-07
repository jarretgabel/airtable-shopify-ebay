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

const checkboxClass = 'h-4 w-4 rounded border border-[var(--line)] bg-[var(--panel)] text-[var(--accent)] focus:ring-2 focus:ring-blue-400/30 disabled:cursor-not-allowed disabled:opacity-60';

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

  function writeFieldGroup(fieldNames: Array<string | undefined>, nextValues: string[]) {
    fieldNames.forEach((fieldName, index) => {
      if (!fieldName) return;
      setFormValue(fieldName, nextValues[index] ?? '');
    });

    const fallbackSelected = nextValues[0] ?? '';
    setFormValue(SHIPPING_SERVICE_FIELD, fallbackSelected);
  }

  function toggleOption(option: string, currentValues: string[], fieldNames: Array<string | undefined>) {
    const alreadySelected = currentValues.some((value) => value.toLowerCase() === option.toLowerCase());
    const nextValues = alreadySelected
      ? currentValues.filter((value) => value.toLowerCase() !== option.toLowerCase())
      : currentValues.length < 2
        ? [...currentValues, option]
        : currentValues;

    writeFieldGroup(fieldNames, nextValues);
  }

  return (
    <section className="col-span-1 rounded-lg border border-[var(--line)] bg-white/5 md:col-span-2">
      <div className="border-b border-[var(--line)] px-3 py-2 text-sm font-semibold text-[var(--ink)]">
        Shipping Services
      </div>
      <div className="grid grid-cols-1 gap-4 px-3 py-3 md:grid-cols-2">
        <section className="rounded-lg border border-[var(--line)] bg-[var(--bg)] p-3">
          <div className="mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Domestic</div>
          <div className="flex flex-col gap-2">
            {domesticOptions.map((option) => {
              const checked = selectedDomesticServices.some((value) => value.toLowerCase() === option.toLowerCase());
              const disableUnchecked = !checked && selectedDomesticServices.length >= 2;
              return (
                <label key={option} className="flex items-center gap-2 text-sm text-[var(--ink)]">
                  <input
                    className={checkboxClass}
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleOption(option, selectedDomesticServices, domesticFieldNames)}
                    disabled={disabled || disableUnchecked}
                  />
                  <span>{option}</span>
                </label>
              );
            })}
          </div>
          <p className="mb-0 mt-3 text-[0.74rem] leading-5 text-[var(--muted)]">Select up to two domestic services.</p>
        </section>

        <section className="rounded-lg border border-[var(--line)] bg-[var(--bg)] p-3">
          <div className="mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">International</div>
          <div className="flex flex-col gap-2">
            {internationalOptions.map((option) => {
              const checked = selectedInternationalServices.some((value) => value.toLowerCase() === option.toLowerCase());
              const disableUnchecked = !checked && selectedInternationalServices.length >= 2;
              return (
                <label key={option} className="flex items-center gap-2 text-sm text-[var(--ink)]">
                  <input
                    className={checkboxClass}
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleOption(option, selectedInternationalServices, internationalFieldNames)}
                    disabled={disabled || disableUnchecked}
                  />
                  <span>{option}</span>
                </label>
              );
            })}
          </div>
          <p className="mb-0 mt-3 text-[0.74rem] leading-5 text-[var(--muted)]">Select up to two international services.</p>
        </section>
      </div>
    </section>
  );
}