import { useEffect, useRef, useState } from 'react';
import { isGoogleDriveImageUrl } from '@/services/workflowImageMetadata';
import { getConfiguredWorkflowImagePreview } from '@/services/app-api/airtable';

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

function getGoogleDriveFileId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname !== 'drive.google.com'
      && hostname !== 'docs.google.com'
      && hostname !== 'drive.usercontent.google.com'
      && hostname !== 'googleusercontent.com'
      && !hostname.endsWith('.googleusercontent.com')
    ) {
      return null;
    }

    const queryId = parsed.searchParams.get('id')?.trim();
    if (queryId) {
      return queryId;
    }

    const pathMatch = parsed.pathname.match(/\/(?:file\/)?d\/([^/]+)/i);
    return pathMatch?.[1] ?? null;
  } catch {
    return null;
  }
}

function getReferencePreviewUrl(url?: string): string | undefined {
  if (!url) {
    return undefined;
  }

  const fileId = getGoogleDriveFileId(url);
  if (!fileId) {
    return url;
  }

  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1600`;
}

export function WorkflowReferenceImageCard({
  image,
  recordSource,
  recordId,
}: {
  image: WorkflowReferenceImage;
  recordSource?: WorkflowImagePreviewSource;
  recordId?: string;
}) {
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState('');
  const fileId = image.url ? getGoogleDriveFileId(image.url) : null;

  useEffect(() => {
    const node = imageContainerRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setIsNearViewport(true);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setIsNearViewport(true);
        observer.disconnect();
      }
    }, { rootMargin: '300px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isNearViewport) return;

    if (!recordSource || !recordId || !fileId) {
      setPreviewDataUrl(getReferencePreviewUrl(image.url) ?? null);
      return;
    }

    let active = true;
    setPreviewDataUrl(null);
    setPreviewError('');
    void getConfiguredWorkflowImagePreview(recordSource, recordId, fileId)
      .then(({ dataUrl }) => {
        if (active) setPreviewDataUrl(dataUrl);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setPreviewError(error instanceof Error ? error.message : 'Unable to load this image preview.');
      });

    return () => {
      active = false;
    };
  }, [fileId, image.url, isNearViewport, recordId, recordSource]);

  return (
    <div ref={imageContainerRef} className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--bg)]">
      {previewDataUrl ? (
        <a href={image.url} target="_blank" rel="noreferrer" className="block">
          <img
            src={previewDataUrl}
            alt={image.alt || image.filename}
            className="aspect-[4/3] w-full bg-slate-950/30 object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => {
              setPreviewDataUrl(null);
              setPreviewError('The image data could not be displayed.');
            }}
          />
        </a>
      ) : (
        <div
          className="flex aspect-[4/3] items-center justify-center bg-slate-950/30 px-4 text-center text-sm text-[var(--muted)]"
          role={previewError ? 'alert' : 'status'}
        >
          {previewError || (isNearViewport ? 'Loading image preview...' : 'Image preview loads when visible.')}
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
  recordSource,
  recordId,
}: WorkflowReferenceImagesPanelProps) {
  const googleDriveImages = images.filter((image) => (
    Boolean(image.url && isGoogleDriveImageUrl(image.url))
  ));

  if (googleDriveImages.length === 0) {
    return null;
  }

  const panelBody = (
    <>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {googleDriveImages.map((image) => {
          return (
            <WorkflowReferenceImageCard
              key={image.id ?? `${image.filename}-${image.url ?? ''}`}
              image={image}
              recordSource={recordSource}
              recordId={recordId}
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