import { useId } from 'react';
import { audiogonRatingDescription, audiogonRatingLabel, findAudiogonRating } from '@contracts/audiogonRating';
import { tabFormHelpClass } from '@/components/tabs/uiClasses';

export function AudiogonRatingSelect({
  value, options, onChange, className, disabled = false,
}: {
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  className: string;
  disabled?: boolean;
}) {
  const descriptionId = useId();
  const selectedRating = findAudiogonRating(value);
  const legacyValue = Boolean(value) && !options.includes(value);

  return (
    <>
      <select
        aria-label="Audiogon Rating"
        aria-describedby={value ? descriptionId : undefined}
        className={className}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        <option value="">Select a rating</option>
        {legacyValue ? <option value={value}>Current: {value}</option> : null}
        {options.map((option) => {
          const rating = findAudiogonRating(option);
          return <option key={option} value={option}>{rating ? audiogonRatingLabel(rating) : option}</option>;
        })}
      </select>
      {value ? (
        <p id={descriptionId} className={`${tabFormHelpClass} whitespace-normal break-words`} aria-live="polite">
          {selectedRating ? audiogonRatingDescription(selectedRating) : `Saved rating: ${value}`}
          {legacyValue ? ' Existing saved value is retained until you choose a rating.' : ''}
        </p>
      ) : null}
    </>
  );
}
