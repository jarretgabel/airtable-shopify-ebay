import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import type { CropInsetsPercent } from '@/services/imageProcessor';

type CropEdge = 'left' | 'top' | 'right' | 'bottom';

export interface FormImageCropPreviewProps {
  imageUrl: string;
  alt: string;
  crop: CropInsetsPercent;
  onCropChange: (crop: CropInsetsPercent) => void;
  disabled?: boolean;
  className?: string;
}

interface DragState {
  edge: CropEdge;
  rect: DOMRect;
}

const HANDLE_LABELS: Record<CropEdge, string> = {
  left: 'Adjust left crop',
  top: 'Adjust top crop',
  right: 'Adjust right crop',
  bottom: 'Adjust bottom crop',
};

function roundCropPercent(value: number): number {
  return Math.round(value * 10) / 10;
}

function clampCropPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return roundCropPercent(Math.min(45, Math.max(0, value)));
}

function normalizeCropForEdge(crop: CropInsetsPercent, edge: CropEdge, nextValue: number): CropInsetsPercent {
  const nextCrop = {
    left: clampCropPercent(crop.left),
    top: clampCropPercent(crop.top),
    right: clampCropPercent(crop.right),
    bottom: clampCropPercent(crop.bottom),
  };

  nextCrop[edge] = clampCropPercent(nextValue);

  const horizontalTotal = nextCrop.left + nextCrop.right;
  if (horizontalTotal > 95) {
    if (edge === 'left') {
      nextCrop.left = roundCropPercent(Math.max(0, 95 - nextCrop.right));
    } else if (edge === 'right') {
      nextCrop.right = roundCropPercent(Math.max(0, 95 - nextCrop.left));
    }
  }

  const verticalTotal = nextCrop.top + nextCrop.bottom;
  if (verticalTotal > 95) {
    if (edge === 'top') {
      nextCrop.top = roundCropPercent(Math.max(0, 95 - nextCrop.bottom));
    } else if (edge === 'bottom') {
      nextCrop.bottom = roundCropPercent(Math.max(0, 95 - nextCrop.top));
    }
  }

  return nextCrop;
}

export function FormImageCropPreview({
  imageUrl,
  alt,
  crop,
  onCropChange,
  disabled = false,
  className = '',
}: FormImageCropPreviewProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const cropRef = useRef(crop);

  useEffect(() => {
    cropRef.current = crop;
  }, [crop]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState) return;

      const { edge, rect } = dragState;
      if (rect.width <= 0 || rect.height <= 0) return;

      let nextValue = 0;
      if (edge === 'left') {
        nextValue = ((event.clientX - rect.left) / rect.width) * 100;
      } else if (edge === 'right') {
        nextValue = ((rect.right - event.clientX) / rect.width) * 100;
      } else if (edge === 'top') {
        nextValue = ((event.clientY - rect.top) / rect.height) * 100;
      } else {
        nextValue = ((rect.bottom - event.clientY) / rect.height) * 100;
      }

      onCropChange(normalizeCropForEdge(cropRef.current, edge, nextValue));
    };

    const handleMouseUp = () => {
      dragStateRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onCropChange]);

  const startDrag = (edge: CropEdge, event: ReactMouseEvent<HTMLButtonElement>) => {
    if (disabled || !frameRef.current) return;
    event.preventDefault();
    dragStateRef.current = {
      edge,
      rect: frameRef.current.getBoundingClientRect(),
    };
  };

  return (
    <div className={`overflow-hidden rounded-2xl border border-[var(--line)] bg-slate-950/30 ${className}`.trim()}>
      <div className="border-b border-[var(--line)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
        Visual crop
      </div>
      <div className="flex h-72 items-center justify-center px-4 py-3">
        <div ref={frameRef} data-testid="crop-frame" className="relative inline-block max-h-full max-w-full">
          <img src={imageUrl} alt={alt} className="block max-h-[240px] max-w-full object-contain" draggable={false} />
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-0 right-0 top-0 bg-slate-950/55" style={{ height: `${crop.top}%` }} />
            <div className="absolute bottom-0 left-0 right-0 bg-slate-950/55" style={{ height: `${crop.bottom}%` }} />
            <div
              className="absolute bottom-0 left-0 top-0 bg-slate-950/55"
              style={{
                top: `${crop.top}%`,
                bottom: `${crop.bottom}%`,
                width: `${crop.left}%`,
              }}
            />
            <div
              className="absolute bottom-0 right-0 top-0 bg-slate-950/55"
              style={{
                top: `${crop.top}%`,
                bottom: `${crop.bottom}%`,
                width: `${crop.right}%`,
              }}
            />
            <div
              className="absolute border-2 border-[var(--accent)] shadow-[0_0_0_999px_rgba(15,23,42,0)]"
              style={{
                left: `${crop.left}%`,
                top: `${crop.top}%`,
                right: `${crop.right}%`,
                bottom: `${crop.bottom}%`,
              }}
            />
          </div>
          {(['left', 'top', 'right', 'bottom'] as const).map((edge) => {
            const positionStyle = edge === 'left'
              ? { left: `${crop.left}%`, top: '50%', transform: 'translate(-50%, -50%)', cursor: 'ew-resize' }
              : edge === 'right'
                ? { right: `${crop.right}%`, top: '50%', transform: 'translate(50%, -50%)', cursor: 'ew-resize' }
                : edge === 'top'
                  ? { top: `${crop.top}%`, left: '50%', transform: 'translate(-50%, -50%)', cursor: 'ns-resize' }
                  : { bottom: `${crop.bottom}%`, left: '50%', transform: 'translate(-50%, 50%)', cursor: 'ns-resize' };

            return (
              <button
                key={edge}
                type="button"
                data-testid={`crop-handle-${edge}`}
                aria-label={HANDLE_LABELS[edge]}
                className="absolute z-10 h-5 w-5 rounded-full border border-white/70 bg-[var(--accent)] shadow-[0_6px_18px_rgba(0,0,0,0.35)] disabled:cursor-not-allowed disabled:opacity-50"
                style={positionStyle}
                onMouseDown={(event) => startDrag(edge, event)}
                disabled={disabled}
              />
            );
          })}
        </div>
      </div>
      <div className="border-t border-[var(--line)] px-3 py-2 text-xs text-[var(--muted)]">
        Drag the crop handles to trim the original image before resizing and export.
      </div>
    </div>
  );
}