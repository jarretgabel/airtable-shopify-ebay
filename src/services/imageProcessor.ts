/**
 * Image processing utilities: resize, JPEG optimize, and watermark via Canvas API.
 * Runs entirely in the browser — no server required.
 */

export type WatermarkPosition = 'bottom-right' | 'bottom-left' | 'bottom-center' | 'top-right';

export interface ProcessingOptions {
  /** Maximum dimension (width or height) in pixels. Aspect ratio preserved. */
  maxPx: number;
  /** JPEG quality 0–100 */
  quality: number;
  /** Watermark text — empty string disables watermark */
  watermarkText: string;
  /** Where to place the watermark */
  watermarkPos: WatermarkPosition;
}

export interface ProcessedImage {
  blob: Blob;
  objectUrl: string;
  filename: string;
  originalBytes: number;
  processedBytes: number;
  width: number;
  height: number;
}

export const DEFAULT_OPTIONS: ProcessingOptions = {
  maxPx: 1200,
  quality: 85,
  watermarkText: 'Resolution AV',
  watermarkPos: 'bottom-right',
};

export function revokeProcessedImage(img: ProcessedImage) {
  URL.revokeObjectURL(img.objectUrl);
}

export async function processImage(
  file: File,
  opts: ProcessingOptions,
): Promise<ProcessedImage> {
  // 1. Load source image
  const src = await loadImage(file);

  // 2. Compute output dimensions
  const scale = Math.min(1, opts.maxPx / Math.max(src.naturalWidth, src.naturalHeight));
  const w = Math.round(src.naturalWidth * scale);
  const h = Math.round(src.naturalHeight * scale);

  // 3. Draw to canvas
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(src, 0, 0, w, h);

  // 4. Watermark overlay
  if (opts.watermarkText.trim()) {
    drawWatermark(ctx, w, h, opts.watermarkText, opts.watermarkPos);
  }

  // 5. Export as JPEG
  const blob = await canvasToBlob(canvas, 'image/jpeg', opts.quality / 100);
  const objectUrl = URL.createObjectURL(blob);
  const stem = file.name.replace(/\.[^.]+$/, '');
  const filename = `${stem}_processed.jpg`;

  return {
    blob,
    objectUrl,
    filename,
    originalBytes: file.size,
    processedBytes: blob.size,
    width: w,
    height: h,
  };
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
  // Scale font to ~2.2% of image width, but clamp between 13px and 42px
  const fontSize = Math.max(13, Math.min(42, Math.round(w * 0.022)));
  ctx.save();
  ctx.font = `700 ${fontSize}px Inter, -apple-system, BlinkMacSystemFont, sans-serif`;

  const textW = ctx.measureText(text).width;
  const padX = Math.round(fontSize * 0.65);
  const padY = Math.round(fontSize * 0.55);
  const bgH = fontSize + padY * 2;
  const bgW = textW + padX * 2;
  const margin = Math.max(12, Math.round(w * 0.018));

  let bx: number, by: number;
  switch (pos) {
    case 'bottom-right':  bx = w - bgW - margin;     by = h - bgH - margin; break;
    case 'bottom-left':   bx = margin;                by = h - bgH - margin; break;
    case 'bottom-center': bx = (w - bgW) / 2;         by = h - bgH - margin; break;
    case 'top-right':     bx = w - bgW - margin;     by = margin;            break;
  }

  // Semi-transparent dark pill
  ctx.fillStyle = 'rgba(10, 18, 28, 0.58)';
  roundedRect(ctx, bx, by, bgW, bgH, Math.round(fontSize * 0.38));
  ctx.fill();

  // White label text
  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
  ctx.fillText(text, bx + padX, by + padY + fontSize * 0.78);
  ctx.restore();
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
