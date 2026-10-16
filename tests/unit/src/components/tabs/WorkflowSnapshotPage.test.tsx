import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkflowSnapshotPage } from '@/components/tabs/WorkflowSnapshotPage';

const {
  loadUsedGearOperationalRecordContextMock,
  getConfiguredWorkflowImagePreviewMock,
} = vi.hoisted(() => ({
  loadUsedGearOperationalRecordContextMock: vi.fn(),
  getConfiguredWorkflowImagePreviewMock: vi.fn(),
}));

vi.mock('@/services/usedGearQueue', () => ({
  loadUsedGearOperationalRecordContext: loadUsedGearOperationalRecordContextMock,
}));

vi.mock('@/services/app-api/airtable', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/app-api/airtable')>()),
  getConfiguredWorkflowImagePreview: getConfiguredWorkflowImagePreviewMock,
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
    getConfiguredWorkflowImagePreviewMock.mockImplementation(async (_source: string, _recordId: string, fileId: string) => ({
      dataUrl: `data:image/jpeg;base64,${fileId}`,
    }));
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
            { id: 'att-testing', url: 'https://v5.airtableusercontent.com/current/testing-processed.jpg', filename: 'testing-processed.jpg' },
            { id: 'att-photo', url: 'https://v5.airtableusercontent.com/current/photo-processed.jpg', filename: 'photo-processed.jpg' },
          ],
          'Workflow Image Metadata JSON': JSON.stringify([
            {
              attachmentId: 'att-testing',
              url: 'https://drive.google.com/uc?export=view&id=testing-file',
              filename: 'testing-processed.jpg',
              alt: 'Bench shot',
              sortOrder: 1,
              sourceStage: 'testing',
              includedInListing: true,
            },
            {
              attachmentId: 'att-photo',
              url: 'https://drive.google.com/uc?export=view&id=photo-file',
              filename: 'photo-processed.jpg',
              alt: 'Hero angle',
              sortOrder: 2,
              sourceStage: 'photos',
              includedInListing: true,
            },
            {
              attachmentId: 'att-airtable-only',
              url: 'https://v5.airtableusercontent.com/image.jpg',
              filename: 'airtable-only.jpg',
              alt: 'Airtable attachment',
              sortOrder: 3,
              sourceStage: 'intake',
              includedInListing: false,
            },
          ]),
        },
      },
      group: null,
    });
  });

  it('renders workflow snapshot scaffolding from operational record context', async () => {
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

    expect(await screen.findByText('Workflow timeline')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'McIntosh MC240 - workflow-1' })).toBeInTheDocument();

    // Drive images load through the authenticated record preview API and render as data URLs.
    await waitFor(() => {
      screen.getAllByAltText('testing-processed.jpg').forEach((image) => {
        expect(image).toHaveAttribute('src', 'data:image/jpeg;base64,testing-file');
      });
      screen.getAllByAltText('photo-processed.jpg').forEach((image) => {
        expect(image).toHaveAttribute('src', 'data:image/jpeg;base64,photo-file');
      });
    });
    expect(getConfiguredWorkflowImagePreviewMock).toHaveBeenCalledWith('used-gear-workflow', 'rec-workflow-1', 'testing-file');
    expect(getConfiguredWorkflowImagePreviewMock).toHaveBeenCalledWith('used-gear-workflow', 'rec-workflow-1', 'photo-file');
    // Airtable-only attachments are never shown or requested.
    expect(screen.queryByAltText('airtable-only.jpg')).not.toBeInTheDocument();
    expect(getConfiguredWorkflowImagePreviewMock.mock.calls.every(([, , fileId]) => ['testing-file', 'photo-file'].includes(fileId))).toBe(true);
  });
});