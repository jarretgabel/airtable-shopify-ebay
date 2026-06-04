import { MemoryRouter, useLocation } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PostPublishQueueTab } from '@/components/tabs/PostPublishQueueTab';

vi.mock('@/components/tabs/airtable/UsedGearWorkflowPostPublishSection', () => ({
  POST_PUBLISH_OVERVIEW_SECTION_ID: 'used-gear-post-publish',
  POST_PUBLISH_SECTION_DEFINITIONS: [
    { key: 'active-listing', id: 'used-gear-post-publish-active-listing', title: 'Active Listings' },
    { key: 'stale-listing', id: 'used-gear-post-publish-stale-listing', title: 'Stale Listings' },
    { key: 'sold-ready', id: 'used-gear-post-publish-sold-ready', title: 'Sold Ready To Ship' },
  ],
  getPostPublishSectionId: (bucket: string) => `used-gear-post-publish-${bucket}`,
  UsedGearWorkflowPostPublishSection: ({
    sortMode,
    focusedBucket,
    onSortModeChange,
    sectionSearchEnabled,
  }: {
    sortMode?: string;
    focusedBucket?: string | null;
    onSortModeChange?: (value: 'latest-activity' | 'oldest-activity' | 'sku') => void;
    sectionSearchEnabled?: boolean;
  }) => (
    <div>
      <div data-testid="post-publish-sort-mode">{sortMode ?? ''}</div>
      <div data-testid="post-publish-focused-bucket">{focusedBucket ?? ''}</div>
      <div data-testid="post-publish-section-search">{sectionSearchEnabled ? 'enabled' : 'disabled'}</div>
      <button type="button" onClick={() => onSortModeChange?.('sku')}>Set Sort</button>
    </div>
  ),
}));

function LocationState() {
  const location = useLocation();
  return <div data-testid="location-state">{`${location.pathname}${location.search}${location.hash}`}</div>;
}

describe('PostPublishQueueTab', () => {
  it('hydrates and persists post-publish route state on the standalone page', () => {
    render(
      <MemoryRouter initialEntries={['/post-publish?workflowPostPublishSort=oldest-activity&workflowPostPublishBucket=sold-ready#used-gear-post-publish']}>
        <PostPublishQueueTab
          currentUserName="Taylor Reviewer"
          onOpenOperationalRecord={vi.fn()}
          onOpenListingsRecord={vi.fn()}
        />
        <LocationState />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Post-Publish' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByTestId('post-publish-sort-mode')).toHaveTextContent('oldest-activity');
    expect(screen.getByTestId('post-publish-focused-bucket')).toHaveTextContent('sold-ready');
    expect(screen.getByTestId('post-publish-section-search')).toHaveTextContent('enabled');

    fireEvent.click(screen.getByRole('button', { name: 'Set Sort' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sold Ready To Ship' }));

    expect(screen.getByTestId('location-state')).toHaveTextContent('/post-publish?workflowPostPublishSort=sku&workflowPostPublishBucket=sold-ready#used-gear-post-publish');
  });
});