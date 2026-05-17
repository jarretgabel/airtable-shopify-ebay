import { MemoryRouter, useLocation } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PostPublishQueueTab } from '@/components/tabs/PostPublishQueueTab';

vi.mock('@/components/tabs/airtable/UsedGearWorkflowPostPublishSection', () => ({
  UsedGearWorkflowPostPublishSection: ({
    searchTerm,
    sortMode,
    focusedBucket,
    onSearchTermChange,
    onSortModeChange,
    onFocusedBucketChange,
  }: {
    searchTerm?: string;
    sortMode?: string;
    focusedBucket?: string | null;
    onSearchTermChange?: (value: string) => void;
    onSortModeChange?: (value: 'latest-activity' | 'oldest-activity' | 'sku') => void;
    onFocusedBucketChange?: (value: 'all' | 'sold-ready') => void;
  }) => (
    <div>
      <div data-testid="post-publish-search-term">{searchTerm ?? ''}</div>
      <div data-testid="post-publish-sort-mode">{sortMode ?? ''}</div>
      <div data-testid="post-publish-focused-bucket">{focusedBucket ?? ''}</div>
      <button type="button" onClick={() => onSearchTermChange?.('sold')}>Set Search</button>
      <button type="button" onClick={() => onSortModeChange?.('sku')}>Set Sort</button>
      <button type="button" onClick={() => onFocusedBucketChange?.('sold-ready')}>Set Bucket</button>
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
      <MemoryRouter initialEntries={['/workflow/post-publish?workflowPostPublishSearch=stale&workflowPostPublishSort=oldest-activity&workflowPostPublishBucket=shipped#used-gear-post-publish']}>
        <PostPublishQueueTab
          currentUserName="Taylor Reviewer"
          onOpenOperationalRecord={vi.fn()}
          onOpenListingsRecord={vi.fn()}
        />
        <LocationState />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Post-Publish' })).toBeInTheDocument();
    expect(screen.getByTestId('post-publish-search-term')).toHaveTextContent('stale');
    expect(screen.getByTestId('post-publish-sort-mode')).toHaveTextContent('oldest-activity');
    expect(screen.getByTestId('post-publish-focused-bucket')).toHaveTextContent('shipped');

    fireEvent.click(screen.getByRole('button', { name: 'Set Search' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set Sort' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set Bucket' }));

    expect(screen.getByTestId('location-state')).toHaveTextContent('/workflow/post-publish?workflowPostPublishSearch=sold&workflowPostPublishSort=sku&workflowPostPublishBucket=sold-ready#used-gear-post-publish');
  });
});