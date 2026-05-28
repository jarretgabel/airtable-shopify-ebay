import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkflowSnapshotPage } from '@/components/tabs/WorkflowSnapshotPage';

const {
  loadUsedGearOperationalRecordContextMock,
} = vi.hoisted(() => ({
  loadUsedGearOperationalRecordContextMock: vi.fn(),
}));

vi.mock('@/services/usedGearQueue', () => ({
  loadUsedGearOperationalRecordContext: loadUsedGearOperationalRecordContextMock,
}));

vi.mock('@/components/approval/ListingApprovalWorkflowSummary', () => ({
  ListingApprovalWorkflowProcessCard: () => <div>Workflow timeline</div>,
  buildListingApprovalWorkflowSummaryData: () => null,
}));

vi.mock('@/components/app/usePageSectionTracking', () => ({
  usePageSectionTracking: () => ({
    activeSectionId: 'overview',
    scrollToSection: vi.fn(),
  }),
}));

vi.mock('@/components/app/MainPageSectionNav', () => ({
  MainPageSectionNav: () => <div>Section nav</div>,
}));

vi.mock('@/services/usedGearWorkflowLifecycle', () => ({
  getUsedGearWorkflowPostPublishSnapshot: () => null,
}));

describe('WorkflowSnapshotPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadUsedGearOperationalRecordContextMock.mockResolvedValue({
      record: {
        id: 'rec-workflow-1',
        createdTime: '2026-05-27T00:00:00.000Z',
        fields: {
          SKU: 'SKU-777',
          Make: 'McIntosh',
          Model: 'MC240',
          'Workflow Status': 'Photography In Progress',
          'Testing Notes': 'Passed bench test.',
          'Testing Cosmetic Notes': 'Minor top-cover wear.',
          'Testing Time': 3600,
          Tested: '2026-05-20',
          'Photography Cosmetic Notes': 'Hero image ready.',
          "Photo'd": '2026-05-21',
          'Additional Items': 'Tube cage',
          Images: [
            { id: 'att-testing', url: 'https://example.com/testing.jpg', filename: 'testing.jpg' },
            { id: 'att-photo', url: 'https://example.com/photo.jpg', filename: 'photo.jpg' },
          ],
          'Workflow Image Metadata JSON': JSON.stringify([
            {
              attachmentId: 'att-testing',
              url: 'https://example.com/testing.jpg',
              filename: 'testing.jpg',
              alt: 'Bench shot',
              sortOrder: 1,
              sourceStage: 'testing',
              includedInListing: false,
            },
            {
              attachmentId: 'att-photo',
              url: 'https://example.com/photo.jpg',
              filename: 'photo.jpg',
              alt: 'Hero angle',
              sortOrder: 2,
              sourceStage: 'photos',
              includedInListing: true,
            },
          ]),
        },
      },
      group: null,
    });
  });

  it('renders staged testing and photography image panels from workflow metadata', async () => {
    render(
      <WorkflowSnapshotPage
        recordId="rec-workflow-1"
        onBackToDirectory={vi.fn()}
        onOpenIntake={vi.fn()}
        onOpenTesting={vi.fn()}
        onOpenPhotos={vi.fn()}
        onOpenListings={vi.fn()}
        onOpenPostPublish={vi.fn()}
      />,
    );

    expect(await screen.findByText('Testing Images')).toBeInTheDocument();
    expect(screen.getByText('Testing Reference Images')).toBeInTheDocument();
    expect(screen.getByText('Photography Images')).toBeInTheDocument();
    expect(screen.getAllByText('testing.jpg').length).toBeGreaterThan(0);
    expect(screen.getByText('photo.jpg')).toBeInTheDocument();
  });
});