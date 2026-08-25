import * as React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FormImageUploadEditor } from '@/components/tabs/FormImageUploadEditor';
import type { ProcessedImage } from '@/services/imageProcessor';

const { processImageMock, revokeProcessedImageMock } = vi.hoisted(() => ({
  processImageMock: vi.fn(),
  revokeProcessedImageMock: vi.fn(),
}));

const { loadWorkflowImageRoleOptionsMock, createWorkflowImageRoleOptionMock } = vi.hoisted(() => ({
  loadWorkflowImageRoleOptionsMock: vi.fn(),
  createWorkflowImageRoleOptionMock: vi.fn(),
}));

vi.mock('@/services/imageProcessor', async () => {
  const actual = await vi.importActual<typeof import('@/services/imageProcessor')>('@/services/imageProcessor');
  return {
    ...actual,
    formatBytes: (bytes: number) => `${bytes} B`,
    processImage: processImageMock,
    revokeProcessedImage: revokeProcessedImageMock,
  };
});

vi.mock('@/services/workflowImageRoles', async () => {
  const actual = await vi.importActual<typeof import('@/services/workflowImageRoles')>('@/services/workflowImageRoles');
  return {
    ...actual,
    loadWorkflowImageRoleOptions: loadWorkflowImageRoleOptionsMock,
    createWorkflowImageRoleOption: createWorkflowImageRoleOptionMock,
  };
});

describe('FormImageUploadEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();

    let objectUrlCount = 0;
    URL.createObjectURL = vi.fn(() => `blob:mock-${++objectUrlCount}`);
    URL.revokeObjectURL = vi.fn();

    processImageMock.mockResolvedValue({
      blob: new Blob(['processed-image'], { type: 'image/jpeg' }),
      objectUrl: 'blob:processed-preview',
      filename: 'hero-finished.jpg',
      originalBytes: 100,
      processedBytes: 80,
      sourceWidth: 1600,
      sourceHeight: 1200,
      width: 1200,
      height: 900,
    });

    loadWorkflowImageRoleOptionsMock.mockResolvedValue([
      {
        value: 'front',
        label: 'Front',
        role: 'front',
      },
      {
        value: 'custom',
        label: 'Custom',
        role: 'custom',
      },
    ]);

    createWorkflowImageRoleOptionMock.mockResolvedValue({
      value: 'custom:Underside Detail',
      label: 'Underside Detail',
      role: 'custom',
      customImageRole: 'Underside Detail',
    });
  });

  it('replaces the raw upload with the processed file and reprocesses via Process all', async () => {
    const onFilesChange = vi.fn();
    const onUploadAssetsChange = vi.fn();
    render(<FormImageUploadEditor onFilesChange={onFilesChange} onUploadAssetsChange={onUploadAssetsChange} />);

    const originalFile = new File(['original-image'], 'hero.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Add upload images'), {
      target: { files: [originalFile] },
    });

    await waitFor(() => {
      expect(processImageMock).toHaveBeenCalledWith(
        originalFile,
        expect.objectContaining({
          outputFilename: 'hero-model-product-hero-image.jpg',
        }),
      );
    });

    await waitFor(() => {
      const latestCall = onFilesChange.mock.calls[onFilesChange.mock.calls.length - 1] as [File[]];
      expect(latestCall[0]).toHaveLength(1);
      expect(latestCall[0][0]?.name).toBe('hero-finished.jpg');
    });

    const card = screen.getByText('hero.jpg').closest('article');
    expect(card).not.toBeNull();
    if (!card) return;

    processImageMock.mockResolvedValueOnce({
      blob: new Blob(['processed-image-v2'], { type: 'image/jpeg' }),
      objectUrl: 'blob:processed-preview-v2',
      filename: 'hero-refined.jpg',
      originalBytes: 100,
      processedBytes: 72,
      sourceWidth: 1600,
      sourceHeight: 1200,
      width: 1200,
      height: 900,
    });

    fireEvent.click(within(card).getByRole('button', { name: 'Unlock filename editing' }));
    fireEvent.change(within(card).getByRole('textbox', { name: 'Output filename' }), {
      target: { value: 'hero-finished' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Process all' }));

    await waitFor(() => {
      expect(processImageMock).toHaveBeenCalledWith(
        originalFile,
        expect.objectContaining({
          outputFilename: 'hero-finished',
        }),
      );
    });

    await waitFor(() => {
      const latestCall = onFilesChange.mock.calls[onFilesChange.mock.calls.length - 1] as [File[]];
      expect(latestCall[0]).toHaveLength(1);
      expect(latestCall[0][0]?.name).toBe('hero-refined.jpg');
    });

    await waitFor(() => {
      const latestAssetCall = onUploadAssetsChange.mock.calls[onUploadAssetsChange.mock.calls.length - 1] as [{ originalFile: File; uploadFile: File }[]];
      expect(latestAssetCall[0]).toHaveLength(1);
      expect(latestAssetCall[0][0]?.originalFile.name).toBe('hero.jpg');
      expect(latestAssetCall[0][0]?.uploadFile.name).toBe('hero-refined.jpg');
    });
  });

  it('does not expose files for submit until auto-processing completes', async () => {
    const resolveProcessingRef: { current?: (value: ProcessedImage) => void } = {};
    processImageMock.mockImplementationOnce(() => new Promise<ProcessedImage>((resolve) => {
      resolveProcessingRef.current = resolve;
    }));

    const onFilesChange = vi.fn();
    const onUploadAssetsChange = vi.fn();
    render(<FormImageUploadEditor onFilesChange={onFilesChange} onUploadAssetsChange={onUploadAssetsChange} />);

    fireEvent.change(screen.getByLabelText('Add upload images'), {
      target: { files: [new File(['original-image'], 'pending.jpg', { type: 'image/jpeg' })] },
    });

    await waitFor(() => {
      expect(processImageMock).toHaveBeenCalledTimes(1);
    });

    const latestFileCall = onFilesChange.mock.calls[onFilesChange.mock.calls.length - 1] as [File[]];
    const latestAssetCall = onUploadAssetsChange.mock.calls[onUploadAssetsChange.mock.calls.length - 1] as [{ originalFile: File; uploadFile: File }[]];
    expect(latestFileCall[0]).toEqual([]);
    expect(latestAssetCall[0]).toEqual([]);

    if (!resolveProcessingRef.current) {
      throw new Error('Expected auto-processing promise resolver to be assigned.');
    }

    resolveProcessingRef.current({
      blob: new Blob(['processed-image'], { type: 'image/jpeg' }),
      objectUrl: 'blob:processed-preview-pending',
      filename: 'pending-finished.jpg',
      originalBytes: 100,
      processedBytes: 80,
      sourceWidth: 1600,
      sourceHeight: 1200,
      width: 1200,
      height: 900,
    });

    await waitFor(() => {
      const completedCall = onFilesChange.mock.calls[onFilesChange.mock.calls.length - 1] as [File[]];
      expect(completedCall[0][0]?.name).toBe('pending-finished.jpg');
    });
  });

  it('persists saved processing defaults in local storage', async () => {
    render(<FormImageUploadEditor onFilesChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Add upload images'), {
      target: {
        files: [new File(['original-image'], 'defaults-check.jpg', { type: 'image/jpeg' })],
      },
    });

    await waitFor(() => {
      expect(processImageMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Show options' }));

    fireEvent.change(screen.getByRole('textbox', { name: 'Default watermark text' }), {
      target: { value: 'Studio Watermark' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save defaults' }));

    expect(JSON.parse(window.localStorage.getItem('form-image-processing-defaults:v1') ?? '{}')).toEqual(
      expect.objectContaining({
        watermarkText: 'Studio Watermark',
      }),
    );
  });

  it('keeps defaults collapsed while newly added images open their edit controls', async () => {
    render(<FormImageUploadEditor onFilesChange={vi.fn()} />);

    expect(screen.queryByRole('textbox', { name: 'Default watermark text' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Add upload images'), {
      target: {
        files: [new File(['original-image'], 'collapsed-check.jpg', { type: 'image/jpeg' })],
      },
    });

    const card = await screen.findByText('collapsed-check.jpg');
    const article = card.closest('article');
    expect(article).not.toBeNull();
    if (!article) return;

    expect(within(article).getByRole('textbox', { name: 'Output filename' })).toBeInTheDocument();
  });

  it('does not loop when the parent passes a new onFilesChange callback each render', async () => {
    function Wrapper() {
      const [, setFiles] = React.useState<File[]>([]);
      return <FormImageUploadEditor onFilesChange={(nextFiles) => setFiles(nextFiles)} />;
    }

    render(<Wrapper />);

    fireEvent.change(screen.getByLabelText('Add upload images'), {
      target: {
        files: [new File(['original-image'], 'loop-check.jpg', { type: 'image/jpeg' })],
      },
    });

    await screen.findByText('loop-check.jpg');
  });

  it('applies per-image crop during individual Apply edits', async () => {
    render(<FormImageUploadEditor onFilesChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Add upload images'), {
      target: {
        files: [new File(['original-image'], 'crop-check.jpg', { type: 'image/jpeg' })],
      },
    });

    const card = await screen.findByText('crop-check.jpg');
    const article = card.closest('article');
    expect(article).not.toBeNull();
    if (!article) return;

    processImageMock.mockClear();
    fireEvent.click(within(article).getByRole('button', { name: 'Apply edits' }));

    await waitFor(() => {
      expect(processImageMock).toHaveBeenCalled();
    });

    expect(processImageMock).toHaveBeenCalledWith(
      expect.any(File),
      expect.objectContaining({
        crop: expect.objectContaining({ left: 0 }),
      }),
    );
  });

  it('requires a complete role selection before enabling Apply edits in role-required mode', async () => {
    render(
      <FormImageUploadEditor
        onFilesChange={vi.fn()}
        requireImageRole
        namingContext={{
          brand: 'Acme',
          model: 'M1',
          productType: 'Amplifier',
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText('Add upload images'), {
      target: {
        files: [new File(['original-image'], 'role-check.jpg', { type: 'image/jpeg' })],
      },
    });

    const card = await screen.findByText('role-check.jpg');
    const article = card.closest('article');
    expect(article).not.toBeNull();
    if (!article) return;

    const applyEditsButton = within(article).getByRole('button', { name: 'Apply edits' });
    expect(applyEditsButton).toBeDisabled();

    fireEvent.change(within(article).getByRole('combobox', { name: /Image role/i }), {
      target: { value: 'front' },
    });

    await waitFor(() => {
      expect(within(article).getByRole('button', { name: 'Apply edits' })).toBeEnabled();
    });

    fireEvent.click(within(article).getByRole('button', { name: 'Apply edits' }));

    await waitFor(() => {
      expect(processImageMock).toHaveBeenCalled();
    });
  });

  it('accepts a dropped folder by extracting nested image files', async () => {
    const onFilesChange = vi.fn();
    render(<FormImageUploadEditor onFilesChange={onFilesChange} />);

    const folderImage = new File(['folder-image'], 'from-folder.jpg', { type: 'image/jpeg' });

    const fileEntry = {
      isFile: true,
      isDirectory: false,
      file: (resolve: (file: File) => void) => resolve(folderImage),
    };

    const directoryEntry = {
      isFile: false,
      isDirectory: true,
      createReader: () => {
        let callCount = 0;
        return {
          readEntries: (resolve: (entries: unknown[]) => void) => {
            callCount += 1;
            resolve(callCount === 1 ? [fileEntry] : []);
          },
        };
      },
    };

    const dropzone = screen.getByRole('button', { name: 'Drag and drop images or click to add images' });
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [],
        items: [
          {
            kind: 'file',
            webkitGetAsEntry: () => directoryEntry,
          },
        ],
      },
    });

    await waitFor(() => {
      expect(processImageMock).toHaveBeenCalledWith(
        folderImage,
        expect.objectContaining({
          outputFilename: 'from-folder-product-hero-image.jpg',
        }),
      );
    });

    await waitFor(() => {
      const latestCall = onFilesChange.mock.calls[onFilesChange.mock.calls.length - 1] as [File[]];
      expect(latestCall[0]).toHaveLength(1);
      expect(latestCall[0][0]?.name).toBe('hero-finished.jpg');
    });
  });

  it('quick-adds a custom role to the shared Airtable roles table', async () => {
    loadWorkflowImageRoleOptionsMock
      .mockResolvedValueOnce([
        {
          value: 'front',
          label: 'Front',
          role: 'front',
        },
        {
          value: 'custom',
          label: 'Custom',
          role: 'custom',
        },
      ])
      .mockResolvedValueOnce([
        {
          value: 'front',
          label: 'Front',
          role: 'front',
        },
        {
          value: 'custom:Underside Detail',
          label: 'Underside Detail',
          role: 'custom',
          customImageRole: 'Underside Detail',
        },
      ]);

    render(
      <FormImageUploadEditor
        onFilesChange={vi.fn()}
        requireImageRole
        namingContext={{
          brand: 'Acme',
          model: 'M1',
          productType: 'Amplifier',
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText('Add upload images'), {
      target: {
        files: [new File(['original-image'], 'quick-add.jpg', { type: 'image/jpeg' })],
      },
    });

    const card = await screen.findByText('quick-add.jpg');
    const article = card.closest('article');
    expect(article).not.toBeNull();
    if (!article) return;

    fireEvent.change(within(article).getByRole('combobox', { name: /Image role/i }), {
      target: { value: 'custom' },
    });

    fireEvent.change(within(article).getByRole('textbox', { name: 'Custom role' }), {
      target: { value: 'Underside Detail' },
    });

    fireEvent.click(within(article).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(createWorkflowImageRoleOptionMock).toHaveBeenCalledWith('Underside Detail');
    });
  });
});
