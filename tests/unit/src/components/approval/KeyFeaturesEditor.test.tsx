import { fireEvent, render, screen } from '@testing-library/react';
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

    expect(screen.getByText('Suggested from component type:')).toBeInTheDocument();
    expect(screen.getByText('Stereo Receiver')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add defaults' }));

    expect(setFormValue).toHaveBeenCalledWith(
      'Key Features',
      'Power Output,\nInputs,\nPhono Stage,\nIncludes,',
    );
  });

  it('renders an emphasized helper notice when provided', () => {
    render(
      <KeyFeaturesEditor
        keyFeaturesFieldName="Key Features"
        keyFeaturesValue=""
        setFormValue={vi.fn()}
        helperNotice={<span>Automatic Mapping Make and Model come from the listing record automatically.</span>}
      />,
    );

    expect(screen.getByText(/Automatic Mapping/i)).toBeInTheDocument();
    expect(screen.getByText(/Make and Model come from the listing record automatically/i)).toBeInTheDocument();
  });
});
