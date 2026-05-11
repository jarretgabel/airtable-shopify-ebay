import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
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
  description?: string;
  className?: string;
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
  description = 'Add photos, compare the original against edited output, and process images before upload with shared defaults or per-image overrides.',
  className = '',
}: FormImageUploadEditorProps) {
  const [defaultSettings, setDefaultSettings] = useState<FormImageProcessingDefaults>(() => loadFormImageProcessingDefaults());
  const [items, setItems] = useState<EditableUploadItem[]>([]);
  const [defaultsSavedNotice, setDefaultsSavedNotice] = useState(false);
  const [defaultsExpanded, setDefaultsExpanded] = useState(false);
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
  }, [resetKey]);

  useEffect(() => {
    onFilesChangeRef.current(toUploadFiles(items));
  }, [items]);

  const hasItemsToProcess = useMemo(
    () => items.some((item) => item.status === 'idle' || item.status === 'done' || item.status === 'error'),
    [items],
  );

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFiles = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith('image/'));
    if (nextFiles.length === 0) return;

    setItems((current) => ([...current, ...nextFiles.map((file) => createUploadItem(file, defaultSettings))]));
    event.target.value = '';
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
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{title}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
          >
            Add images
          </button>
          <button
            type="button"
            className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={applyDefaultsToAll}
            disabled={disabled || items.length === 0}
          >
            Apply defaults to all
          </button>
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

      <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4">
        <div className="flex items-start justify-between gap-3">
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
          <div id="form-image-default-options" className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid flex-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
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

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)]">
                <input
                  type="checkbox"
                  checked={defaultSettings.watermarkEnabled}
                  onChange={(event) => {
                    const nextWatermarkEnabled = event.currentTarget.checked;
                    setDefaultSettings((current) => ({ ...current, watermarkEnabled: nextWatermarkEnabled }));
                  }}
                  disabled={disabled}
                />
                Enable watermark by default
              </label>

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
        ) : null}
      </div>

      <p className="mt-4 text-sm text-[var(--muted)]">
        Current upload set: <strong className="text-[var(--ink)]">{items.length}</strong> image{items.length === 1 ? '' : 's'}.
        Processed files replace originals for upload, and unprocessed files upload as originally selected.
      </p>

      {items.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--bg)] px-5 py-8 text-center text-sm text-[var(--muted)]">
          Add images to start editing. You can watermark in batches, crop and rename per image, and compare originals against the processed output before saving the form.
        </div>
      ) : (
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
      )}
    </section>
  );
}