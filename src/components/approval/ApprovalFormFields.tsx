import {
  getDropdownOptions,
  isAllowOffersField,
  isShippingServiceField,
  SHIPPING_SERVICE_FIELD,
  SHIPPING_SERVICE_OPTIONS,
} from '@/stores/approvalStore';

const inputBaseClass =
  'w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-400/30 disabled:cursor-not-allowed disabled:opacity-70';
const labelClass = 'mb-1 block text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]';

interface ApprovalFormFieldsProps {
  allFieldNames: string[];
  formValues: Record<string, string>;
  fieldKinds: Record<string, 'boolean' | 'number' | 'json' | 'text'>;
  listingFormatOptions: string[];
  saving: boolean;
  setFormValue: (fieldName: string, value: string) => void;
}

export function ApprovalFormFields({
  allFieldNames,
  formValues,
  fieldKinds,
  listingFormatOptions,
  saving,
  setFormValue,
}: ApprovalFormFieldsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {allFieldNames.map((fieldName) => {
        if (isShippingServiceField(fieldName)) {
          return null;
        }

        const value = formValues[fieldName] ?? '';
        const kind = fieldKinds[fieldName] ?? 'text';
        const isLongText = kind === 'json' || value.length > 120;
        const dropdownOptions =
          fieldName.trim().toLowerCase() === 'listing format' ? listingFormatOptions : getDropdownOptions(fieldName);

        if (isAllowOffersField(fieldName) || kind === 'boolean') {
          return (
            <label key={fieldName} className="flex flex-col gap-1.5">
              <span className={labelClass}>{fieldName}</span>
              <select
                className={inputBaseClass}
                value={value || 'false'}
                onChange={(event) => setFormValue(fieldName, event.target.value)}
                disabled={saving}
              >
                <option value="true">{isAllowOffersField(fieldName) ? 'True' : 'true'}</option>
                <option value="false">{isAllowOffersField(fieldName) ? 'False' : 'false'}</option>
              </select>
            </label>
          );
        }

        if (dropdownOptions) {
          const optionSet = new Set(dropdownOptions);
          const options = value && !optionSet.has(value) ? [value, ...dropdownOptions] : dropdownOptions;

          return (
            <label key={fieldName} className="flex flex-col gap-1.5">
              <span className={labelClass}>{fieldName}</span>
              <select
                className={inputBaseClass}
                value={value}
                onChange={(event) => setFormValue(fieldName, event.target.value)}
                disabled={saving}
              >
                <option value="">Select an option</option>
                {options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          );
        }

        if (isLongText) {
          return (
            <label key={fieldName} className="col-span-1 flex flex-col gap-1.5 md:col-span-2">
              <span className={labelClass}>{fieldName}</span>
              <textarea
                className={`${inputBaseClass} min-h-[110px] resize-y font-mono leading-[1.4]`}
                value={value}
                onChange={(event) => setFormValue(fieldName, event.target.value)}
                disabled={saving}
              />
            </label>
          );
        }

        return (
          <label key={fieldName} className="flex flex-col gap-1.5">
            <span className={labelClass}>{fieldName}</span>
            <input
              className={inputBaseClass}
              type={kind === 'number' ? 'number' : 'text'}
              value={value}
              onChange={(event) => setFormValue(fieldName, event.target.value)}
              disabled={saving}
            />
          </label>
        );
      })}

      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Shipping Services</span>
        <select
          className={inputBaseClass}
          value={formValues[SHIPPING_SERVICE_FIELD] ?? ''}
          onChange={(event) => setFormValue(SHIPPING_SERVICE_FIELD, event.target.value)}
          disabled={saving}
        >
          <option value="">Select an option</option>
          {SHIPPING_SERVICE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
