import { useMemo, useRef, useState } from 'react';

interface Props {
  fieldLabel: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

interface EditableImage {
  src: string;
  alt: string;
}

/**
 * Parses a form value into editable image rows.
 * Accepts JSON arrays of strings OR objects with `.src` and optional `.alt`.
 * Falls back to comma / newline splitting for plain text.
 */
function parseImages(raw: string): EditableImage[] {
  const trimmed = raw.trim();
  if (!trimmed) return [{ src: '', alt: '' }];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return [{ src: '', alt: '' }];
      const images = parsed.map((item) => {
        if (typeof item === 'string') {
          return {
            src: item,
            alt: '',
          };
        }
        if (item && typeof item === 'object') {
          const image = item as Record<string, unknown>;
          return {
            src: typeof image.src === 'string' ? image.src : '',
            alt: typeof image.alt === 'string' ? image.alt : '',
          };
        }
        return { src: '', alt: '' };
      });
      return images.length > 0 ? images : [{ src: '', alt: '' }];
    }
  } catch {
    // fall through to plain-text splitting
  }

  const parts = trimmed.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return [{ src: '', alt: '' }];
  return parts.map((src) => ({ src, alt: '' }));
}

function toSerializedImages(images: EditableImage[]): string {
  return JSON.stringify(images.map((image) => ({
    src: image.src,
    alt: image.alt,
  })));
}

const inputClass =
  'flex-1 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2.5 py-1.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-400/30 disabled:cursor-not-allowed disabled:opacity-70';
const labelClass = 'mb-1 block text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]';

function DragHandle({ disabled }: { disabled: boolean }) {
  return (
    <span
      className={`px-0.5 select-none text-[var(--muted)] ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-grab active:cursor-grabbing'}`}
      title="Drag to reorder"
      aria-hidden="true"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
        <circle cx="4" cy="3" r="1.2" />
        <circle cx="10" cy="3" r="1.2" />
        <circle cx="4" cy="7" r="1.2" />
        <circle cx="10" cy="7" r="1.2" />
        <circle cx="4" cy="11" r="1.2" />
        <circle cx="10" cy="11" r="1.2" />
      </svg>
    </span>
  );
}

export function ImageUrlListEditor({ fieldLabel, value, onChange, disabled = false }: Props) {
  const images = useMemo(() => parseImages(value), [value]);

  // Drag-and-drop state — tracks which index is being dragged and which is the drop target
  const dragNodeIndex = useRef<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  function handleUrlChange(index: number, newUrl: string) {
    const next = [...images];
    next[index] = {
      ...next[index],
      src: newUrl,
    };
    // Preserve empty slots so the cursor doesn't jump while typing
    onChange(toSerializedImages(next));
  }

  function handleAltChange(index: number, newAlt: string) {
    const next = [...images];
    next[index] = {
      ...next[index],
      alt: newAlt,
    };
    // Preserve empty slots so the cursor doesn't jump while typing
    onChange(toSerializedImages(next));
  }

  function handleAdd() {
    onChange(toSerializedImages([...images, { src: '', alt: '' }]));
  }

  function handleRemove(index: number) {
    const next = images.filter((_, i) => i !== index);
    onChange(toSerializedImages(next));
  }

  function handleDragStart(index: number) {
    dragNodeIndex.current = index;
    setDragIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragNodeIndex.current !== index) {
      setDropIndex(index);
    }
  }

  function handleDrop(targetIndex: number) {
    const fromIndex = dragNodeIndex.current;
    resetDrag();
    if (fromIndex === null || fromIndex === targetIndex) return;

    const next = [...images];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(targetIndex, 0, moved);
    onChange(toSerializedImages(next));
  }

  function handleDragEnd() {
    resetDrag();
  }

  function resetDrag() {
    dragNodeIndex.current = null;
    setDragIndex(null);
    setDropIndex(null);
  }

  return (
    <fieldset className="col-span-1 flex flex-col gap-1.5 md:col-span-2">
      <legend className={labelClass}>{fieldLabel}</legend>
      <div className="flex flex-col gap-1.5">
        {images.map((image, index) => {
          const isDragging = dragIndex === index;
          const isDropTarget = dropIndex === index && dragIndex !== index;

          return (
            <div
              key={index}
              draggable={!disabled}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
              className={[
                'flex items-start gap-2 rounded-xl border px-2 py-1.5 transition-all duration-100',
                isDragging
                  ? 'opacity-40 border-[var(--accent)] bg-[var(--bg)]'
                  : isDropTarget
                    ? 'border-[var(--accent)] bg-blue-500/10 shadow-[0_0_0_2px_rgba(59,130,246,0.25)]'
                    : 'border-[var(--line)] bg-[var(--panel)]',
              ].join(' ')}
            >
              <div className="flex items-center gap-2 pt-1">
                <DragHandle disabled={disabled} />
                <span className="min-w-[1.25rem] text-center font-mono text-[0.65rem] font-bold text-[var(--muted)]">{index + 1}</span>
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-1.5 lg:flex-row">
                <input
                  type="url"
                  draggable={false}
                  className={`${inputClass} lg:basis-3/5`}
                  placeholder="https://example.com/image.jpg"
                  value={image.src}
                  onChange={(e) => handleUrlChange(index, e.target.value)}
                  disabled={disabled}
                  aria-label={`Image URL ${index + 1}`}
                />

                <input
                  type="text"
                  draggable={false}
                  className={`${inputClass} lg:basis-2/5`}
                  placeholder="Alt text (used for accessibility and SEO)"
                  value={image.alt}
                  onChange={(e) => handleAltChange(index, e.target.value)}
                  disabled={disabled}
                  aria-label={`Image alt text ${index + 1}`}
                />
              </div>

              <button
                type="button"
                onClick={() => handleRemove(index)}
                disabled={disabled}
                aria-label={`Remove image ${index + 1}`}
                className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-rose-500/20 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M2 2l9 9M11 2L2 11" />
                </svg>
              </button>
            </div>
          );
        })}

        <button
          type="button"
          onClick={handleAdd}
          disabled={disabled}
          className="mt-0.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--line)] py-2 text-[0.78rem] font-medium text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M6.5 1v11M1 6.5h11" />
          </svg>
          Add image
        </button>
      </div>
    </fieldset>
  );
}
