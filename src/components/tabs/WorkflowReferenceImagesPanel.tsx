interface WorkflowReferenceImage {
  id?: string;
  url?: string;
  filename: string;
}

interface WorkflowReferenceImagesPanelProps {
  title: string;
  description: string;
  images: WorkflowReferenceImage[];
}

function getGoogleDriveFileId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('drive.google.com')) {
      return null;
    }

    const queryId = parsed.searchParams.get('id')?.trim();
    if (queryId) {
      return queryId;
    }

    const pathMatch = parsed.pathname.match(/\/d\/([^/]+)/);
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

export function WorkflowReferenceImagesPanel({ title, description, images }: WorkflowReferenceImagesPanelProps) {
  if (images.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)]/60 p-4">
      <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {images.map((image) => {
          const previewUrl = getReferencePreviewUrl(image.url);

          return (
          <div key={image.id ?? `${image.filename}-${image.url ?? ''}`} className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--bg)]">
            {previewUrl ? (
              <a href={image.url} target="_blank" rel="noreferrer" className="block">
                <img src={previewUrl} alt={image.filename} className="aspect-[4/3] w-full bg-slate-950/30 object-cover" loading="lazy" referrerPolicy="no-referrer" />
              </a>
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center bg-slate-950/30 px-4 text-center text-sm text-[var(--muted)]">
                Preview unavailable
              </div>
            )}
            <div className="px-3 py-2.5 text-sm text-[var(--ink)]">{image.filename}</div>
          </div>
          );
        })}
      </div>
    </div>
  );
}