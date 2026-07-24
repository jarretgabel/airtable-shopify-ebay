import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AirtableEmbeddedForm } from '@/components/tabs/AirtableEmbeddedForm';

vi.mock('@/services/manualIntakeForm', () => ({
  loadManualIntakeFormOptionSets: vi.fn(),
  loadManualIntakeFormValues: vi.fn(),
  submitManualIntakeForm: vi.fn(),
}));

import {
  loadManualIntakeFormOptionSets,
  loadManualIntakeFormValues,
  submitManualIntakeForm,
} from '@/services/manualIntakeForm';
import { createManualIntakeFormDefaults } from '@/components/tabs/manual-intake/manualIntakeFormSchema';

const OPTION_SETS = {
  'Component Type': ['Amplifier', 'Receiver'],
  'Original Box': ['Yes', 'No'],
  Manual: ['Included', 'Missing'],
  Remote: ['Included', 'Missing'],
  'Power Cable': ['Included', 'Missing'],
  'Shipping Method': ['Freight', 'UPS'],
  'Seller Location': ['Greater NYC'],
  'How Did You Hear': ['Friend'],
  'Original Owner': ['Yes', 'No'],
  'Smoke Exposure': ['Smoke Free', 'Unknown'],
};

describe('AirtableEmbeddedForm grouped intake', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadManualIntakeFormOptionSets).mockResolvedValue(OPTION_SETS);
  });

  it('submits one Airtable record per grouped item card', async () => {
    vi.mocked(submitManualIntakeForm)
      .mockResolvedValueOnce({ recordId: 'rec-group-1', action: 'created' })
      .mockResolvedValueOnce({ recordId: 'rec-group-2', action: 'created' });

    render(<AirtableEmbeddedForm />);

    await screen.findAllByRole('button', { name: 'Add Another Item' });

    fireEvent.change(screen.getByLabelText('Pick Up ID *'), { target: { value: 'PU-GROUP-1' } });
    fireEvent.change(screen.getByLabelText('Cost *'), { target: { value: '2500' } });

    fireEvent.change(screen.getByLabelText('Make *'), { target: { value: 'McIntosh' } });
    fireEvent.change(screen.getByLabelText('Model *'), { target: { value: 'MC275' } });
    fireEvent.change(screen.getByPlaceholderText('Search component types'), { target: { value: 'Amplifier' } });

    fireEvent.click(screen.getAllByRole('button', { name: 'Add Another Item' })[0]!);

    fireEvent.change(screen.getAllByLabelText('Make *')[1]!, { target: { value: 'Marantz' } });
    fireEvent.change(screen.getAllByLabelText('Model *')[1]!, { target: { value: 'Model 8B' } });
    fireEvent.change(screen.getAllByPlaceholderText('Search component types')[1]!, { target: { value: 'Amplifier' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create Intake' }));

    await waitFor(() => {
      expect(submitManualIntakeForm).toHaveBeenCalledTimes(2);
    });

    expect(submitManualIntakeForm).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        pickUpNumber: 'PU-GROUP-1',
        cost: '2500',
        make: 'McIntosh',
        model: 'MC275',
        componentType: 'Amplifier',
      }),
    );

    expect(submitManualIntakeForm).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        pickUpNumber: 'PU-GROUP-1',
        cost: '2500',
        make: 'Marantz',
        model: 'Model 8B',
        componentType: 'Amplifier',
      }),
    );

    expect(await screen.findByText('Grouped intake saved to Airtable. 2 records created.')).toBeInTheDocument();
  });

  it('duplicates item fields into a new card', async () => {
    render(<AirtableEmbeddedForm />);

    await screen.findAllByRole('button', { name: 'Add Another Item' });

    fireEvent.change(screen.getByLabelText('Make *'), { target: { value: 'Accuphase' } });
    fireEvent.change(screen.getByLabelText('Model *'), { target: { value: 'E-202' } });
    fireEvent.change(screen.getByPlaceholderText('Search component types'), { target: { value: 'Amplifier' } });

    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));

    const makeInputs = screen.getAllByLabelText('Make *') as HTMLInputElement[];
    const modelInputs = screen.getAllByLabelText('Model *') as HTMLInputElement[];
    const componentTypeInputs = screen.getAllByPlaceholderText('Search component types') as HTMLInputElement[];

    expect(makeInputs).toHaveLength(2);
    expect(makeInputs[1]!.value).toBe('Accuphase');
    expect(modelInputs[1]!.value).toBe('E-202');
    expect(componentTypeInputs[1]!.value).toBe('Amplifier');
  });

  it('shows grouped item validation errors and blocks submit when a later item is incomplete', async () => {
    render(<AirtableEmbeddedForm />);

    await screen.findAllByRole('button', { name: 'Add Another Item' });

    fireEvent.change(screen.getByLabelText('Pick Up ID *'), { target: { value: 'PU-GROUP-VAL' } });
    fireEvent.change(screen.getByLabelText('Cost *'), { target: { value: '1800' } });

    fireEvent.change(screen.getByLabelText('Make *'), { target: { value: 'Luxman' } });
    fireEvent.change(screen.getByLabelText('Model *'), { target: { value: 'L-550AX' } });
    fireEvent.change(screen.getByPlaceholderText('Search component types'), { target: { value: 'Amplifier' } });

    fireEvent.click(screen.getAllByRole('button', { name: 'Add Another Item' })[0]!);

    fireEvent.change(screen.getAllByLabelText('Model *')[1]!, { target: { value: 'Incomplete Item' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create Intake' }));

    expect(await screen.findByText('Fix the highlighted grouped intake items and try again.')).toBeInTheDocument();
    expect(await screen.findByText('Item 2 is missing Make, Component Type.')).toBeInTheDocument();
    expect(submitManualIntakeForm).not.toHaveBeenCalled();
  });

  it('collapses and expands grouped item details', async () => {
    render(<AirtableEmbeddedForm />);

    await screen.findAllByRole('button', { name: 'Add Another Item' });

    fireEvent.change(screen.getByLabelText('Make *'), { target: { value: 'Nakamichi' } });

    fireEvent.click(screen.getByRole('button', { name: 'Collapse' }));

    expect(screen.queryByLabelText('Make *')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Expand' }));

    expect(screen.getByLabelText('Make *')).toBeInTheDocument();
  });

  it('shows an Open Listing Details button in edit mode for listing-phase records', async () => {
    vi.mocked(loadManualIntakeFormValues).mockResolvedValue({
      source: 'used-gear-workflow',
      itemTitle: 'McIntosh MA6900',
      workflowSource: 'Manual Entry',
      workflowStatus: 'Awaiting Pre-Listing Review',
      jotFormSubmissionId: '',
      values: createManualIntakeFormDefaults(),
    });

    const onOpenListingDetail = vi.fn();

    render(<AirtableEmbeddedForm recordId="rec-listing-1" onOpenListingDetail={onOpenListingDetail} />);

    const button = await screen.findByRole('button', { name: 'Open Listing Details' });
    fireEvent.click(button);

    expect(onOpenListingDetail).toHaveBeenCalledWith('rec-listing-1');
  });

  it('does not show Open Listing Details button in edit mode for non-listing workflow status', async () => {
    vi.mocked(loadManualIntakeFormValues).mockResolvedValue({
      source: 'used-gear-workflow',
      itemTitle: 'McIntosh MA6900',
      workflowSource: 'Manual Entry',
      workflowStatus: 'Testing In Progress',
      jotFormSubmissionId: '',
      values: createManualIntakeFormDefaults(),
    });

    render(<AirtableEmbeddedForm recordId="rec-testing-1" onOpenListingDetail={vi.fn()} />);

    await screen.findByRole('button', { name: 'Save Intake' });
    expect(screen.queryByRole('button', { name: 'Open Listing Details' })).not.toBeInTheDocument();
  });
});
