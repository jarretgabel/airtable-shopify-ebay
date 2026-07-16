/**
 * Image processing utilities: resize, JPEG optimize, and watermark via Canvas API.
 * Runs entirely in the browser — no server required.
 */

import { buildFallbackImageFilename } from '@/services/imageNamingFormatter';

export type WatermarkPosition = 'bottom-right' | 'bottom-left' | 'bottom-center' | 'top-right';

export interface CropInsetsPercent {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface ProcessingOptions {
  /** Maximum dimension (width or height) in pixels. Aspect ratio preserved. */
  maxPx: number;
  /** JPEG quality 0–100 */
  quality: number;
  /** Whether the watermark should be drawn at all */
  watermarkEnabled: boolean;
  /** Watermark text — empty string disables watermark */
  watermarkText: string;
  /** Where to place the watermark */
  watermarkPos: WatermarkPosition;
  /** Crop insets as percentages of the original width/height */
  crop: CropInsetsPercent;
  /** Optional output filename override */
  outputFilename?: string;
}

export interface ProcessedImage {
  blob: Blob;
  objectUrl: string;
  filename: string;
  originalBytes: number;
  processedBytes: number;
  sourceWidth: number;
  sourceHeight: number;
  width: number;
  height: number;
}

export const DEFAULT_OPTIONS: ProcessingOptions = {
  maxPx: 1200,
  quality: 85,
  watermarkEnabled: true,
  watermarkText: '© Resolution Audio Video',
  watermarkPos: 'bottom-right',
  crop: {
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
};

export function revokeProcessedImage(img: ProcessedImage) {
  URL.revokeObjectURL(img.objectUrl);
}

export async function processImage(
  file: File,
  opts: ProcessingOptions,
): Promise<ProcessedImage> {
  const src = await loadImage(file);
  const crop = normalizeCropInsets(opts.crop);
  const cropLeft = Math.round(src.naturalWidth * (crop.left / 100));
  const cropTop = Math.round(src.naturalHeight * (crop.top / 100));
  const cropRight = Math.round(src.naturalWidth * (crop.right / 100));
  const cropBottom = Math.round(src.naturalHeight * (crop.bottom / 100));
  const croppedWidth = Math.max(1, src.naturalWidth - cropLeft - cropRight);
  const croppedHeight = Math.max(1, src.naturalHeight - cropTop - cropBottom);
  const scale = Math.min(1, opts.maxPx / Math.max(croppedWidth, croppedHeight));
  const w = Math.max(1, Math.round(croppedWidth * scale));
  const h = Math.max(1, Math.round(croppedHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(src, cropLeft, cropTop, croppedWidth, croppedHeight, 0, 0, w, h);

  if (opts.watermarkEnabled && opts.watermarkText.trim()) {
    drawWatermark(ctx, w, h, opts.watermarkText, opts.watermarkPos);
  }

  const blob = await canvasToBlob(canvas, 'image/jpeg', opts.quality / 100);
  const objectUrl = URL.createObjectURL(blob);
  const filename = buildOutputFilename(file.name, opts.outputFilename);

  return {
    blob,
    objectUrl,
    filename,
    originalBytes: file.size,
    processedBytes: blob.size,
    sourceWidth: src.naturalWidth,
    sourceHeight: src.naturalHeight,
    width: w,
    height: h,
  };
}

function normalizeCropInsets(crop: CropInsetsPercent | undefined): CropInsetsPercent {
  const normalized = {
    left: clampPercent(crop?.left ?? 0),
    top: clampPercent(crop?.top ?? 0),
    right: clampPercent(crop?.right ?? 0),
    bottom: clampPercent(crop?.bottom ?? 0),
  };

  const horizontalTotal = normalized.left + normalized.right;
  if (horizontalTotal >= 95) {
    const scale = 95 / horizontalTotal;
    normalized.left = roundPercent(normalized.left * scale);
    normalized.right = roundPercent(normalized.right * scale);
  }

  const verticalTotal = normalized.top + normalized.bottom;
  if (verticalTotal >= 95) {
    const scale = 95 / verticalTotal;
    normalized.top = roundPercent(normalized.top * scale);
    normalized.bottom = roundPercent(normalized.bottom * scale);
  }

  return normalized;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return roundPercent(Math.min(90, Math.max(0, value)));
}

function roundPercent(value: number): number {
  return Math.round(value * 10) / 10;
}

function buildOutputFilename(originalName: string, outputFilename?: string): string {
  const trimmedOverride = (outputFilename ?? '').trim();
  if (trimmedOverride) {
    return buildFallbackImageFilename(trimmedOverride);
  }

  return buildFallbackImageFilename(originalName);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to decode image')); };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => b ? resolve(b) : reject(new Error('Canvas toBlob returned null')),
      type,
      quality,
    );
  });
}

function drawWatermark(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  text: string,
  pos: WatermarkPosition,
) {
  // Scale font to ~2.1% of image width, but clamp between 13px and 40px
  const fontSize = Math.max(13, Math.min(40, Math.round(w * 0.021)));
  const watermarkLabel = buildWatermarkLabel(text);

  if (!watermarkLabel) {
    return;
  }

  ctx.save();
  ctx.font = `700 ${fontSize}px Helvetica, Arial, sans-serif`;
  ctx.textBaseline = 'alphabetic';

  const metrics = ctx.measureText(watermarkLabel);
  const textW = metrics.width;
  const textAscent = metrics.actualBoundingBoxAscent || Math.round(fontSize * 0.78);
  const textDescent = metrics.actualBoundingBoxDescent || Math.round(fontSize * 0.22);
  const marginX = Math.max(14, Math.round(w * 0.02));
  const marginY = Math.max(14, Math.round(h * 0.02));

  let x: number;
  let baselineY: number;
  switch (pos) {
    case 'bottom-right':
      x = w - textW - marginX;
      baselineY = h - marginY - textDescent;
      break;
    case 'bottom-left':
      x = marginX;
      baselineY = h - marginY - textDescent;
      break;
    case 'bottom-center':
      x = (w - textW) / 2;
      baselineY = h - marginY - textDescent;
      break;
    case 'top-right':
      x = w - textW - marginX;
      baselineY = marginY + textAscent;
      break;
  }

  // Subtle drop shadow for readability without a background panel
  ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
  ctx.shadowBlur = Math.max(2, Math.round(fontSize * 0.14));
  ctx.shadowOffsetX = Math.max(1, Math.round(fontSize * 0.07));
  ctx.shadowOffsetY = Math.max(1, Math.round(fontSize * 0.1));
  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
  ctx.fillText(watermarkLabel, x, baselineY);
  ctx.restore();
}

function buildWatermarkLabel(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';

  if (/^(©|\(c\))/i.test(trimmed)) {
    return trimmed.replace(/^\(c\)/i, '©');
  }

  return `© ${trimmed}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
