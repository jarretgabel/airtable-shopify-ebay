import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkflowImageMetadataEditor } from '@/components/tabs/WorkflowImageMetadataEditor';
import { getConfiguredWorkflowImagePreview } from '@/services/app-api/airtable';
import type { WorkflowImageMetadataRecord } from '@/services/workflowImageMetadata';

vi.mock('@/services/app-api/airtable', () => ({ getConfiguredWorkflowImagePreview: vi.fn() }));
vi.mock('@/services/workflowImageRoles', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/services/workflowImageRoles')>(),
  loadWorkflowImageRoleOptions: async () => [],
}));

const image: WorkflowImageMetadataRecord = {
  attachmentId: 'valid-drive-file',
  url: 'https://drive.google.com/uc?export=view&id=valid-drive-file',
  filename: 'bel-canto-pre-1-front-angle.jpg',
  alt: 'Bel Canto PRe1 preamplifier front angle',
  sortOrder: 1,
  sourceStage: 'photos',
  includedInListing: true,
};
const props = {
  metadata: [image], onChange: vi.fn(),
  title: 'Photography Images', description: '', emptyMessage: '',
  recordSource: 'used-gear-workflow' as const, recordId: 'rec-photo',
};

describe('WorkflowImageMetadataEditor saved-image previews', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('loads an authenticated preview rather than embedding the Drive download page', async () => {
    const dataUrl = 'data:image/jpeg;base64,/9j/2Q==';
    vi.mocked(getConfiguredWorkflowImagePreview).mockResolvedValue({ dataUrl });
    render(<WorkflowImageMetadataEditor {...props} />);
    expect(await screen.findByAltText(image.alt)).toHaveAttribute('src', dataUrl);
    expect(getConfiguredWorkflowImagePreview).toHaveBeenCalledWith('used-gear-workflow', 'rec-photo', 'valid-drive-file');
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it('reports preview access failures without removing the image or falling back to an HTML source', async () => {
    vi.mocked(getConfiguredWorkflowImagePreview).mockRejectedValue(new Error('Drive access unavailable'));
    render(<WorkflowImageMetadataEditor {...props} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Drive access unavailable');
    expect(screen.getByTestId('workflow-image-metadata-card')).toHaveTextContent(image.filename);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(props.onChange).not.toHaveBeenCalled();
  });
});
