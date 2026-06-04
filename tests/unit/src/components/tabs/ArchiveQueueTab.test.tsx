import { MemoryRouter, useLocation } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ArchiveQueueTab } from '@/components/tabs/ArchiveQueueTab';

vi.mock('@/components/tabs/airtable/UsedGearWorkflowPostPublishSection', () => ({
  ARCHIVE_OVERVIEW_SECTION_ID: 'used-gear-archive',
  ARCHIVE_SECTION_DEFINITIONS: [
    { key: 'shipped', id: 'used-gear-post-publish-shipped', title: 'Completed Shipments' },
  ],
  UsedGearWorkflowPostPublishSection: ({
    focusedBucket,
    queueTitle,
    queueNoun,
    focusedBucketNotice,
    searchPlaceholder,
    showSectionTitles,
  }: {
    focusedBucket?: string | null;
    queueTitle?: string;
    queueNoun?: string;
    focusedBucketNotice?: string;
    searchPlaceholder?: string;
    showSectionTitles?: boolean;
  }) => (
    <div>
      <div data-testid="archive-focused-bucket">{focusedBucket ?? ''}</div>
      <div data-testid="archive-queue-title">{queueTitle ?? ''}</div>
      <div data-testid="archive-queue-noun">{queueNoun ?? ''}</div>
      <div data-testid="archive-focused-notice">{focusedBucketNotice ?? ''}</div>
      <div data-testid="archive-search-placeholder">{searchPlaceholder ?? ''}</div>
      <div data-testid="archive-show-section-titles">{String(showSectionTitles ?? true)}</div>
    </div>
  ),
}));

function LocationState() {
  const location = useLocation();
  return <div data-testid="location-state">{`${location.pathname}${location.search}${location.hash}`}</div>;
}

describe('ArchiveQueueTab', () => {
  it('renders the completed shipments page without an inner duplicate section title', () => {
    render(
      <MemoryRouter initialEntries={['/completed-shipments']}>
        <ArchiveQueueTab
          currentUserName="Taylor Reviewer"
          onOpenWorkflowSnapshot={vi.fn()}
          onOpenListingsRecord={vi.fn()}
        />
        <LocationState />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Completed Shipments' })).toBeInTheDocument();
    expect(screen.getByTestId('archive-focused-bucket')).toHaveTextContent('');
    expect(screen.getByTestId('archive-queue-title')).toHaveTextContent('Completed Shipments');
    expect(screen.getByTestId('archive-queue-noun')).toHaveTextContent('completed shipments');
    expect(screen.getByTestId('archive-focused-notice')).toHaveTextContent('');
    expect(screen.getByTestId('archive-search-placeholder')).toHaveTextContent('Search by status, SKU, model, or ship date');
    expect(screen.getByTestId('archive-show-section-titles')).toHaveTextContent('false');
    expect(screen.getByTestId('location-state')).toHaveTextContent('/completed-shipments');
  });
});