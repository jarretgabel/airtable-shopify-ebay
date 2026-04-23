import { forwardRef, useMemo } from 'react';

export interface ComponentTypeSearchFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'list'> {
  options: string[];
  value: string;
  listId: string;
  onValueChange: (value: string) => void;
  className?: string;
  helpClassName?: string;
}

const DEFAULT_HELP_CLASS = 'mt-1 text-xs text-[var(--muted)]';

export const ComponentTypeSearchField = forwardRef<HTMLInputElement, ComponentTypeSearchFieldProps>(function ComponentTypeSearchField(
  {
    options,
    value,
    listId,
    onValueChange,
    className,
    helpClassName = DEFAULT_HELP_CLASS,
    placeholder = 'Search component types',
    ...inputProps
  },
  ref,
) {
  const filteredOptions = useMemo(() => {
    const search = value.trim().toLowerCase();
    if (!search) {
      return options.slice(0, 12);
    }

    return options.filter((option) => option.toLowerCase().includes(search)).slice(0, 12);
  }, [options, value]);

  return (
    <>
      <input
        {...inputProps}
        ref={ref}
        type="text"
        list={listId}
        className={className}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onValueChange(event.currentTarget.value)}
      />
      <datalist id={listId}>
        {options.map((option, index) => (
          <option key={`${option}-${index}`} value={option} />
        ))}
      </datalist>
      <p className={helpClassName}>
        {filteredOptions.length > 0
          ? `Matching options: ${filteredOptions.join(', ')}`
          : 'No matching component types.'}
      </p>
    </>
  );
});