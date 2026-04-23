import { forwardRef, useRef } from 'react';

export interface DatePickerFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  value: string;
  onValueChange: (value: string) => void;
  pickerLabel: string;
  containerClassName?: string;
  inputClassName?: string;
  buttonClassName?: string;
}

function CalendarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 14h.01" />
      <path d="M12 14h.01" />
      <path d="M16 14h.01" />
      <path d="M8 18h.01" />
      <path d="M12 18h.01" />
      <path d="M16 18h.01" />
    </svg>
  );
}

export const DatePickerField = forwardRef<HTMLInputElement, DatePickerFieldProps>(function DatePickerField(
  {
    value,
    onValueChange,
    pickerLabel,
    containerClassName = 'flex gap-2',
    inputClassName,
    buttonClassName,
    ...inputProps
  },
  ref,
) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const setInputRef = (node: HTMLInputElement | null) => {
    inputRef.current = node;

    if (typeof ref === 'function') {
      ref(node);
      return;
    }

    if (ref) {
      ref.current = node;
    }
  };

  const openDatePicker = () => {
    const input = inputRef.current;
    if (!input) return;

    input.focus();
    if (typeof input.showPicker === 'function') {
      input.showPicker();
    }
  };

  return (
    <div className={containerClassName}>
      <input
        {...inputProps}
        ref={setInputRef}
        type="date"
        className={inputClassName}
        value={value}
        onChange={(event) => onValueChange(event.currentTarget.value)}
      />
      <button
        type="button"
        className={buttonClassName}
        onClick={openDatePicker}
        aria-label={`Open ${pickerLabel} date picker`}
        title={`Open ${pickerLabel} date picker`}
      >
        <CalendarIcon />
      </button>
    </div>
  );
});