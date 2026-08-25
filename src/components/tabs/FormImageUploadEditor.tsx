import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent, type ReactNode } from 'react';
import {
  buildProcessingOptions,
  loadFormImageProcessingDefaults,
  saveFormImageProcessingDefaults,
  type FormImageProcessingDefaults,
} from '@/services/formImageProcessingDefaults';
import type { FormImageUploadAsset } from '@/services/formImageUploads';

import { formatBytes, processImage, revokeProcessedImage, type CropInsetsPercent, type ProcessedImage } from '@/services/imageProcessor';
import { FormImageCropPreview } from '@/components/tabs/FormImageCropPreview';
import { ApprovalSelect } from '@/components/approval/ApprovalSelect';
import {
  buildImageAltText,
  buildFallbackImageFilename,
  buildImageFilename,
  isImageRoleComplete,
  type ImageNamingContext,
} from '@/services/imageNamingFormatter';
import type { WorkflowImageRole } from '@/services/workflowImageMetadata';
import {
  createWorkflowImageRoleOption,
  findWorkflowImageRoleOption,
  getWorkflowImageRoleSelectValue,
  loadWorkflowImageRoleOptions,
  toWorkflowImageRoleSelection,
  type WorkflowImageRoleSelectOption,
} from '@/services/workflowImageRoles';

interface EditableUploadItem {
  id: string;
  originalFile: File;
  originalUrl: string;
  editedFile: File | null;
  processed: ProcessedImage | null;
  status: 'idle' | 'processing' | 'done' | 'error';
  error?: string;
  outputFilename: string;
  outputFilenameLocked: boolean;
  outputWarnings: string[];
  imageRole?: WorkflowImageRole;
  customImageRole: string;
  altText: string;
  crop: CropInsetsPercent;
}

type WebkitDataTransferItem = DataTransferItem & {
  webkitGetAsEntry?: () => FileSystemEntry | null;
};

export interface FormImageProcessingSummary {
  total: number;
  processed: number;
  processing: number;
  failed: number;
}

export interface FormImageUploadEditorProps {
  onFilesChange: (files: File[]) => void;
  onUploadAssetsChange?: (assets: FormImageUploadAsset[]) => void;
  onProcessingStateChange?: (isProcessing: boolean) => void;
  onProcessingSummaryChange?: (summary: FormImageProcessingSummary) => void;
  resetKey?: string | number;
  disabled?: boolean;
  title?: string;
  required?: boolean;
  description?: string;
  className?: string;
  namingContext?: ImageNamingContext;
  requireImageRole?: boolean;
  afterUploadContent?: ReactNode;
}

interface EnlargedPreviewState {
  src: string;
  alt: string;
  title: string;
}

function buildDefaultOutputFilename(fileName: string): string {
  return buildFallbackImageFilename(fileName);
}

function buildItemOutputFilename(
  fileName: string,
  namingContext: ImageNamingContext | undefined,
  role: WorkflowImageRole | undefined,
  customRole: string,
  manualOutputFilename?: string,
): { filename: string; warnings: string[] } {
  if (!namingContext) {
    const trimmedManual = (manualOutputFilename ?? '').trim();
    return {
      filename: trimmedManual || buildDefaultOutputFilename(fileName),
      warnings: [],
    };
  }

  return buildImageFilename(namingContext, {
    role,
    customRole,
  });
}

function createUploadItem(
  file: File,
  defaults: FormImageProcessingDefaults,
  namingContext: ImageNamingContext | undefined,
): EditableUploadItem {
  const nextOutput = buildItemOutputFilename(file.name, namingContext, undefined, '');
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    originalFile: file,
    originalUrl: URL.createObjectURL(file),
    editedFile: null,
    processed: null,
    status: 'idle',
    outputFilename: nextOutput.filename,
    outputFilenameLocked: true,
    outputWarnings: nextOutput.warnings,
    imageRole: undefined,
    customImageRole: '',
    altText: namingContext ? buildImageAltText(namingContext, { role: undefined, customRole: '' }) : '',
    crop: { ...defaults.crop },
  };
}

function disposeItem(item: EditableUploadItem) {
  URL.revokeObjectURL(item.originalUrl);
  if (item.processed) {
    revokeProcessedImage(item.processed);
  }
}

function getUploadReadyItems(items: EditableUploadItem[], requireImageRole: boolean): EditableUploadItem[] {
  return items.filter((item) => {
    if (!(item.status === 'done' && item.editedFile)) {
      return false;
    }

    if (!requireImageRole) {
      return true;
    }

    return isImageRoleComplete(item.imageRole, item.customImageRole);
  });
}

function buildProcessingSummary(items: EditableUploadItem[]): FormImageProcessingSummary {
  return {
    total: items.length,
    processed: items.filter((item) => item.status === 'done').length,
    processing: items.filter((item) => item.status === 'processing').length,
    failed: items.filter((item) => item.status === 'error').length,
  };
}

function getImageRoleValidationError(role: WorkflowImageRole | undefined, customRole: string | undefined): string | undefined {
  if (!role) {
    return 'Select an image role before processing.';
  }

  if (role === 'custom' && !(customRole && customRole.trim().length > 0)) {
    return 'Enter a custom image role before processing.';
  }

  return undefined;
}

function toUploadFiles(items: EditableUploadItem[], requireImageRole: boolean): File[] {
  return getUploadReadyItems(items, requireImageRole).flatMap((item) => item.editedFile ? [item.editedFile] : []);
}

function toUploadAssets(items: EditableUploadItem[], requireImageRole: boolean): FormImageUploadAsset[] {
  return getUploadReadyItems(items, requireImageRole).map((item) => ({
    originalFile: item.originalFile,
    uploadFile: item.editedFile ?? item.originalFile,
    imageRole: item.imageRole,
    customImageRole: item.customImageRole || undefined,
    altText: item.altText || undefined,
  }));
}

function readFileEntry(entry: FileSystemFileEntry): Promise<File | null> {
  return new Promise((resolve) => {
    entry.file(
      (file) => resolve(file),
      () => resolve(null),
    );
  });
}

function readDirectoryEntries(directory: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  return new Promise((resolve) => {
    const reader = directory.createReader();
    const entries: FileSystemEntry[] = [];

    const readBatch = () => {
      reader.readEntries(
        (batch) => {
          if (!batch.length) {
            resolve(entries);
            return;
          }
          entries.push(...batch);
          readBatch();
        },
        () => resolve(entries),
      );
    };

    readBatch();
  });
}

async function collectFilesFromEntry(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    const file = await readFileEntry(entry as FileSystemFileEntry);
    return file ? [file] : [];
  }

  if (!entry.isDirectory) {
    return [];
  }

  const children = await readDirectoryEntries(entry as FileSystemDirectoryEntry);
  const nested = await Promise.all(children.map((child) => collectFilesFromEntry(child)));
  return nested.flat();
}

async function extractDroppedFiles(dataTransfer: DataTransfer): Promise<File[]> {
  const items = Array.from(dataTransfer.items ?? []) as WebkitDataTransferItem[];
  if (items.length === 0) {
    return Array.from(dataTransfer.files ?? []);
  }

  const entries = items
    .filter((item) => item.kind === 'file')
    .map((item) => item.webkitGetAsEntry?.() ?? null)
    .filter((entry): entry is FileSystemEntry => Boolean(entry));

  if (entries.length === 0) {
    return Array.from(dataTransfer.files ?? []);
  }

  const fileGroups = await Promise.all(entries.map((entry) => collectFilesFromEntry(entry)));
  const flattened = fileGroups.flat();
  if (flattened.length > 0) {
    return flattened;
  }
  return Array.from(dataTransfer.files ?? []);
}

export function FormImageUploadEditor({
  onFilesChange,
  onUploadAssetsChange,
  onProcessingStateChange,
  onProcessingSummaryChange,
  resetKey = 0,
  disabled = false,
  title = 'Upload Images',
  required = false,
  description,
  className = '',
  namingContext,
  requireImageRole = false,
  afterUploadContent,
}: FormImageUploadEditorProps) {
  const [defaultSettings, setDefaultSettings] = useState<FormImageProcessingDefaults>(() => loadFormImageProcessingDefaults());
  const [items, setItems] = useState<EditableUploadItem[]>([]);
  const [defaultsSavedNotice, setDefaultsSavedNotice] = useState(false);
  const [defaultsExpanded, setDefaultsExpanded] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [enlargedPreview, setEnlargedPreview] = useState<EnlargedPreviewState | null>(null);
  const [imageRoleOptions, setImageRoleOptions] = useState<WorkflowImageRoleSelectOption[]>([]);
  const [savingCustomRoleItemId, setSavingCustomRoleItemId] = useState<string | null>(null);
  const [customRoleSaveErrors, setCustomRoleSaveErrors] = useState<Record<string, string>>({});
  const [customRoleSaveSuccess, setCustomRoleSaveSuccess] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const itemsRef = useRef<EditableUploadItem[]>([]);
  const onFilesChangeRef = useRef(onFilesChange);
  const onUploadAssetsChangeRef = useRef(onUploadAssetsChange);
  const onProcessingStateChangeRef = useRef(onProcessingStateChange);
  const onProcessingSummaryChangeRef = useRef(onProcessingSummaryChange);

  useEffect(() => {
    onFilesChangeRef.current = onFilesChange;
  }, [onFilesChange]);

  useEffect(() => {
    onUploadAssetsChangeRef.current = onUploadAssetsChange;
  }, [onUploadAssetsChange]);

  useEffect(() => {
    onProcessingStateChangeRef.current = onProcessingStateChange;
  }, [onProcessingStateChange]);

  useEffect(() => {
    onProcessingSummaryChangeRef.current = onProcessingSummaryChange;
  }, [onProcessingSummaryChange]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    let cancelled = false;

    const loadOptions = async () => {
      const nextOptions = await loadWorkflowImageRoleOptions();
      if (!cancelled) {
        setImageRoleOptions(nextOptions);
      }
    };

    void loadOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      itemsRef.current.forEach(disposeItem);
    };
  }, []);

  useEffect(() => {
    setItems((current) => {
      current.forEach(disposeItem);
      return [];
    });
    onFilesChangeRef.current([]);
    onUploadAssetsChangeRef.current?.([]);
    onProcessingStateChangeRef.current?.(false);
    onProcessingSummaryChangeRef.current?.({ total: 0, processed: 0, processing: 0, failed: 0 });
    setDefaultsExpanded(false);
  }, [resetKey]);

  useEffect(() => {
    const uploadAssets = toUploadAssets(items, requireImageRole);
    const summary = buildProcessingSummary(items);
    onFilesChangeRef.current(toUploadFiles(items, requireImageRole));
    onUploadAssetsChangeRef.current?.(uploadAssets);
    onProcessingStateChangeRef.current?.(summary.processing > 0);
    onProcessingSummaryChangeRef.current?.(summary);
  }, [items, requireImageRole]);

  const hasItemsToProcess = useMemo(
    () => items.some((item) => item.status === 'idle' || item.status === 'done' || item.status === 'error'),
    [items],
  );

  const addFiles = (files: File[]) => {
    const nextFiles = files.filter((file) => file.type.startsWith('image/'));
    if (nextFiles.length === 0) return;

    const nextItems = nextFiles.map((file) => createUploadItem(file, defaultSettings, namingContext));
    setItems((current) => [...current, ...nextItems]);
    if (!requireImageRole) {
      nextItems.forEach((item) => {
        void processSingleItem(item.id, item);
      });
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files ?? []));
    event.target.value = '';
  };

  const handleDropzoneKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    fileInputRef.current?.click();
  };

  const handleDropzoneDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (disabled) return;
    setIsDragActive(true);
  };

  const handleDropzoneDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDragActive(false);
    }
  };

  const handleDropzoneDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    if (disabled) return;
    const droppedFiles = await extractDroppedFiles(event.dataTransfer);
    addFiles(droppedFiles);
  };

  const updateItem = (itemId: string, updater: (item: EditableUploadItem) => EditableUploadItem) => {
    setItems((current) => current.map((item) => {
      if (item.id !== itemId) return item;
      return updater(item);
    }));
  };

  const removeItem = (itemId: string) => {
    setItems((current) => {
      const target = current.find((item) => item.id === itemId);
      if (target) disposeItem(target);
      return current.filter((item) => item.id !== itemId);
    });
  };

  const resetItemEdits = (itemId: string) => {
    updateItem(itemId, (item) => {
      if (item.processed) revokeProcessedImage(item.processed);
      const nextOutput = buildItemOutputFilename(item.originalFile.name, namingContext, item.imageRole, item.customImageRole);
      return {
        ...item,
        editedFile: null,
        processed: null,
        status: 'idle',
        error: undefined,
        outputFilename: nextOutput.filename,
        outputWarnings: nextOutput.warnings,
        altText: namingContext
          ? buildImageAltText(namingContext, { role: item.imageRole, customRole: item.customImageRole })
          : item.altText,
        crop: { ...defaultSettings.crop },
      };
    });
  };

  const processSingleItem = async (itemId: string, sourceItem?: EditableUploadItem) => {
    const currentItem = sourceItem ?? itemsRef.current.find((item) => item.id === itemId);
    if (!currentItem) return;

    const roleValidationError = requireImageRole
      ? getImageRoleValidationError(currentItem.imageRole, currentItem.customImageRole)
      : undefined;

    if (roleValidationError) {
      updateItem(itemId, (item) => ({
        ...item,
        status: 'error',
        error: roleValidationError,
      }));
      return;
    }

    const nextOutput = buildItemOutputFilename(
      currentItem.originalFile.name,
      namingContext,
      currentItem.imageRole,
      currentItem.customImageRole,
      currentItem.outputFilename,
    );

    updateItem(itemId, (item) => ({ ...item, status: 'processing', error: undefined }));

    try {
      const processed = await processImage(
        currentItem.originalFile,
        buildProcessingOptions({
          ...defaultSettings,
          crop: { ...currentItem.crop },
        }, nextOutput.filename),
      );

      updateItem(itemId, (item) => {
        if (item.processed) revokeProcessedImage(item.processed);
        return {
          ...item,
          editedFile: new File([processed.blob], processed.filename, { type: processed.blob.type || 'image/jpeg' }),
          processed,
          status: 'done',
          error: undefined,
          outputFilename: processed.filename,
          outputWarnings: nextOutput.warnings,
        };
      });
    } catch (error) {
      updateItem(itemId, (item) => ({
        ...item,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unable to process image.',
      }));
    }
  };

  const processAll = async () => {
    const snapshot = itemsRef.current;
    if (requireImageRole) {
      const validationById = new Map<string, string>();
      snapshot.forEach((item) => {
        const nextValidationError = getImageRoleValidationError(item.imageRole, item.customImageRole);
        if (nextValidationError) {
          validationById.set(item.id, nextValidationError);
        }
      });

      if (validationById.size > 0) {
        setItems((current) => current.map((item) => {
          const nextValidationError = validationById.get(item.id);
          if (!nextValidationError) {
            return item;
          }

          return {
            ...item,
            status: 'error',
            error: nextValidationError,
          };
        }));
      }
    }

    for (const item of snapshot) {
      if (requireImageRole && getImageRoleValidationError(item.imageRole, item.customImageRole)) {
        continue;
      }
      await processSingleItem(item.id);
    }
  };

  const addCustomRoleToSharedTable = async (itemId: string) => {
    const currentItem = itemsRef.current.find((item) => item.id === itemId);
    if (!currentItem) {
      return;
    }

    const customRoleValue = currentItem.customImageRole.trim();
    if (!customRoleValue) {
      setCustomRoleSaveErrors((current) => ({
        ...current,
        [itemId]: 'Enter a custom role before adding it to Airtable.',
      }));
      setCustomRoleSaveSuccess((current) => ({ ...current, [itemId]: '' }));
      return;
    }

    const existing = findWorkflowImageRoleOption(imageRoleOptions, customRoleValue);
    if (existing) {
      const existingSelection = toWorkflowImageRoleSelection(existing.value, customRoleValue);
      setCustomRoleSaveErrors((current) => ({ ...current, [itemId]: '' }));
      setCustomRoleSaveSuccess((current) => ({
        ...current,
        [itemId]: 'Role already exists in shared Airtable roles and is now selected.',
      }));
      updateItem(itemId, (item) => ({
        ...item,
        imageRole: existingSelection.imageRole,
        customImageRole: existingSelection.customImageRole,
      }));
      return;
    }

    setSavingCustomRoleItemId(itemId);
    setCustomRoleSaveErrors((current) => ({ ...current, [itemId]: '' }));
    setCustomRoleSaveSuccess((current) => ({ ...current, [itemId]: '' }));
    try {
      const createdOption = await createWorkflowImageRoleOption(customRoleValue);
      const refreshedOptions = await loadWorkflowImageRoleOptions();
      setImageRoleOptions(refreshedOptions);

      const selectedOption = findWorkflowImageRoleOption(refreshedOptions, customRoleValue) ?? createdOption;
      const createdSelection = toWorkflowImageRoleSelection(selectedOption.value, customRoleValue);
      updateItem(itemId, (item) => {
        if (item.processed) {
          revokeProcessedImage(item.processed);
        }

        const nextOutput = buildItemOutputFilename(item.originalFile.name, namingContext, createdSelection.imageRole, createdSelection.customImageRole);
        return {
          ...item,
          imageRole: createdSelection.imageRole,
          customImageRole: createdSelection.customImageRole,
          outputFilename: nextOutput.filename,
          outputWarnings: nextOutput.warnings,
          altText: namingContext
            ? buildImageAltText(namingContext, { role: createdSelection.imageRole, customRole: createdSelection.customImageRole })
            : item.altText,
          editedFile: null,
          processed: null,
          status: 'idle',
          error: undefined,
        };
      });
      setCustomRoleSaveSuccess((current) => ({
        ...current,
        [itemId]: 'Added to shared Airtable roles.',
      }));
    } catch (error) {
      setCustomRoleSaveErrors((current) => ({
        ...current,
        [itemId]: error instanceof Error ? error.message : 'Unable to add role to Airtable.',
      }));
      setCustomRoleSaveSuccess((current) => ({ ...current, [itemId]: '' }));
    } finally {
      setSavingCustomRoleItemId(null);
    }
  };

  const saveDefaults = () => {
    saveFormImageProcessingDefaults(defaultSettings);
    setDefaultsSavedNotice(true);
    window.setTimeout(() => setDefaultsSavedNotice(false), 1500);
  };

  return (
    <section className={`rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5 ${className}`.trim()}>
      <div className="flex flex-col gap-4">
        <div>
          <p className="m-0 text-sm font-semibold text-[var(--ink)]">
            {title}
            {required ? <span className="text-red-400"> *</span> : null}
          </p>
          {description ? <p className="mt-1 text-xs text-[var(--muted)]">{description}</p> : null}
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_auto] lg:items-start">
          <div
            role="button"
            tabIndex={disabled ? -1 : 0}
            className={[
              'flex min-h-[208px] items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition outline-none sm:min-h-[232px] sm:px-8',
              isDragActive
                ? 'border-[var(--accent)] bg-[var(--accent)]/12 shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent)_55%,transparent)]'
                : 'border-[var(--line)]/80 bg-[var(--bg)] hover:border-[var(--accent)]/70 hover:bg-[var(--panel)]/50',
              disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20',
            ].join(' ')}
            onClick={() => {
              if (!disabled) fileInputRef.current?.click();
            }}
            onKeyDown={handleDropzoneKeyDown}
            onDragOver={handleDropzoneDragOver}
            onDragLeave={handleDropzoneDragLeave}
            onDrop={handleDropzoneDrop}
            aria-label="Drag and drop images or click to add images"
          >
            <div className="flex max-w-xl flex-col items-center justify-center gap-3">
              <div className={[
                'flex h-14 w-14 items-center justify-center rounded-full border text-xl font-semibold transition sm:h-16 sm:w-16',
                isDragActive
                  ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]'
                  : 'border-[var(--line)] bg-[var(--panel)]/40 text-[var(--ink)]',
              ].join(' ')}>
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-7 w-7 sm:h-8 sm:w-8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 16V6" />
                  <path d="m8 10 4-4 4 4" />
                  <path d="M5 18h14" />
                </svg>
              </div>
              <div>
                <p className="m-0 text-base font-semibold text-[var(--ink)] sm:text-lg">
                  {isDragActive ? 'Drop images to add them' : 'Drag and drop images or folders here'}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)] sm:text-base">
                  {isDragActive ? 'Release to add these files to the upload set.' : 'Click anywhere in this area or drop image files/folders to start a photo upload set.'}
                </p>
              </div>
            </div>
          </div>

          <div />
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        aria-label="Add upload images"
        onChange={handleFileChange}
      />

      {items.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="m-0 text-sm font-semibold text-[var(--ink)]">Default processing options</p>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                Save reusable resize and watermark defaults for future uploads on these forms.
              </p>
            </div>
            <button
              type="button"
              className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setDefaultsExpanded((current) => !current)}
              disabled={disabled}
              aria-expanded={defaultsExpanded}
              aria-controls="form-image-default-options"
            >
              {defaultsExpanded ? 'Hide options' : 'Show options'}
            </button>
          </div>

          {defaultsExpanded ? (
            <div id="form-image-default-options" className="mt-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--ink)]">Default max size</span>
                  <select
                    className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                    value={defaultSettings.maxPx}
                    onChange={(event) => {
                      const nextMaxPx = Number(event.currentTarget.value);
                      setDefaultSettings((current) => ({ ...current, maxPx: nextMaxPx }));
                    }}
                    disabled={disabled}
                  >
                    <option value={800}>800 px</option>
                    <option value={1200}>1200 px</option>
                    <option value={1600}>1600 px</option>
                    <option value={2400}>2400 px</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-[var(--ink)]">Default JPEG quality</span>
                  <input
                    type="number"
                    min={40}
                    max={100}
                    className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                    value={defaultSettings.quality}
                    onChange={(event) => {
                      const nextQuality = Number(event.currentTarget.value);
                      setDefaultSettings((current) => ({ ...current, quality: nextQuality }));
                    }}
                    disabled={disabled}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-[var(--ink)]">Default watermark text</span>
                  <input
                    type="text"
                    className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                    value={defaultSettings.watermarkText}
                    onChange={(event) => {
                      const nextWatermarkText = event.currentTarget.value;
                      setDefaultSettings((current) => ({ ...current, watermarkText: nextWatermarkText }));
                    }}
                    disabled={disabled}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-[var(--ink)]">Default watermark position</span>
                  <select
                    className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                    value={defaultSettings.watermarkPos}
                    onChange={(event) => {
                      const nextWatermarkPos = event.currentTarget.value as FormImageProcessingDefaults['watermarkPos'];
                      setDefaultSettings((current) => ({ ...current, watermarkPos: nextWatermarkPos }));
                    }}
                    disabled={disabled}
                  >
                    <option value="bottom-right">Bottom right</option>
                    <option value="bottom-left">Bottom left</option>
                    <option value="bottom-center">Bottom center</option>
                    <option value="top-right">Top right</option>
                  </select>
                </label>
              </div>

              <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)]/35 p-3 sm:p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <label className="flex items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-3 text-sm text-[var(--ink)] lg:max-w-xl">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={defaultSettings.watermarkEnabled}
                      onChange={(event) => {
                        const nextWatermarkEnabled = event.currentTarget.checked;
                        setDefaultSettings((current) => ({ ...current, watermarkEnabled: nextWatermarkEnabled }));
                      }}
                      disabled={disabled}
                    />
                    <span>
                      <span className="block font-semibold text-[var(--ink)]">Enable watermark by default</span>
                      <span className="mt-1 block text-xs leading-4 text-[var(--muted)]/85">
                        Start new uploads with watermarking enabled.
                      </span>
                    </span>
                  </label>

                  <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
                    <button
                      type="button"
                      className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={saveDefaults}
                      disabled={disabled}
                    >
                      Save defaults
                    </button>
                    {defaultsSavedNotice ? <span className="text-sm font-semibold text-emerald-300">Defaults saved</span> : null}
                  </div>
                </div>
              </div>

            </div>
          ) : null}
        </div>
      ) : null}

      {items.length > 0 ? (
        <p className="mt-4 text-sm text-[var(--muted)]">
          Current upload set: <strong className="text-[var(--ink)]">{items.length}</strong> image{items.length === 1 ? '' : 's'}.
          {requireImageRole
            ? ' Select an image role for each item, then use Process all to generate compliant filenames.'
            : ' Images auto-process after you add them.'}
          {' '}Only completed processed files are included on submit, and you can re-run Process all anytime.
        </p>
      ) : null}

      {items.length > 0 ? (
        <div className="mt-4 grid gap-5">
          {items.map((item) => {
            const roleValidationError = requireImageRole
              ? getImageRoleValidationError(item.imageRole, item.customImageRole)
              : undefined;

            return (
            <article key={item.id} className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 xl:flex-1">
                  <p className="m-0 break-all text-sm font-semibold text-[var(--ink)]">{item.originalFile.name}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Original {formatBytes(item.originalFile.size)}
                    {item.processed ? ` · Edited ${formatBytes(item.processed.processedBytes)} · ${item.processed.width}×${item.processed.height}` : ''}
                  </p>
                  {item.error ? <p className="mt-2 text-sm text-rose-300">{item.error}</p> : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => {
                      void processSingleItem(item.id);
                    }}
                    disabled={disabled || item.status === 'processing' || Boolean(roleValidationError)}
                  >
                    {item.status === 'processing' ? 'Processing…' : 'Apply edits'}
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => resetItemEdits(item.id)}
                    disabled={disabled}
                  >
                    Reset edits
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => removeItem(item.id)}
                    disabled={disabled || item.status === 'processing'}
                  >
                    Remove
                  </button>
                </div>
              </div>
                  <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormImageCropPreview
                        imageUrl={item.originalUrl}
                        alt={`Original ${item.originalFile.name}`}
                        crop={item.crop}
                        onCropChange={(nextCrop) => updateItem(item.id, (current) => ({
                          ...current,
                          crop: nextCrop,
                        }))}
                        disabled={disabled}
                        headerActions={(
                          <button
                            type="button"
                            className="rounded-md border border-[var(--line)] bg-[var(--bg)] p-1.5 text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                            onClick={() => {
                              setEnlargedPreview({
                                src: item.originalUrl,
                                alt: `Original ${item.originalFile.name}`,
                                title: 'Original image',
                              });
                            }}
                            aria-label="View original image large"
                            title="View original image large"
                          >
                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                              <path fillRule="evenodd" d="M9 3a6 6 0 1 0 3.874 10.583l2.771 2.771a.75.75 0 1 0 1.06-1.06l-2.77-2.772A6 6 0 0 0 9 3Zm-4.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0Z" clipRule="evenodd" />
                            </svg>
                          </button>
                        )}
                      />
                      <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-slate-950/30">
                        <div className="flex items-center justify-between border-b border-[var(--line)] px-3 py-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Edited preview</span>
                          <button
                            type="button"
                            className="rounded-md border border-[var(--line)] bg-[var(--bg)] p-1.5 text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => {
                              if (!item.processed) return;
                              setEnlargedPreview({
                                src: item.processed.objectUrl,
                                alt: `Edited ${item.processed.filename}`,
                                title: 'Edited image',
                              });
                            }}
                            aria-label="View edited image large"
                            title="View edited image large"
                            disabled={!item.processed}
                          >
                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                              <path fillRule="evenodd" d="M9 3a6 6 0 1 0 3.874 10.583l2.771 2.771a.75.75 0 1 0 1.06-1.06l-2.77-2.772A6 6 0 0 0 9 3Zm-4.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0Z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                        {item.processed ? (
                          <img src={item.processed.objectUrl} alt={`Edited ${item.processed.filename}`} className="h-72 w-full object-contain" />
                        ) : (
                          <div className="flex h-72 items-center justify-center px-4 text-center text-sm text-[var(--muted)]">
                            Drag crop handles on the left, then click Apply edits to preview.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-4">
                      <div className={`grid gap-4 ${item.imageRole === 'custom' ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
                        <label className="block">
                          <span className="text-sm font-semibold text-[var(--ink)]">
                            Image role
                            {requireImageRole ? <span className="ml-1 text-rose-300">*</span> : null}
                          </span>
                          <ApprovalSelect
                            selectClassName="mt-2 w-full appearance-none rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 pr-10 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                            value={getWorkflowImageRoleSelectValue(item.imageRole, item.customImageRole, imageRoleOptions)}
                            onChange={(event) => {
                              const selectedValue = event.currentTarget.value;
                              updateItem(item.id, (current) => {
                                if (current.processed) {
                                  revokeProcessedImage(current.processed);
                                }

                                const selection = toWorkflowImageRoleSelection(selectedValue, current.customImageRole);

                                const normalizedRole = selection.imageRole;
                                const nextCustomRole = selection.customImageRole;
                                const nextOutput = buildItemOutputFilename(current.originalFile.name, namingContext, normalizedRole, nextCustomRole);
                                return {
                                  ...current,
                                  imageRole: normalizedRole,
                                  customImageRole: nextCustomRole,
                                  outputFilename: nextOutput.filename,
                                  outputWarnings: nextOutput.warnings,
                                  altText: namingContext
                                    ? buildImageAltText(namingContext, { role: normalizedRole, customRole: nextCustomRole })
                                    : current.altText,
                                  editedFile: null,
                                  processed: null,
                                  status: 'idle',
                                  error: undefined,
                                };
                              });
                            }}
                            disabled={disabled}
                          >
                            <option value="">Select image role</option>
                            {imageRoleOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </ApprovalSelect>
                          {roleValidationError ? (
                            <p className="mt-2 text-xs text-amber-200/90">{roleValidationError}</p>
                          ) : null}
                        </label>

                        {item.imageRole === 'custom' ? (
                          <div className="grid gap-2">
                            <label className="block">
                              <span className="text-sm font-semibold text-[var(--ink)]">Custom role</span>
                              <input
                                type="text"
                                className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                                value={item.customImageRole}
                                onChange={(event) => {
                                  const nextCustomImageRole = event.currentTarget.value;
                                  setCustomRoleSaveErrors((current) => ({ ...current, [item.id]: '' }));
                                  setCustomRoleSaveSuccess((current) => ({ ...current, [item.id]: '' }));
                                  updateItem(item.id, (current) => {
                                    if (current.processed) {
                                      revokeProcessedImage(current.processed);
                                    }

                                    const nextOutput = buildItemOutputFilename(current.originalFile.name, namingContext, current.imageRole, nextCustomImageRole);
                                    return {
                                      ...current,
                                      customImageRole: nextCustomImageRole,
                                      outputFilename: nextOutput.filename,
                                      outputWarnings: nextOutput.warnings,
                                      altText: namingContext
                                        ? buildImageAltText(namingContext, { role: current.imageRole, customRole: nextCustomImageRole })
                                        : current.altText,
                                      editedFile: null,
                                      processed: null,
                                      status: 'idle',
                                      error: undefined,
                                    };
                                  });
                                }}
                                placeholder="For example: side-profile"
                                disabled={disabled}
                              />
                            </label>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                                onClick={() => {
                                  void addCustomRoleToSharedTable(item.id);
                                }}
                                disabled={disabled || savingCustomRoleItemId === item.id}
                              >
                                {savingCustomRoleItemId === item.id ? 'Saving…' : 'Save'}
                              </button>
                              <span className="text-xs text-[var(--muted)]">Saves this custom role to the shared Airtable roles table.</span>
                            </div>
                            {customRoleSaveErrors[item.id] ? (
                              <p className="m-0 text-xs text-rose-300">{customRoleSaveErrors[item.id]}</p>
                            ) : null}
                            {customRoleSaveSuccess[item.id] ? (
                              <p className="m-0 text-xs text-emerald-300">{customRoleSaveSuccess[item.id]}</p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      <label className="block">
                        <span className="text-sm font-semibold text-[var(--ink)]">Image alt text</span>
                        <input
                          type="text"
                          className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                          value={item.altText}
                          onChange={(event) => {
                            const nextAltText = event.currentTarget.value;
                            updateItem(item.id, (current) => ({ ...current, altText: nextAltText }));
                          }}
                          disabled={disabled}
                          placeholder="McIntosh MC225 Stereo Tube Power Amplifier Left Side"
                        />
                      </label>

                      <div className="block">
                        <label htmlFor={`output-filename-${item.id}`} className="text-sm font-semibold text-[var(--ink)]">Output filename</label>
                        <div className="relative mt-2">
                          <input
                            id={`output-filename-${item.id}`}
                            type="text"
                            className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 pr-11 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                            value={item.outputFilename}
                            onChange={(event) => {
                              const nextOutputFilename = event.currentTarget.value;
                              updateItem(item.id, (current) => ({ ...current, outputFilename: nextOutputFilename }));
                            }}
                            disabled={disabled}
                            readOnly={item.outputFilenameLocked}
                          />
                          <button
                            type="button"
                            className="absolute inset-y-0 right-2 inline-flex items-center rounded-md px-1.5 text-[var(--muted)] transition hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => {
                              updateItem(item.id, (current) => ({
                                ...current,
                                outputFilenameLocked: !current.outputFilenameLocked,
                              }));
                            }}
                            aria-label={item.outputFilenameLocked ? 'Unlock filename editing' : 'Lock filename editing'}
                            title={item.outputFilenameLocked ? 'Unlock filename editing' : 'Lock filename editing'}
                            disabled={disabled}
                          >
                            {item.outputFilenameLocked ? (
                              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                                <path fillRule="evenodd" d="M10 1a4 4 0 0 0-4 4v2H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-1V5a4 4 0 0 0-4-4Zm2.5 6V5a2.5 2.5 0 0 0-5 0v2h5Z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                                <path d="M5 8a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5Z" />
                                <path d="M7.5 8V5a2.5 2.5 0 0 1 4.584-1.387.75.75 0 1 0 1.232-.856A4 4 0 0 0 6 5v3h1.5Z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>

                      {item.outputWarnings.length > 0 ? (
                        <p className="text-xs text-amber-200/90">{item.outputWarnings.join(' ')}</p>
                      ) : null}
                    </div>
                  </div>
            </article>
            );
          })}
        </div>
      ) : null}

      {afterUploadContent ? <div className="mt-5 border-t border-[var(--line)] pt-5">{afterUploadContent}</div> : null}

      {items.length > 0 ? (
        <div className="mt-5 flex justify-end border-t border-[var(--line)] pt-4">
          <button
            type="button"
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              void processAll();
            }}
            disabled={disabled || !hasItemsToProcess}
          >
            Process all
          </button>
        </div>
      ) : null}

      {enlargedPreview ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/85 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-label={enlargedPreview.title}
          onClick={() => setEnlargedPreview(null)}
        >
          <div
            className="relative h-[94vh] w-[96vw] rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-3"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="m-0 text-sm font-semibold text-[var(--ink)]">{enlargedPreview.title}</p>
              <button
                type="button"
                className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-2 py-1 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                onClick={() => setEnlargedPreview(null)}
              >
                Close
              </button>
            </div>
            <div className="h-[calc(94vh-52px)] overflow-auto rounded-xl bg-slate-950/25 p-2">
              <img src={enlargedPreview.src} alt={enlargedPreview.alt} className="mx-auto h-full w-full object-contain" />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}