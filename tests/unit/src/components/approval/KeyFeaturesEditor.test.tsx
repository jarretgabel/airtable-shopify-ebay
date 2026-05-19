import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { KeyFeaturesEditor } from '@/components/approval/KeyFeaturesEditor';

describe('KeyFeaturesEditor', () => {
  it('shows a component-type-driven preset and adds missing default rows', () => {
    const setFormValue = vi.fn();

    render(
      <KeyFeaturesEditor
        keyFeaturesFieldName="Key Features"
        keyFeaturesValue=""
        setFormValue={setFormValue}
        componentTypeValue="Stereo Receiver"
      />,
    );

    expect(screen.getByText('Other Key Features')).toBeInTheDocument();
    expect(screen.getByText('Suggested from component type:')).toBeInTheDocument();
    expect(screen.getByText('Stereo Receiver')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add defaults' }));

    expect(setFormValue).toHaveBeenCalledWith(
      'Key Features',
      'Power Output,\nInputs,\nPhono Stage,',
    );
  });

  it('renders an emphasized helper notice when provided', () => {
    render(
      <KeyFeaturesEditor
        keyFeaturesFieldName="Key Features"
        keyFeaturesValue=""
        setFormValue={vi.fn()}
          helperNotice={<span>Automatic Mapping Make, Model, Serial Number, Condition, Component Type, Cosmetic Notes, Includes, Original Box, Manual, Remote, Power Cable, Voltage, and Audiogon Rating come from the listing record automatically.</span>}
      />,
    );

    expect(screen.getByText(/Automatic Mapping/i)).toBeInTheDocument();
    expect(screen.getByText(/Make, Model, Serial Number, Condition, Component Type, Cosmetic Notes, Includes, Original Box, Manual, Remote, Power Cable, Voltage, and Audiogon Rating come from the listing record automatically/i)).toBeInTheDocument();
  });

  it('hides configured auto-mapped rows while preserving them in serialized output', () => {
    const setFormValue = vi.fn();

    render(
      <KeyFeaturesEditor
        keyFeaturesFieldName="Key Features"
        keyFeaturesValue={[
          'Make,Marantz',
          'Includes,Original box',
          'Condition,Excellent',
        ].join('\n')}
        setFormValue={setFormValue}
        hiddenFeatureNames={['Make', 'Includes']}
      />,
    );

    expect(screen.queryByDisplayValue('Marantz')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Original box')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Condition')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Excellent')).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('Excellent'), { target: { value: 'Very Good' } });

    expect(setFormValue).toHaveBeenLastCalledWith(
      'Key Features',
      [
        'Make,Marantz',
        'Includes,Original box',
        'Condition,Very Good',
      ].join('\n'),
    );
  });

  it('warns when a user manually enters an auto-mapped feature name', () => {
    function ControlledEditor() {
      const [value, setValue] = useState('');

      return (
        <KeyFeaturesEditor
          keyFeaturesFieldName="Key Features"
          keyFeaturesValue={value}
          setFormValue={(_fieldName, nextValue) => setValue(nextValue)}
          hiddenFeatureNames={['Condition']}
        />
      );
    }

    render(<ControlledEditor />);

    fireEvent.change(screen.getByLabelText('Key feature 1'), { target: { value: 'Condition' } });

    expect(screen.getByLabelText('Key feature 1')).toHaveValue('Condition');
    expect(screen.getByText('Condition is auto-mapped from the listing. This manual value overrides the listing value in generated key features.')).toBeInTheDocument();
  });

  it('uses a non-auto-mapped feature example in the empty row placeholder', () => {
    render(
      <KeyFeaturesEditor
        keyFeaturesFieldName="Key Features"
        keyFeaturesValue=""
        setFormValue={vi.fn()}
      />,
    );

    expect(screen.getByPlaceholderText('Feature (e.g. Service History)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Value (e.g. Serviced in 2024)')).toBeInTheDocument();
  });
});
