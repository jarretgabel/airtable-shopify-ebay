import { useState, type ReactNode } from 'react';
import type { WorkflowListingImageAttachment } from '@/components/approval/workflowListingImageHelpers';

interface WorkflowListingImageSelectorProps {
  attachments: WorkflowListingImageAttachment[];
  selectedUrls: string[];
  imageAltByUrl?: Record<string, string>;
  onSelectionChange: (selectedUrls: string[]) => void;
  disabled?: boolean;
  sourceActions?: ReactNode;
}

export function WorkflowListingImageSelector({
  attachments,
  selectedUrls,
  imageAltByUrl = {},
  onSelectionChange,
  disabled = false,
  sourceActions,
}: WorkflowListingImageSelectorProps) {
  const [previewAttachment, setPreviewAttachment] = useState<WorkflowListingImageAttachment | null>(null);
  const selectedLookup = new Set(selectedUrls.map((url) => url.trim().toLowerCase()).filter(Boolean));
  const selectedCount = attachments.filter((attachment) => selectedLookup.has(attachment.url.trim().toLowerCase())).length;
  const attachmentLookup = new Map(
    attachments.map((attachment) => [attachment.url.trim().toLowerCase(), attachment] as const),
  );
  const selectedAttachments = selectedUrls
    .map((url) => attachmentLookup.get(url.trim().toLowerCase()))
    .filter((attachment): attachment is WorkflowListingImageAttachment => Boolean(attachment));
  const availableAttachments = attachments.filter((attachment) => !selectedLookup.has(attachment.url.trim().toLowerCase()));

  const handleToggle = (url: string, checked: boolean) => {
    const normalizedUrl = url.trim();
    if (!normalizedUrl) return;

    if (checked) {
      if (selectedLookup.has(normalizedUrl.toLowerCase())) return;
      onSelectionChange([...selectedUrls, normalizedUrl]);
      return;
    }

    onSelectionChange(selectedUrls.filter((selectedUrl) => selectedUrl.trim().toLowerCase() !== normalizedUrl.toLowerCase()));
  };

  const reorderSelectedUrls = (sourceUrl: string, targetUrl: string) => {
    const normalizedSourceUrl = sourceUrl.trim();
    const normalizedTargetUrl = targetUrl.trim();
    if (!normalizedSourceUrl || !normalizedTargetUrl || normalizedSourceUrl === normalizedTargetUrl) return;

    const nextSelectedUrls = [...selectedUrls];
    const sourceIndex = nextSelectedUrls.findIndex((url) => url.trim().toLowerCase() === normalizedSourceUrl.toLowerCase());
    const targetIndex = nextSelectedUrls.findIndex((url) => url.trim().toLowerCase() === normalizedTargetUrl.toLowerCase());
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;

    const [movedUrl] = nextSelectedUrls.splice(sourceIndex, 1);
    nextSelectedUrls.splice(targetIndex, 0, movedUrl);
    onSelectionChange(nextSelectedUrls);
  };

  const moveSelectedUrl = (url: string, direction: -1 | 1) => {
    const currentIndex = selectedUrls.findIndex((entry) => entry.trim().toLowerCase() === url.trim().toLowerCase());
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= selectedUrls.length) return;
    reorderSelectedUrls(selectedUrls[currentIndex], selectedUrls[targetIndex]);
  };

  const getImageAltText = (attachment: WorkflowListingImageAttachment): string => {
    const normalizedUrl = attachment.url.trim().toLowerCase();
    return imageAltByUrl[normalizedUrl]?.trim() || 'No alt text yet';
  };

  const renderImageRow = ({
    attachment,
    checked,
    index,
  }: {
    attachment: WorkflowListingImageAttachment;
    checked: boolean;
    index?: number;
  }) => (
    <article
      key={attachment.id ?? attachment.url}
      className={checked
        ? 'flex flex-col gap-3 rounded-2xl border border-[var(--accent)]/55 bg-[var(--accent)]/10 p-3 transition sm:flex-row sm:items-center'
        : 'flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)]/80 p-3 transition hover:border-[var(--accent)]/35 sm:flex-row sm:items-center'}
      data-testid={checked ? 'selected-listing-image-card' : 'available-listing-image-card'}
      draggable={checked && !disabled}
      onDragOver={checked ? (event) => event.preventDefault() : undefined}
      onDragStart={checked ? (event) => event.dataTransfer.setData('text/plain', attachment.url) : undefined}
      onDrop={checked ? (event) => {
        event.preventDefault();
        reorderSelectedUrls(event.dataTransfer.getData('text/plain'), attachment.url);
      } : undefined}
    >
      <div className="flex items-start gap-3 sm:flex-1 sm:items-center">
        <button
          type="button"
          aria-label={`Expand ${attachment.filename}`}
          className="group relative block h-20 w-28 shrink-0 overflow-hidden rounded-xl border border-[var(--line)] bg-slate-950/30 text-left transition hover:border-[var(--accent)]/45 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 sm:h-16 sm:w-24"
          onClick={() => setPreviewAttachment(attachment)}
        >
          <img
            alt={attachment.filename}
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
            loading="lazy"
            src={attachment.url}
          />
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-slate-950/70 px-2 py-1 text-white">
            <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="7" cy="7" r="3.75" />
              <path d="M9.8 9.8 13 13" />
            </svg>
          </span>
        </button>
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <input
            checked={checked}
            className="mt-1 h-4 w-4 rounded border-[var(--line)] bg-transparent text-[var(--accent)] focus:ring-[var(--accent)]"
            disabled={disabled}
            onChange={(event) => handleToggle(attachment.url, event.currentTarget.checked)}
            type="checkbox"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="m-0 break-words text-sm font-semibold text-[var(--ink)]">{attachment.filename}</p>
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">{getImageAltText(attachment)}</p>
          </div>
        </div>
      </div>
        {checked && typeof index === 'number' ? (
          <div className="flex items-center gap-2 sm:justify-end">
            <div className="flex flex-col gap-2">
              <button
                type="button"
                aria-label="Move image earlier"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--line)]/70 bg-[var(--panel)]/80 text-[var(--muted)] transition hover:border-[var(--accent)]/70 hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40"
                disabled={disabled || index === 0}
                onClick={() => moveSelectedUrl(attachment.url, -1)}
              >
                <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 12V4" />
                  <path d="M4.5 7.5L8 4l3.5 3.5" />
                </svg>
              </button>
              <button
                type="button"
                aria-label="Move image later"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--line)]/70 bg-[var(--panel)]/80 text-[var(--muted)] transition hover:border-[var(--accent)]/70 hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40"
                disabled={disabled || index === selectedAttachments.length - 1}
                onClick={() => moveSelectedUrl(attachment.url, 1)}
              >
                <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 4v8" />
                  <path d="M4.5 8.5L8 12l3.5-3.5" />
                </svg>
              </button>
            </div>
            <div
              aria-hidden="true"
              className="flex h-[3.75rem] w-6 shrink-0 items-center justify-center rounded-md border border-[var(--line)]/60 bg-[var(--panel)]/70 text-[var(--muted)]/80"
              title="Drag to reorder"
            >
              <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="5" cy="4" r="1.2" />
                <circle cx="11" cy="4" r="1.2" />
                <circle cx="5" cy="8" r="1.2" />
                <circle cx="11" cy="8" r="1.2" />
                <circle cx="5" cy="12" r="1.2" />
                <circle cx="11" cy="12" r="1.2" />
              </svg>
            </div>
          </div>
        ) : null}
    </article>
  );

  return (
    <section className="col-span-1 rounded-2xl border border-[var(--line)] bg-white/5 p-4 md:col-span-2" data-testid="workflow-listing-image-selector">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="m-0 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Listing Images</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Images now come from the Testing and Photos workflow forms. Toggle the ones that should be included in this listing.
          </p>
          {sourceActions ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {sourceActions}
            </div>
          ) : null}
        </div>
        <div className="rounded-full border border-[var(--line)] bg-[var(--panel)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink)]">
          {selectedCount} of {attachments.length} selected
        </div>
      </div>

      {attachments.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--line)] bg-[var(--panel)]/60 px-4 py-6 text-sm text-[var(--muted)]">
          Upload images in the Testing or Photos form before selecting them for the listing.
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Included In Listing</p>
              <p className="m-0 text-xs text-[var(--muted)]">Drag selected rows to reorder, use the move controls, or click a thumbnail to expand it.</p>
            </div>
            {selectedAttachments.length > 0 ? (
              <div className="mt-3 space-y-3">
                {selectedAttachments.map((attachment, index) => renderImageRow({ attachment, checked: true, index }))}
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-[var(--line)] bg-[var(--panel)]/60 px-4 py-5 text-sm text-[var(--muted)]">
                No images are currently included in this listing.
              </div>
            )}
          </div>

          <div>
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Available Workflow Uploads</p>
            {availableAttachments.length > 0 ? (
              <div className="mt-3 space-y-3">
                {availableAttachments.map((attachment) => renderImageRow({ attachment, checked: false }))}
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-[var(--line)] bg-[var(--panel)]/60 px-4 py-5 text-sm text-[var(--muted)]">
                All uploaded workflow images are already included in this listing.
              </div>
            )}
          </div>
        </div>
      )}

      {previewAttachment ? (
        <div
          aria-label="Expanded listing image preview"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
          role="dialog"
          onClick={() => setPreviewAttachment(null)}
        >
          <div
            className="w-full max-w-5xl overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-[var(--line)] px-4 py-3">
              <div className="min-w-0">
                <p className="m-0 truncate text-sm font-semibold text-[var(--ink)]">{previewAttachment.filename}</p>
                <p className="mt-1 truncate text-xs text-[var(--muted)]">{previewAttachment.url}</p>
              </div>
              <button
                type="button"
                className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                onClick={() => setPreviewAttachment(null)}
              >
                Close
              </button>
            </div>
            <div className="bg-slate-950/40 p-4">
              <img
                alt={previewAttachment.filename}
                className="max-h-[75vh] w-full rounded-xl object-contain"
                src={previewAttachment.url}
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}