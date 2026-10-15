import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AudiogonRatingSelect } from '@/components/tabs/AudiogonRatingSelect';
import {
  AUDIOGON_RATINGS, audiogonRatingDescription, getAudiogonRatingOptions, getAudiogonRatingUpdate,
} from '@contracts/audiogonRating';

const options = AUDIOGON_RATINGS.map(audiogonRatingDescription);

describe('AudiogonRatingSelect', () => {
  it('offers ten compact grades and displays every complete description on selection', () => {
    const onChange = vi.fn();
    const { rerender } = render(<AudiogonRatingSelect value="" options={options} onChange={onChange} className="" />);
    const select = screen.getByRole('combobox', { name: 'Audiogon Rating' });
    expect(within(select).getAllByRole('option')).toHaveLength(11);
    for (const value of options) {
      fireEvent.change(select, { target: { value } });
      expect(onChange).toHaveBeenLastCalledWith(value);
      rerender(<AudiogonRatingSelect value={value} options={options} onChange={onChange} className="" />);
      expect(screen.getByText(value)).toHaveClass('whitespace-normal');
      expect(select).toHaveAccessibleDescription(value);
    }
    expect(within(select).getByRole('option', { name: '10/10: Mint' })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: '1/10: Shot' })).toBeInTheDocument();
  });

  it.each(['8', '8/10', '8/10: Very Good - Flawless front face', 'Custom saved condition'])(
    'retains the exact legacy value %s without changing it on render',
    (value) => {
      const onChange = vi.fn();
      render(<AudiogonRatingSelect value={value} options={options} onChange={onChange} className="" />);
      expect(screen.getByRole('combobox')).toHaveValue(value);
      expect(screen.getByRole('option', { name: `Current: ${value}` })).toBeInTheDocument();
      expect(screen.getByText(/Existing saved value is retained/)).toBeInTheDocument();
      expect(onChange).not.toHaveBeenCalled();
    },
  );

  it('preserves disabled and optional-blank behavior', () => {
    render(<AudiogonRatingSelect value="" options={options} onChange={vi.fn()} className="" disabled />);
    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(screen.getByRole('combobox')).toHaveValue('');
  });
});

describe('Audiogon rating field compatibility', () => {
  it('uses exact existing short-score or numeric choices when full labels are not configured', () => {
    const scores = AUDIOGON_RATINGS.map((r) => `${r.score}/10`);
    const numbers = AUDIOGON_RATINGS.map((r) => String(r.score));
    expect(getAudiogonRatingOptions(scores)).toEqual(scores);
    expect(getAudiogonRatingOptions(numbers)).toEqual(numbers);
    expect(getAudiogonRatingOptions([...numbers, ...scores, ...options])).toEqual(options);
  });

  it('fails explicitly rather than inventing missing Airtable choices', () => {
    expect(() => getAudiogonRatingOptions(options.slice(1))).toThrow('missing the 10/10 choice');
  });

  it('omits unchanged or blank ratings and preserves a changed description as one choice', () => {
    expect(getAudiogonRatingUpdate('8/10', '8/10')).toBeUndefined();
    expect(getAudiogonRatingUpdate('', '8/10')).toBeUndefined();
    expect(getAudiogonRatingUpdate(options[2], '8/10')).toEqual([options[2]]);
  });
});
