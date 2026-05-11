import type { WorkflowListingImageAttachment } from '@/components/approval/workflowListingImageHelpers';

interface WorkflowListingImageSelectorProps {
  attachments: WorkflowListingImageAttachment[];
  selectedUrls: string[];
  onSelectionChange: (selectedUrls: string[]) => void;
  disabled?: boolean;
}

export function WorkflowListingImageSelector({
  attachments,
  selectedUrls,
  onSelectionChange,
  disabled = false,
}: WorkflowListingImageSelectorProps) {
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

  const renderImageCard = ({
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
        ? 'flex flex-col overflow-hidden rounded-2xl border border-[var(--accent)]/55 bg-[var(--accent)]/10 transition'
        : 'flex flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]/80 transition hover:border-[var(--accent)]/35'}
      data-testid={checked ? 'selected-listing-image-card' : 'available-listing-image-card'}
      draggable={checked && !disabled}
      onDragOver={checked ? (event) => event.preventDefault() : undefined}
      onDragStart={checked ? (event) => event.dataTransfer.setData('text/plain', attachment.url) : undefined}
      onDrop={checked ? (event) => {
        event.preventDefault();
        reorderSelectedUrls(event.dataTransfer.getData('text/plain'), attachment.url);
      } : undefined}
    >
      <div className="aspect-[4/3] bg-slate-950/30">
        <img
          alt={attachment.filename}
          className="h-full w-full object-cover"
          loading="lazy"
          src={attachment.url}
        />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-3">
        <div className="flex items-start gap-3">
          <input
            checked={checked}
            className="mt-1 h-4 w-4 rounded border-[var(--line)] bg-transparent text-[var(--accent)] focus:ring-[var(--accent)]"
            disabled={disabled}
            onChange={(event) => handleToggle(attachment.url, event.currentTarget.checked)}
            type="checkbox"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="m-0 break-words text-sm font-semibold text-[var(--ink)]">{attachment.filename}</p>
              {typeof index === 'number' ? (
                <span className="rounded-full border border-[var(--accent)]/35 bg-[var(--panel)] px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[var(--ink)]">
                  #{index + 1}
                </span>
              ) : null}
            </div>
            <p className="mt-1 break-all text-xs text-[var(--muted)]">{attachment.url}</p>
          </div>
        </div>
        {checked && typeof index === 'number' ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={disabled || index === 0}
              onClick={() => moveSelectedUrl(attachment.url, -1)}
            >
              Move earlier
            </button>
            <button
              type="button"
              className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={disabled || index === selectedAttachments.length - 1}
              onClick={() => moveSelectedUrl(attachment.url, 1)}
            >
              Move later
            </button>
          </div>
        ) : null}
      </div>
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
              <p className="m-0 text-xs text-[var(--muted)]">Drag selected cards to reorder or use the move controls.</p>
            </div>
            {selectedAttachments.length > 0 ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {selectedAttachments.map((attachment, index) => renderImageCard({ attachment, checked: true, index }))}
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
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {availableAttachments.map((attachment) => renderImageCard({ attachment, checked: false }))}
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-[var(--line)] bg-[var(--panel)]/60 px-4 py-5 text-sm text-[var(--muted)]">
                All uploaded workflow images are already included in this listing.
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}