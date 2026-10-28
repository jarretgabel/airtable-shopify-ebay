import { getImageVariantUrl } from '@/services/imageVariantUrl';
import { useState } from 'react';
import { isArchivedWorkflowImageUrl } from '@/services/workflowImageMetadata';

export type WorkflowImagePreviewSource = 'used-gear-workflow' | 'approval-combined';

interface WorkflowReferenceImage {
  id?: string;
  url?: string;
  filename: string;
  alt?: string;
}

interface WorkflowReferenceImagesPanelProps {
  title: string;
  description: string;
  images: WorkflowReferenceImage[];
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  recordSource?: WorkflowImagePreviewSource;
  recordId?: string;
}

export function WorkflowReferenceImageCard({ image }: { image: WorkflowReferenceImage }) {
  const [previewError, setPreviewError] = useState('');
  const previewUrl = image.url ? getImageVariantUrl(image.url, 800) : '';

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--bg)]">
      {previewUrl && !previewError ? (
        <a href={image.url} target="_blank" rel="noreferrer" className="block">
          <img
            src={previewUrl}
            alt={image.alt || image.filename}
            className="aspect-[4/3] w-full bg-slate-950/30 object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setPreviewError('The image could not be displayed.')}
          />
        </a>
      ) : (
        <div
          className="flex aspect-[4/3] items-center justify-center bg-slate-950/30 px-4 text-center text-sm text-[var(--muted)]"
          role={previewError ? 'alert' : 'status'}
        >
          {previewError || 'No image preview available.'}
        </div>
      )}
      <div className="px-3 py-2.5 text-sm text-[var(--ink)]">{image.filename}</div>
    </div>
  );
}

export function WorkflowReferenceImagesPanel({
  title,
  description,
  images,
  collapsible = false,
  defaultCollapsed = false,
}: WorkflowReferenceImagesPanelProps) {
  const archivedImages = images.filter((image) => (
    Boolean(image.url && isArchivedWorkflowImageUrl(image.url))
  ));

  if (archivedImages.length === 0) {
    return null;
  }

  const panelBody = (
    <>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {archivedImages.map((image) => {
          return (
            <WorkflowReferenceImageCard
              key={image.id ?? `${image.filename}-${image.url ?? ''}`}
              image={image}
            />
          );
        })}
      </div>
    </>
  );

  if (collapsible) {
    return (
      <details className="group mt-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)]/60 p-4" open={!defaultCollapsed}>
        <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <svg
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-open:rotate-90"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 3.5 10.5 8 6 12.5" />
              </svg>
              <span>{title}</span>
            </div>
            <span className="text-[0.65rem] text-[var(--muted)]/80">{images.length} images</span>
          </div>
        </summary>
        <div className="mt-1">{panelBody}</div>
      </details>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)]/60 p-4">
      <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{title}</p>
      {panelBody}
    </div>
  );
}