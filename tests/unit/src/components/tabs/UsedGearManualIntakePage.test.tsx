import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
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
  it('renders the intake form without inline page guidance', () => {
    render(
      <MemoryRouter>
        <UsedGearManualIntakePage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Manual Intake' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /how to use this page/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Routing Outcomes')).not.toBeInTheDocument();
    expect(screen.getByTestId('airtable-embedded-form')).toHaveAttribute('data-record-id', '');
  });

  it('uses the shared intake title for record editing routes', () => {
    render(
      <MemoryRouter>
        <UsedGearManualIntakePage recordId="rec-intake-1" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Intake Record' })).toBeInTheDocument();
    expect(screen.getByTestId('airtable-embedded-form')).toHaveAttribute('data-record-id', 'rec-intake-1');
  });
});