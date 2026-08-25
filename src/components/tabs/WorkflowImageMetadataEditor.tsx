import { useEffect, useState } from 'react';
import type { WorkflowImageMetadataRecord } from '@/services/workflowImageMetadata';
import {
  getSortedWorkflowImageMetadata,
  reorderWorkflowImageMetadata,
  updateWorkflowImageAltText,
  updateWorkflowImageInclusion,
  updateWorkflowImageRole,
} from '@/services/workflowImageMetadata';
import {
  createWorkflowImageRoleOption,
  findWorkflowImageRoleOption,
  getWorkflowImageRoleSelectValue,
  loadWorkflowImageRoleOptions,
  toWorkflowImageRoleSelection,
  type WorkflowImageRoleSelectOption,
} from '@/services/workflowImageRoles';
import { ApprovalSelect } from '@/components/approval/ApprovalSelect';

export interface WorkflowImageMetadataEditorProps {
  metadata: WorkflowImageMetadataRecord[];
  onChange: (nextMetadata: WorkflowImageMetadataRecord[]) => void;
  allowReorder?: boolean;
  disabled?: boolean;
  title: string;
  description: string;
  emptyMessage: string;
  className?: string;
}

function getNextIsoTimestamp(): string {
  return new Date().toISOString();
}

export function WorkflowImageMetadataEditor({
  metadata,
  onChange,
  allowReorder = false,
  disabled = false,
  title,
  description,
  emptyMessage,
  className = '',
}: WorkflowImageMetadataEditorProps) {
  const sortedMetadata = getSortedWorkflowImageMetadata(metadata);
  const [imageRoleOptions, setImageRoleOptions] = useState<WorkflowImageRoleSelectOption[]>([]);
  const [savingCustomRoleUrl, setSavingCustomRoleUrl] = useState<string | null>(null);
  const [customRoleSaveErrors, setCustomRoleSaveErrors] = useState<Record<string, string>>({});
  const [customRoleSaveSuccess, setCustomRoleSaveSuccess] = useState<Record<string, string>>({});

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

  const addCustomRoleToSharedTable = async (record: WorkflowImageMetadataRecord) => {
    const customRoleValue = (record.customImageRole ?? '').trim();
    if (!customRoleValue) {
      setCustomRoleSaveErrors((current) => ({
        ...current,
        [record.url]: 'Enter a custom image role before adding it to Airtable.',
      }));
      setCustomRoleSaveSuccess((current) => ({ ...current, [record.url]: '' }));
      return;
    }

    const existing = findWorkflowImageRoleOption(imageRoleOptions, customRoleValue);
    if (existing) {
      const existingSelection = toWorkflowImageRoleSelection(existing.value, customRoleValue);
      setCustomRoleSaveErrors((current) => ({ ...current, [record.url]: '' }));
      setCustomRoleSaveSuccess((current) => ({
        ...current,
        [record.url]: 'Role already exists in shared Airtable roles and is now selected.',
      }));
      onChange(updateWorkflowImageRole(
        sortedMetadata,
        record.url,
        existingSelection.imageRole,
        existingSelection.customImageRole,
        getNextIsoTimestamp(),
      ));
      return;
    }

    setSavingCustomRoleUrl(record.url);
    setCustomRoleSaveErrors((current) => ({ ...current, [record.url]: '' }));
    setCustomRoleSaveSuccess((current) => ({ ...current, [record.url]: '' }));
    try {
      const createdOption = await createWorkflowImageRoleOption(customRoleValue);
      const refreshedOptions = await loadWorkflowImageRoleOptions();
      setImageRoleOptions(refreshedOptions);

      const selectedOption = findWorkflowImageRoleOption(refreshedOptions, customRoleValue) ?? createdOption;
      const createdSelection = toWorkflowImageRoleSelection(selectedOption.value, customRoleValue);
      onChange(updateWorkflowImageRole(
        sortedMetadata,
        record.url,
        createdSelection.imageRole,
        createdSelection.customImageRole,
        getNextIsoTimestamp(),
      ));
      setCustomRoleSaveSuccess((current) => ({
        ...current,
        [record.url]: 'Added to shared Airtable roles.',
      }));
    } catch (error) {
      setCustomRoleSaveErrors((current) => ({
        ...current,
        [record.url]: error instanceof Error ? error.message : 'Unable to add role to Airtable.',
      }));
      setCustomRoleSaveSuccess((current) => ({ ...current, [record.url]: '' }));
    } finally {
      setSavingCustomRoleUrl(null);
    }
  };

  const moveRecord = (url: string, direction: -1 | 1) => {
    const orderedUrls = sortedMetadata.map((record) => record.url);
    const currentIndex = orderedUrls.findIndex((value) => value === url);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= orderedUrls.length) return;

    const nextUrls = [...orderedUrls];
    const [movedUrl] = nextUrls.splice(currentIndex, 1);
    nextUrls.splice(nextIndex, 0, movedUrl);
    onChange(reorderWorkflowImageMetadata(sortedMetadata, nextUrls));
  };

  return (
    <section className={`rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5 ${className}`.trim()}>
      <div>
        <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{title}</p>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
      </div>

      {sortedMetadata.length === 0 ? (
        <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4 text-sm text-[var(--muted)]">
          {emptyMessage}
        </div>
      ) : (
        <div className="mt-4 grid gap-4">
          {sortedMetadata.map((record, index) => {
            const canMoveEarlier = allowReorder && index > 0;
            const canMoveLater = allowReorder && index < sortedMetadata.length - 1;

            return (
              <article
                key={record.attachmentId ?? record.url}
                data-testid="workflow-image-metadata-card"
                className="grid gap-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4 lg:grid-cols-[180px_minmax(0,1fr)]"
              >
                <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-slate-950/20">
                  <img
                    src={record.url}
                    alt={record.alt || record.filename}
                    className="h-full min-h-[140px] w-full object-cover"
                    loading="lazy"
                  />
                </div>

                <div className="flex min-w-0 flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-semibold text-[var(--ink)]">
                      #{record.sortOrder}
                    </span>
                    <span className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                      {record.sourceStage}
                    </span>
                    <span className="truncate text-sm font-semibold text-[var(--ink)]">{record.filename}</span>
                  </div>

                  <label className="block">
                    <span className="text-sm font-semibold text-[var(--ink)]">Image Role</span>
                    <ApprovalSelect
                      selectClassName="mt-2 w-full appearance-none rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 pr-10 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                      value={getWorkflowImageRoleSelectValue(record.imageRole, record.customImageRole, imageRoleOptions)}
                      onChange={(event) => {
                        const selection = toWorkflowImageRoleSelection(event.currentTarget.value, record.customImageRole ?? '');
                        onChange(updateWorkflowImageRole(
                          sortedMetadata,
                          record.url,
                          selection.imageRole,
                          selection.customImageRole,
                          getNextIsoTimestamp(),
                        ));
                      }}
                      disabled={disabled}
                      selectProps={{ 'aria-label': `Image role for ${record.filename}` }}
                    >
                      <option value="">Select image role</option>
                      {imageRoleOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </ApprovalSelect>
                  </label>

                  {record.imageRole === 'custom' ? (
                    <div className="grid gap-2">
                      <label className="block">
                        <span className="text-sm font-semibold text-[var(--ink)]">Custom Image Role</span>
                        <input
                          type="text"
                          className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                          value={record.customImageRole ?? ''}
                          onChange={(event) => {
                            setCustomRoleSaveErrors((current) => ({ ...current, [record.url]: '' }));
                            setCustomRoleSaveSuccess((current) => ({ ...current, [record.url]: '' }));
                            onChange(updateWorkflowImageRole(sortedMetadata, record.url, record.imageRole, event.currentTarget.value, getNextIsoTimestamp()));
                          }}
                          placeholder="For example: side profile"
                          aria-label={`Custom image role for ${record.filename}`}
                          disabled={disabled}
                        />
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => {
                            void addCustomRoleToSharedTable(record);
                          }}
                          disabled={disabled || savingCustomRoleUrl === record.url}
                        >
                          {savingCustomRoleUrl === record.url ? 'Saving…' : 'Save'}
                        </button>
                        <span className="text-xs text-[var(--muted)]">Saves this custom role to the shared Airtable roles table.</span>
                      </div>
                      {customRoleSaveErrors[record.url] ? (
                        <p className="m-0 text-xs text-rose-300">{customRoleSaveErrors[record.url]}</p>
                      ) : null}
                      {customRoleSaveSuccess[record.url] ? (
                        <p className="m-0 text-xs text-emerald-300">{customRoleSaveSuccess[record.url]}</p>
                      ) : null}
                    </div>
                  ) : null}

                  <label className="block">
                    <span className="text-sm font-semibold text-[var(--ink)]">Alt Text</span>
                    <input
                      type="text"
                      className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                      value={record.alt}
                      onChange={(event) => onChange(updateWorkflowImageAltText(sortedMetadata, record.url, event.currentTarget.value, getNextIsoTimestamp()))}
                      placeholder="Describe the image for listings and accessibility"
                      aria-label={`Alt text for ${record.filename}`}
                      disabled={disabled}
                    />
                  </label>

                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-slate-950/20 px-3 py-2 text-sm text-[var(--ink)]">
                      <input
                        type="checkbox"
                        checked={record.includedInListing}
                        onChange={(event) => onChange(updateWorkflowImageInclusion(sortedMetadata, record.url, event.currentTarget.checked, getNextIsoTimestamp()))}
                        disabled={disabled}
                        aria-label={`Include ${record.filename} in listings`}
                      />
                      Include in listings by default
                    </label>

                    {allowReorder ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => moveRecord(record.url, -1)}
                          disabled={disabled || !canMoveEarlier}
                        >
                          Move earlier
                        </button>
                        <button
                          type="button"
                          className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => moveRecord(record.url, 1)}
                          disabled={disabled || !canMoveLater}
                        >
                          Move later
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}