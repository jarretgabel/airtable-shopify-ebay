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

export function WorkflowReferenceImagesPanel({ title, description, images }: WorkflowReferenceImagesPanelProps) {
  if (images.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)]/60 p-4">
      <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {images.map((image) => (
          <div key={image.id ?? `${image.filename}-${image.url ?? ''}`} className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--bg)]">
            {image.url ? (
              <a href={image.url} target="_blank" rel="noreferrer" className="block">
                <img src={image.url} alt={image.filename} className="aspect-[4/3] w-full bg-slate-950/30 object-cover" loading="lazy" />
              </a>
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center bg-slate-950/30 px-4 text-center text-sm text-[var(--muted)]">
                Preview unavailable
              </div>
            )}
            <div className="px-3 py-2.5 text-sm text-[var(--ink)]">{image.filename}</div>
          </div>
        ))}
      </div>
    </div>
  );
}