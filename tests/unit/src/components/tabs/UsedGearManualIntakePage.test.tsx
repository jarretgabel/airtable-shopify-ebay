import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UsedGearManualIntakePage } from '@/components/tabs/UsedGearManualIntakePage';

vi.mock('@/components/tabs/AirtableEmbeddedForm', () => ({
  AirtableEmbeddedForm: ({ recordId }: { recordId?: string | null }) => (
    <div data-testid="airtable-embedded-form" data-record-id={recordId ?? ''}>
      Embedded form
    </div>
  ),
}));

describe('UsedGearManualIntakePage', () => {
  it('keeps page guidance collapsed by default and links to the workflow guide', () => {
    render(
      <MemoryRouter>
        <UsedGearManualIntakePage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Manual Intake' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /how to use this page/i })).toBeInTheDocument();
    expect(screen.queryByText('Operator guide')).not.toBeInTheDocument();
    expect(screen.queryByText('Routing Outcomes')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /how to use this page/i }));

    expect(screen.getByText('Routing Outcomes')).toBeInTheDocument();
    expect(screen.getByText('Parking Lot 1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Workflow Guide' })).toHaveAttribute('href', '/workflow-guide');
    expect(screen.getByTestId('airtable-embedded-form')).toHaveAttribute('data-record-id', '');
  });
});