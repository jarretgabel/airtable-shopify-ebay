import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkflowReferenceImagesPanel } from '@/components/tabs/WorkflowReferenceImagesPanel';
import { getConfiguredWorkflowImagePreview } from '@/services/app-api/airtable';

vi.mock('@/services/app-api/airtable', () => ({
  getConfiguredWorkflowImagePreview: vi.fn(),
}));

const getPreviewMock = vi.mocked(getConfiguredWorkflowImagePreview);

describe('WorkflowReferenceImagesPanel', () => {
  beforeEach(() => {
    getPreviewMock.mockReset();
  });

  it('loads private Google Drive images through the authenticated record preview API', async () => {
    getPreviewMock.mockResolvedValue({ dataUrl: 'data:image/jpeg;base64,/9j/2Q==' });

    render(
      <WorkflowReferenceImagesPanel
        title="Intake Images"
        description="Reference images"
        recordSource="used-gear-workflow"
        recordId="rec-workflow-123"
        images={[
          {
            filename: 'intake-photo.jpg',
            url: 'https://drive.google.com/uc?export=view&id=drive-file-123456',
          },
        ]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByAltText('intake-photo.jpg')).toHaveAttribute('src', 'data:image/jpeg;base64,/9j/2Q==');
    });
    expect(getPreviewMock).toHaveBeenCalledWith('used-gear-workflow', 'rec-workflow-123', 'drive-file-123456');
  });

  it('shows a visible error when the authenticated image preview cannot be loaded', async () => {
    getPreviewMock.mockRejectedValue(new Error('Drive access was denied.'));

    render(
      <WorkflowReferenceImagesPanel
        title="Intake Images"
        description="Reference images"
        recordSource="used-gear-workflow"
        recordId="rec-workflow-123"
        images={[
          {
            filename: 'intake-photo.jpg',
            url: 'https://drive.google.com/uc?export=view&id=drive-file-123456',
          },
        ]}
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Drive access was denied.');
  });
});
