import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent, type ReactNode } from 'react';
import { FormImageCropPreview } from '@/components/tabs/FormImageCropPreview';
import {
  buildProcessingOptions,
  loadFormImageProcessingDefaults,
  saveFormImageProcessingDefaults,
  type FormImageProcessingDefaults,
} from '@/services/formImageProcessingDefaults';
import { formatBytes, processImage, revokeProcessedImage, type ProcessedImage } from '@/services/imageProcessor';

interface EditableUploadItem {
  id: string;
  originalFile: File;
  originalUrl: string;
  editedFile: File | null;
  processed: ProcessedImage | null;
  status: 'idle' | 'processing' | 'done' | 'error';
  error?: string;
  outputFilename: string;
  settings: FormImageProcessingDefaults;
  optionsExpanded: boolean;
}

export interface FormImageUploadEditorProps {
  onFilesChange: (files: File[]) => void;
  resetKey?: string | number;
  disabled?: boolean;
  title?: string;
  required?: boolean;
  description?: string;
  className?: string;
  afterUploadContent?: ReactNode;
}

function buildDefaultOutputFilename(fileName: string): string {
  const stem = fileName.replace(/\.[^.]+$/, '');
  return `${stem}_edited.jpg`;
}

function createUploadItem(file: File, defaults: FormImageProcessingDefaults): EditableUploadItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    originalFile: file,
    originalUrl: URL.createObjectURL(file),
    editedFile: null,
    processed: null,
    status: 'idle',
    outputFilename: buildDefaultOutputFilename(file.name),
    optionsExpanded: true,
    settings: {
      ...defaults,
      crop: { ...defaults.crop },
    },
  };
}

function disposeItem(item: EditableUploadItem) {
  URL.revokeObjectURL(item.originalUrl);
  if (item.processed) {
    revokeProcessedImage(item.processed);
  }
}

function toUploadFiles(items: EditableUploadItem[]): File[] {
  return items.map((item) => item.editedFile ?? item.originalFile);
}

export function FormImageUploadEditor({
  onFilesChange,
  resetKey = 0,
  disabled = false,
  title = 'Upload Images',
  required = false,
  description,
  className = '',
  afterUploadContent,
}: FormImageUploadEditorProps) {
  const [defaultSettings, setDefaultSettings] = useState<FormImageProcessingDefaults>(() => loadFormImageProcessingDefaults());
  const [items, setItems] = useState<EditableUploadItem[]>([]);
  const [defaultsSavedNotice, setDefaultsSavedNotice] = useState(false);
  const [defaultsExpanded, setDefaultsExpanded] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const itemsRef = useRef<EditableUploadItem[]>([]);
  const onFilesChangeRef = useRef(onFilesChange);

  useEffect(() => {
    onFilesChangeRef.current = onFilesChange;
  }, [onFilesChange]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

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
    setDefaultsExpanded(false);
  }, [resetKey]);

  useEffect(() => {
    onFilesChangeRef.current(toUploadFiles(items));
  }, [items]);

  useEffect(() => {
    if (items.length > 0) {
      setDefaultsExpanded(true);
    }
  }, [items.length]);

  const hasItemsToProcess = useMemo(
    () => items.some((item) => item.status === 'idle' || item.status === 'done' || item.status === 'error'),
    [items],
  );

  const addFiles = (files: File[]) => {
    const nextFiles = files.filter((file) => file.type.startsWith('image/'));
    if (nextFiles.length === 0) return;

    setItems((current) => ([...current, ...nextFiles.map((file) => createUploadItem(file, defaultSettings))]));
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

  const handleDropzoneDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    if (disabled) return;
    addFiles(Array.from(event.dataTransfer.files ?? []));
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

  const applyDefaultsToAll = () => {
    setItems((current) => current.map((item) => ({
      ...item,
      settings: {
        ...defaultSettings,
        crop: { ...defaultSettings.crop },
      },
    })));
  };

  const toggleItemOptions = (itemId: string) => {
    updateItem(itemId, (item) => ({
      ...item,
      optionsExpanded: !item.optionsExpanded,
    }));
  };

  const resetItemEdits = (itemId: string) => {
    updateItem(itemId, (item) => {
      if (item.processed) revokeProcessedImage(item.processed);
      return {
        ...item,
        editedFile: null,
        processed: null,
        status: 'idle',
        error: undefined,
        outputFilename: buildDefaultOutputFilename(item.originalFile.name),
        settings: {
          ...defaultSettings,
          crop: { ...defaultSettings.crop },
        },
      };
    });
  };

  const processSingleItem = async (itemId: string) => {
    const currentItem = items.find((item) => item.id === itemId);
    if (!currentItem) return;

    updateItem(itemId, (item) => ({ ...item, status: 'processing', error: undefined }));

    try {
      const processed = await processImage(
        currentItem.originalFile,
        buildProcessingOptions(currentItem.settings, currentItem.outputFilename),
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
    for (const item of items) {
      await processSingleItem(item.id);
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
                  {isDragActive ? 'Drop images to add them' : 'Drag and drop images here'}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)] sm:text-base">
                  {isDragActive ? 'Release to add these files to the upload set.' : 'Click anywhere in this area or drop image files to start a photo upload set.'}
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
                      onClick={applyDefaultsToAll}
                      disabled={disabled || items.length === 0}
                      title="Copies the current default resize and watermark settings into every uploaded image."
                    >
                      Apply defaults to all
                    </button>
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
          Processed files replace originals for upload, and unprocessed files upload as originally selected.
        </p>
      ) : null}

      {items.length > 0 ? (
        <div className="mt-4 grid gap-5">
          {items.map((item) => (
            <article key={item.id} className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p className="m-0 text-sm font-semibold text-[var(--ink)]">{item.originalFile.name}</p>
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
                    onClick={() => toggleItemOptions(item.id)}
                    disabled={disabled}
                    aria-expanded={item.optionsExpanded}
                    aria-controls={`image-options-${item.id}`}
                  >
                    {item.optionsExpanded ? 'Hide options' : 'Show options'}
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => {
                      void processSingleItem(item.id);
                    }}
                    disabled={disabled || item.status === 'processing'}
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
                {item.optionsExpanded ? (
                  <div id={`image-options-${item.id}`} className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormImageCropPreview
                        imageUrl={item.originalUrl}
                        alt={`Original ${item.originalFile.name}`}
                        crop={item.settings.crop}
                        onCropChange={(nextCrop) => updateItem(item.id, (current) => ({
                          ...current,
                          settings: {
                            ...current.settings,
                            crop: nextCrop,
                          },
                        }))}
                        disabled={disabled}
                      />
                      <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-slate-950/30">
                        <div className="border-b border-[var(--line)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Edited preview</div>
                        {item.processed ? (
                          <img src={item.processed.objectUrl} alt={`Edited ${item.processed.filename}`} className="h-72 w-full object-contain" />
                        ) : (
                          <div className="flex h-72 items-center justify-center px-4 text-center text-sm text-[var(--muted)]">
                            Apply edits to generate the upload version and compare it against the original file.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-4">
                      <label className="block">
                        <span className="text-sm font-semibold text-[var(--ink)]">Output filename</span>
                        <input
                          type="text"
                          className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                          value={item.outputFilename}
                          onChange={(event) => {
                            const nextOutputFilename = event.currentTarget.value;
                            updateItem(item.id, (current) => ({ ...current, outputFilename: nextOutputFilename }));
                          }}
                          disabled={disabled}
                        />
                      </label>

                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="block">
                          <span className="text-sm font-semibold text-[var(--ink)]">Max size</span>
                          <select
                            className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                            value={item.settings.maxPx}
                            onChange={(event) => {
                              const nextMaxPx = Number(event.currentTarget.value);
                              updateItem(item.id, (current) => ({
                                ...current,
                                settings: {
                                  ...current.settings,
                                  maxPx: nextMaxPx,
                                },
                              }));
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
                          <span className="text-sm font-semibold text-[var(--ink)]">JPEG quality</span>
                          <input
                            type="number"
                            min={40}
                            max={100}
                            className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                            value={item.settings.quality}
                            onChange={(event) => {
                              const nextQuality = Number(event.currentTarget.value);
                              updateItem(item.id, (current) => ({
                                ...current,
                                settings: {
                                  ...current.settings,
                                  quality: nextQuality,
                                },
                              }));
                            }}
                            disabled={disabled}
                          />
                        </label>
                      </div>

                      <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="m-0 text-sm font-semibold text-[var(--ink)]">Watermark</p>
                          <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
                            <input
                              type="checkbox"
                              checked={item.settings.watermarkEnabled}
                              onChange={(event) => {
                                const nextWatermarkEnabled = event.currentTarget.checked;
                                updateItem(item.id, (current) => ({
                                  ...current,
                                  settings: {
                                    ...current.settings,
                                    watermarkEnabled: nextWatermarkEnabled,
                                  },
                                }));
                              }}
                              disabled={disabled}
                            />
                            Enabled
                          </label>
                        </div>

                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <label className="block">
                            <span className="text-sm font-semibold text-[var(--ink)]">Text</span>
                            <input
                              type="text"
                              className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                              value={item.settings.watermarkText}
                              onChange={(event) => {
                                const nextWatermarkText = event.currentTarget.value;
                                updateItem(item.id, (current) => ({
                                  ...current,
                                  settings: {
                                    ...current.settings,
                                    watermarkText: nextWatermarkText,
                                  },
                                }));
                              }}
                              disabled={disabled}
                            />
                          </label>

                          <label className="block">
                            <span className="text-sm font-semibold text-[var(--ink)]">Position</span>
                            <select
                              className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                              value={item.settings.watermarkPos}
                              onChange={(event) => {
                                const nextWatermarkPos = event.currentTarget.value as FormImageProcessingDefaults['watermarkPos'];
                                updateItem(item.id, (current) => ({
                                  ...current,
                                  settings: {
                                    ...current.settings,
                                    watermarkPos: nextWatermarkPos,
                                  },
                                }));
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
                      </div>

                      <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4">
                        <p className="m-0 text-sm font-semibold text-[var(--ink)]">Crop percentages</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">Trim from the edges before resizing. Keep totals under 95% per axis.</p>
                        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                          {([
                            ['left', 'Left'],
                            ['top', 'Top'],
                            ['right', 'Right'],
                            ['bottom', 'Bottom'],
                          ] as const).map(([key, label]) => (
                            <label key={key} className="block">
                              <span className="text-sm font-semibold text-[var(--ink)]">{label}</span>
                              <input
                                type="number"
                                min={0}
                                max={45}
                                step={0.5}
                                className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                                value={item.settings.crop[key]}
                                onChange={(event) => {
                                  const nextCropValue = Number(event.currentTarget.value);
                                  updateItem(item.id, (current) => ({
                                    ...current,
                                    settings: {
                                      ...current.settings,
                                      crop: {
                                        ...current.settings.crop,
                                        [key]: nextCropValue,
                                      },
                                    },
                                  }));
                                }}
                                disabled={disabled}
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
            </article>
          ))}
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
    </section>
  );
}