import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UsedGearWorkflowQueueTab } from '@/components/tabs/UsedGearWorkflowQueueTab';

vi.mock('@/components/tabs/airtable/UsedGearWorkflowProgressSection', () => ({
  UsedGearWorkflowProgressSection: ({
    queueMode,
    searchTerm,
    sortMode,
  }: {
    queueMode: string;
    searchTerm?: string;
    sortMode?: string;
  }) => (
    <div
      data-testid="progress-section"
      data-queue-mode={queueMode}
      data-search-term={searchTerm ?? ''}
      data-sort-mode={sortMode ?? ''}
    />
  ),
}));

function renderQueueTab(initialEntry: string, queueMode: 'testing' | 'photography') {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <UsedGearWorkflowQueueTab
        queueMode={queueMode}
        currentUserName="Taylor Reviewer"
        onOpenManualIntake={vi.fn()}
        onOpenTestingForm={vi.fn()}
        onOpenPhotosForm={vi.fn()}
        onOpenOperationalRecord={vi.fn()}
        onOpenListingsRecord={vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe('UsedGearWorkflowQueueTab', () => {
  it('renders the testing overview shell with post-intake holding guidance and URL-backed queue state', () => {
    renderQueueTab(
      '/workflow/testing?workflowTestingQueueSearch=tube&workflowTestingQueueSort=newest#used-gear-testing-queue',
      'testing',
    );

    expect(screen.getByRole('heading', { name: 'Testing Queue' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /how to use this queue/i })).not.toBeInTheDocument();
  expect(screen.queryByText('Working Rules')).not.toBeInTheDocument();

    const progressSection = screen.getByTestId('progress-section');
    expect(progressSection).toHaveAttribute('data-queue-mode', 'testing');
    expect(progressSection).toHaveAttribute('data-search-term', 'tube');
    expect(progressSection).toHaveAttribute('data-sort-mode', 'newest');
  });

  it('renders the photography overview shell with dedicated guidance and URL-backed queue state', () => {
    renderQueueTab(
      '/workflow/photography?workflowPhotographyQueueSearch=hero&workflowPhotographyQueueSort=oldest#used-gear-photography-queue',
      'photography',
    );

    expect(screen.getByRole('heading', { name: 'Photography Queue' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /how to use this queue/i })).not.toBeInTheDocument();

    const progressSection = screen.getByTestId('progress-section');
    expect(progressSection).toHaveAttribute('data-queue-mode', 'photography');
    expect(progressSection).toHaveAttribute('data-search-term', 'hero');
    expect(progressSection).toHaveAttribute('data-sort-mode', 'oldest');
  });
});