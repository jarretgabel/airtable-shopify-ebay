import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorkflowImageMetadataEditor } from '@/components/tabs/WorkflowImageMetadataEditor';
import { buildImageAltText } from '@/services/imageNamingFormatter';
import type { WorkflowImageMetadataRecord } from '@/services/workflowImageMetadata';

vi.mock('@/services/app-api/airtable', () => ({ getConfiguredWorkflowImagePreview: vi.fn().mockResolvedValue({ dataUrl: 'data:image/jpeg;base64,/9j/2Q==' }) }));
vi.mock('@/services/workflowImageRoles', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/services/workflowImageRoles')>(),
  loadWorkflowImageRoleOptions: async () => [{ value: 'front', label: 'Front', role: 'front' }],
}));

const namingContext = { brand: 'McIntosh', model: 'MC275', productType: 'Amplifier', companyName: 'Resolution AV' };
const base: WorkflowImageMetadataRecord = {
  attachmentId: 'a', url: '/api/media/a', filename: 'testing--front-panel.jpg', alt: 'Testing Front Panel',
  sortOrder: 1, sourceStage: 'testing', includedInListing: true,
};

async function changeRole(record: WorkflowImageMetadataRecord) {
  const onChange = vi.fn();
  render(<WorkflowImageMetadataEditor metadata={[record]} onChange={onChange} title="t" description="" emptyMessage="" namingContext={namingContext} />);
  const select = await screen.findByLabelText(/Image role for/);
  await screen.findByRole('option', { name: 'Front' });
  fireEvent.change(select, { target: { value: 'front' } });
  return (onChange.mock.calls[0][0] as WorkflowImageMetadataRecord[])[0];
}

describe('WorkflowImageMetadataEditor role change', () => {
  it('refreshes alt text that was derived from the filename', async () => {
    const next = await changeRole(base);
    expect(next.imageRole).toBe('front');
    expect(next.alt).toBe(buildImageAltText(namingContext, { role: 'front', customRole: '' }));
  });

  it('keeps alt text that was edited by hand', async () => {
    const next = await changeRole({ ...base, alt: 'Hand written description' });
    expect(next.imageRole).toBe('front');
    expect(next.alt).toBe('Hand written description');
  });
});

describe('WorkflowImageMetadataEditor pending filename', () => {
  it('previews the new filename after a role change without renaming until save', async () => {
    const view = render(<WorkflowImageMetadataEditor metadata={[{ ...base, url: '/api/media/used-gear-workflow/r/testing/testing--a.jpg' }]} onChange={vi.fn()} title="t" description="" emptyMessage="" namingContext={namingContext} />);
    await screen.findAllByText('testing--front-panel.jpg');
    view.rerender(<WorkflowImageMetadataEditor metadata={[{ ...base, url: '/api/media/used-gear-workflow/r/testing/testing--a.jpg', imageRole: 'front' }]} onChange={vi.fn()} title="t" description="" emptyMessage="" namingContext={namingContext} />);
    expect(await screen.findByText('testing--mcintosh-mc275-amplifier-front-view.jpg')).toBeInTheDocument();
  });
});
