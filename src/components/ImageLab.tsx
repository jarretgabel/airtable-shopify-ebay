import { useState, useRef, useCallback, useEffect, DragEvent, ChangeEvent } from 'react';
import {
  identifyEquipment,
  fileToBase64,
  getAIProvider,
  type EquipmentIdentification,
} from '@/services/equipmentAI';
import {
  processImage,
  revokeProcessedImage,
  formatBytes,
  DEFAULT_OPTIONS,
  type ProcessedImage,
  type ProcessingOptions,
} from '@/services/imageProcessor';
import { spinnerClass } from '@/components/tabs/uiClasses';

// ─── Types ───────────────────────────────────────────────────────────────────

type ItemStatus = 'idle' | 'identifying' | 'identified' | 'processing' | 'done' | 'error';

interface ImageItem {
  id: string;
  file: File;
  previewUrl: string;
  status: ItemStatus;
  error?: string;
  aiResult?: EquipmentIdentification;
  processed?: ProcessedImage;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ImageLab() {
  const [items, setItems] = useState<ImageItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [opts, setOpts] = useState<ProcessingOptions>(DEFAULT_OPTIONS);
  const [copyId, setCopyId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<ImageItem[]>([]);
  itemsRef.current = items;

  const { provider: aiProvider } = getAIProvider();
  const aiEnabled = aiProvider !== 'none';

  // Revoke all object URLs on unmount
  useEffect(() => {
    return () => {
      itemsRef.current.forEach(item => {
        URL.revokeObjectURL(item.previewUrl);
        if (item.processed) revokeProcessedImage(item.processed);
      });
    };
  }, []);

  // ── Item state helpers ──────────────────────────────────────────────────
  const updateItem = useCallback((id: string, patch: Partial<ImageItem>) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
  }, []);

  // ── File ingestion ──────────────────────────────────────────────────────
  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!arr.length) return;
    const newItems: ImageItem[] = arr.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'idle',
    }));
    setItems(prev => [...prev, ...newItems]);
  }, []);

  // ── Drag & drop ─────────────────────────────────────────────────────────
  const onDragOver = (e: DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };
  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = '';
  };

  // ── AI identification ───────────────────────────────────────────────────
  const identifyItem = useCallback(async (id: string) => {
    const item = itemsRef.current.find(i => i.id === id);
    if (!item) return;
    updateItem(id, { status: 'identifying', error: undefined });
    try {
      const { base64, mimeType } = await fileToBase64(item.file);
      const aiResult = await identifyEquipment(base64, mimeType);
      updateItem(id, { status: 'identified', aiResult });
    } catch (err) {
      updateItem(id, { status: 'error', error: (err as Error).message });
    }
  }, [updateItem]);

  // ── Image processing ────────────────────────────────────────────────────
  const processItem = useCallback(async (id: string) => {
    const item = itemsRef.current.find(i => i.id === id);
    if (!item) return;
    if (item.processed) revokeProcessedImage(item.processed);
    updateItem(id, { status: 'processing', error: undefined, processed: undefined });
    try {
      const processed = await processImage(item.file, opts);
      updateItem(id, { status: 'done', processed });
    } catch (err) {
      updateItem(id, { status: 'error', error: (err as Error).message });
    }
  }, [updateItem, opts]);

  // ── Bulk actions ────────────────────────────────────────────────────────
  const identifyAll = () =>
    items.filter(i => i.status === 'idle').forEach(i => identifyItem(i.id));

  const processAll = () =>
    items.filter(i => i.status === 'idle' || i.status === 'identified').forEach(i => processItem(i.id));

  const removeItem = (id: string) => {
    const item = items.find(i => i.id === id);
    if (item) {
      URL.revokeObjectURL(item.previewUrl);
      if (item.processed) revokeProcessedImage(item.processed);
    }
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const clearAll = () => {
    items.forEach(item => {
      URL.revokeObjectURL(item.previewUrl);
      if (item.processed) revokeProcessedImage(item.processed);
    });
    setItems([]);
  };

  const copyDetails = async (id: string, ai: EquipmentIdentification) => {
    const specsText = ai.specifications && Object.keys(ai.specifications).length
      ? Object.entries(ai.specifications).map(([k, v]) => `  ${k}: ${v}`).join('\n')
      : '  N/A';
    const text = [
      `Type: ${ai.equipment_type}`,
      `Brand: ${ai.brand}`,
      `Model: ${ai.model}`,
      `Year: ${ai.year_range}`,
      `SKU: ${ai.suggested_sku}`,
      `Shopify Type: ${ai.shopify_product_type}`,
      `MSRP (new): ${ai.msrp_original || 'Unknown'}`,
      `Recent sold: ${ai.price_range_sold || 'Unknown'}`,
      ``,
      `Specifications:`,
      specsText,
      ``,
      `Description:`,
      ai.description,
      ``,
      `Condition Notes:`,
      ai.condition_notes,
      ``,
      `Tags: ${ai.suggested_tags.join(', ')}`,
    ].join('\n');
    await navigator.clipboard.writeText(text);
    setCopyId(id);
    setTimeout(() => setCopyId(null), 1800);
  };

  // ── Session stats ───────────────────────────────────────────────────────
  const sessionStats = (() => {
    const identified = items.filter(i => i.aiResult);
    const processed  = items.filter(i => i.processed);

    // Unique brands (exclude 'unknown')
    const brands = [...new Set(
      identified.map(i => i.aiResult!.brand).filter(b => b && b.toLowerCase() !== 'unknown')
    )];

    // Aggregate size savings
    const savedBytes = processed.reduce((sum, i) => {
      return sum + (i.file.size - (i.processed?.processedBytes ?? i.file.size));
    }, 0);

    // Parse price_range_sold strings like "$2,800–$3,800 USD" → extract midpoint numbers
    const parsePriceRange = (s: string): [number, number] | null => {
      if (!s || s.toLowerCase() === 'unknown') return null;
      const nums = [...s.matchAll(/\$?([\d,]+)/g)].map(m => parseInt(m[1].replace(/,/g, ''), 10)).filter(n => !isNaN(n));
      if (nums.length >= 2) return [nums[0], nums[1]];
      if (nums.length === 1) return [nums[0], nums[0]];
      return null;
    };

    let estLow = 0, estHigh = 0, hasPricing = false;
    for (const item of identified) {
      const range = parsePriceRange(item.aiResult!.price_range_sold ?? '');
      if (range) { estLow += range[0]; estHigh += range[1]; hasPricing = true; }
    }

    const fmtUSD = (n: number) =>
      n >= 1000 ? `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `$${n}`;

    return {
      total: items.length,
      identified: identified.length,
      processed: processed.length,
      brands,
      savedBytes,
      estLow, estHigh, hasPricing,
      fmtUSD,
    };
  })();

  // ── Render ───────────────────────────────────────────────────────────────
  const hasBusy = items.some(i => i.status === 'identifying' || i.status === 'processing');

  return (
    <div className="flex flex-col gap-4 pt-1">

      {/* API provider status banner */}
      {!aiEnabled ? (
        <div className="rounded-[10px] border border-amber-300 bg-amber-50 px-4 py-3 text-[0.84rem] leading-[1.6] text-amber-900 [&_a]:text-amber-800 [&_code]:rounded [&_code]:bg-black/5 [&_code]:px-[0.35em] [&_code]:py-[0.1em] [&_code]:text-[0.82em]">
          <strong>No AI key configured.</strong>{' '}
          To enable equipment identification, add one of the following to <code>.env.local</code> and restart:
          <br />
          • <code>VITE_GITHUB_TOKEN=github_pat_…</code> — free with your Copilot subscription
          (<a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer">generate a PAT</a>, no special scopes needed)
          <br />
          • <code>VITE_OPENAI_API_KEY=sk-…</code> — OpenAI paid API
          <br />
          Image optimization and watermarking still work without a key.
        </div>
      ) : (
        <div className="rounded-[10px] border border-emerald-200 bg-emerald-50 px-4 py-[0.55rem] text-[0.82rem] text-emerald-800">
          AI provider: <strong>{aiProvider === 'github' ? 'GitHub Models (Copilot)' : 'OpenAI'}</strong>
          {' · '}
          <span>GPT-4o Vision</span>
        </div>
      )}

      {/* Options panel */}
      <section className="rounded-[14px] border border-[var(--line)] bg-[var(--panel)] px-5 py-4 shadow-[0_1px_3px_rgba(17,32,49,0.06)]">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.72rem] font-bold uppercase tracking-[0.07em] text-[var(--muted)]">Max size</span>
            <select
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-[0.88rem] text-[var(--ink)] outline-none transition-colors focus:border-[var(--accent)]"
              value={opts.maxPx}
              onChange={e => setOpts(o => ({ ...o, maxPx: Number(e.target.value) }))}
            >
              <option value={800}>800 px</option>
              <option value={1200}>1200 px</option>
              <option value={1600}>1600 px</option>
              <option value={2400}>2400 px</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[0.72rem] font-bold uppercase tracking-[0.07em] text-[var(--muted)]">JPEG quality</span>
            <select
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-[0.88rem] text-[var(--ink)] outline-none transition-colors focus:border-[var(--accent)]"
              value={opts.quality}
              onChange={e => setOpts(o => ({ ...o, quality: Number(e.target.value) }))}
            >
              <option value={70}>70%</option>
              <option value={80}>80%</option>
              <option value={85}>85%</option>
              <option value={90}>90%</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[0.72rem] font-bold uppercase tracking-[0.07em] text-[var(--muted)]">Watermark text</span>
            <input
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-[0.88rem] text-[var(--ink)] outline-none transition-colors focus:border-[var(--accent)]"
              type="text"
              value={opts.watermarkText}
              placeholder="Resolution AV"
              onChange={e => setOpts(o => ({ ...o, watermarkText: e.target.value }))}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[0.72rem] font-bold uppercase tracking-[0.07em] text-[var(--muted)]">Watermark position</span>
            <div className="grid grid-cols-4 gap-1">
              {(['top-right', 'bottom-right', 'bottom-left', 'bottom-center'] as const).map(p => (
                <button
                  key={p}
                  className={[
                    'cursor-pointer rounded-md border border-[var(--line)] bg-[var(--bg)] py-1 text-base leading-none text-[var(--muted)] transition-[background,color,border-color]',
                    'hover:bg-slate-200 hover:text-[var(--ink)]',
                    opts.watermarkPos === p ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => setOpts(o => ({ ...o, watermarkPos: p }))}
                  title={p.replace(/-/g, ' ')}
                >
                  {p === 'top-right' && '↗'}
                  {p === 'bottom-right' && '↘'}
                  {p === 'bottom-left' && '↙'}
                  {p === 'bottom-center' && '↓'}
                </button>
              ))}
            </div>
          </label>
        </div>
      </section>

      {/* Session stats bar — shown once at least one item is identified or processed */}
      {items.length > 0 && (sessionStats.identified > 0 || sessionStats.processed > 0) && (
        <div className="flex flex-wrap items-center gap-0 rounded-[14px] border border-[var(--line)] bg-[var(--panel)] px-5 py-3 shadow-[0_1px_3px_rgba(17,32,49,0.06)] max-[900px]:items-stretch max-[900px]:gap-3">
          <div className="flex flex-col items-center gap-0.5 px-5 first:pl-0 max-[900px]:items-start max-[900px]:px-0">
            <span className="whitespace-nowrap text-[1.35rem] font-extrabold leading-none text-[var(--ink)]">{sessionStats.total}</span>
            <span className="whitespace-nowrap text-[0.65rem] font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">Images</span>
          </div>
          <div className="h-[2.2rem] w-px shrink-0 bg-[var(--line)] max-[900px]:hidden" />
          <div className="flex flex-col items-center gap-0.5 px-5 max-[900px]:items-start max-[900px]:px-0">
            <span className="whitespace-nowrap text-[1.35rem] font-extrabold leading-none text-[var(--ink)]">{sessionStats.identified}</span>
            <span className="whitespace-nowrap text-[0.65rem] font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">Identified</span>
          </div>
          <div className="h-[2.2rem] w-px shrink-0 bg-[var(--line)] max-[900px]:hidden" />
          <div className="flex flex-col items-center gap-0.5 px-5 max-[900px]:items-start max-[900px]:px-0">
            <span className="whitespace-nowrap text-[1.35rem] font-extrabold leading-none text-[var(--ink)]">{sessionStats.processed}</span>
            <span className="whitespace-nowrap text-[0.65rem] font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">Processed</span>
          </div>
          {sessionStats.savedBytes > 0 && (
            <>
              <div className="h-[2.2rem] w-px shrink-0 bg-[var(--line)] max-[900px]:hidden" />
              <div className="flex flex-col items-center gap-0.5 px-5 max-[900px]:items-start max-[900px]:px-0">
                <span className="whitespace-nowrap text-[1.35rem] font-extrabold leading-none text-green-600">{formatBytes(sessionStats.savedBytes)}</span>
                <span className="whitespace-nowrap text-[0.65rem] font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">Size saved</span>
              </div>
            </>
          )}
          {sessionStats.hasPricing && (
            <>
              <div className="h-[2.2rem] w-px shrink-0 bg-[var(--line)] max-[900px]:hidden" />
              <div className="flex flex-col items-center gap-0.5 px-5 max-[900px]:items-start max-[900px]:px-0">
                <span className="whitespace-nowrap text-[1.35rem] font-extrabold leading-none text-[var(--accent)]">
                  {sessionStats.fmtUSD(sessionStats.estLow)}
                  {sessionStats.estHigh !== sessionStats.estLow && `–${sessionStats.fmtUSD(sessionStats.estHigh)}`}
                </span>
                <span className="whitespace-nowrap text-[0.65rem] font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">Est. portfolio value</span>
              </div>
            </>
          )}
          {sessionStats.brands.length > 0 && (
            <>
              <div className="h-[2.2rem] w-px shrink-0 bg-[var(--line)] max-[900px]:hidden" />
              <div className="flex flex-col items-start gap-0.5 px-5 max-[900px]:px-0">
                <div className="flex max-w-[260px] flex-wrap gap-1.5 max-[900px]:max-w-none">
                  {sessionStats.brands.map(b => (
                    <span key={b} className="whitespace-nowrap rounded-full bg-blue-50 px-[0.6em] py-[0.15em] text-[0.7rem] font-bold text-blue-700">{b}</span>
                  ))}
                </div>
                <span className="whitespace-nowrap text-[0.65rem] font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">Brands</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Drop zone */}
      <div
        className={[
          'cursor-pointer select-none rounded-[14px] border-2 border-dashed border-[var(--line)] bg-[var(--panel)] px-8 py-8 text-center text-[var(--muted)] transition-[border-color,background,color]',
          'flex min-h-[180px] flex-col items-center justify-center gap-2.5',
          dragging ? 'border-[var(--accent)] bg-blue-50 text-[var(--accent)]' : '',
          items.length > 0 ? 'min-h-[52px] flex-row px-6 py-3' : '',
        ].filter(Boolean).join(' ')}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
        aria-label="Upload images"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={onFileChange}
        />
        {items.length === 0 ? (
          <>
            <div className={dragging ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <p className="m-0 text-base font-semibold text-[var(--ink)]">Drop equipment photos here</p>
            <p className="m-0 text-[0.82rem]">or click to browse · JPEG, PNG, HEIC, WebP accepted</p>
          </>
        ) : (
          <span className="text-[0.87rem] font-semibold">+ Add more images</span>
        )}
      </div>

      {/* Bulk actions */}
      {items.length > 0 && (
        <div className="flex items-center justify-between gap-3 py-2 max-[600px]:flex-col max-[600px]:items-stretch">
          <div className="flex items-center gap-2.5">
            <span className="text-[0.84rem] font-semibold text-[var(--muted)]">
              {items.length} {items.length === 1 ? 'image' : 'images'}
            </span>
            {hasBusy && <span className="h-2 w-2 rounded-full bg-[var(--accent)] animate-pulse" />}
          </div>
          <div className="flex items-center gap-2 max-[600px]:justify-stretch [&>button]:max-[600px]:flex-1">
            {aiEnabled && (
              <button
                className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-4 py-2 text-[0.84rem] font-semibold text-[var(--ink)] transition hover:border-[var(--muted)] hover:bg-[var(--bg)] disabled:cursor-not-allowed disabled:opacity-45"
                onClick={identifyAll}
                disabled={hasBusy || !items.some(i => i.status === 'idle')}
              >
                Identify All
              </button>
            )}
            <button
              className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-4 py-2 text-[0.84rem] font-semibold text-[var(--ink)] transition hover:border-[var(--muted)] hover:bg-[var(--bg)] disabled:cursor-not-allowed disabled:opacity-45"
              onClick={processAll}
              disabled={hasBusy || !items.some(i => i.status === 'idle' || i.status === 'identified')}
            >
              Process All
            </button>
            <button className="rounded-lg border border-red-300 bg-[var(--panel)] px-4 py-2 text-[0.84rem] font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-45" onClick={clearAll}>
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* Image cards grid */}
      {items.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4 max-[600px]:grid-cols-1">
          {items.map(item => (
            <ImageCard
              key={item.id}
              item={item}
              opts={opts}
              apiKeyPresent={aiEnabled}
              isCopied={copyId === item.id}
              onIdentify={() => identifyItem(item.id)}
              onProcess={() => processItem(item.id)}
              onRemove={() => removeItem(item.id)}
              onCopy={() => item.aiResult && copyDetails(item.id, item.aiResult)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Image Card Sub-component ────────────────────────────────────────────────

interface CardProps {
  item: ImageItem;
  opts: ProcessingOptions;
  apiKeyPresent: boolean;
  isCopied: boolean;
  onIdentify: () => void;
  onProcess: () => void;
  onRemove: () => void;
  onCopy: () => void;
}

function ImageCard({ item, apiKeyPresent, isCopied, onIdentify, onProcess, onRemove, onCopy }: CardProps) {
  const { status, aiResult, processed, error } = item;
  const busy = status === 'identifying' || status === 'processing';

  return (
    <article className={[
      'flex flex-col overflow-hidden rounded-[14px] border bg-[var(--panel)] shadow-[0_1px_4px_rgba(17,32,49,0.07)] transition-shadow hover:shadow-[0_3px_12px_rgba(17,32,49,0.11)]',
      status === 'done' ? 'border-green-200' : '',
      status === 'error' ? 'border-red-300' : '',
      status === 'identifying' ? 'border-blue-200' : '',
      status !== 'done' && status !== 'error' && status !== 'identifying' ? 'border-[var(--line)]' : '',
    ].filter(Boolean).join(' ')}>

      {/* Preview row */}
      <div className="flex gap-0 max-[600px]:flex-col">
        {/* Original */}
        <div className="relative min-h-[160px] max-h-[220px] flex-1 overflow-hidden bg-[#0a121c] max-[600px]:max-h-[260px]">
          <img src={item.previewUrl} alt={item.file.name} className="block h-full w-full object-cover" />
          <span className="absolute left-1.5 top-1.5 rounded-full bg-[rgba(10,18,28,0.62)] px-[0.55em] py-[0.2em] text-[0.65rem] font-bold uppercase tracking-[0.07em] text-white">Original</span>
        </div>
        {/* Processed (if done) */}
        {processed && (
          <div className="relative min-h-[160px] max-h-[220px] flex-1 overflow-hidden bg-[#0a121c] max-[600px]:max-h-[260px]">
            <img src={processed.objectUrl} alt="Processed" className="block h-full w-full object-cover" />
            <span className="absolute left-1.5 top-1.5 rounded-full bg-[rgba(21,128,61,0.78)] px-[0.55em] py-[0.2em] text-[0.65rem] font-bold uppercase tracking-[0.07em] text-white">Processed</span>
          </div>
        )}
      </div>

      {/* File info */}
      <div className="flex flex-1 flex-col gap-2 px-4 pb-3.5 pt-3.5">
        <div className="flex items-center justify-between gap-2">
          <p className="m-0 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[0.82rem] font-semibold text-[var(--ink)]" title={item.file.name}>{item.file.name}</p>
          <StatusBadge status={status} />
        </div>

        <p className="m-0 text-[0.75rem] text-[var(--muted)]">
          {formatBytes(item.file.size)}
          {processed && (
            <>
              {' → '}
              <span className="font-semibold text-[var(--ink)]">{formatBytes(processed.processedBytes)}</span>
              {' '}
              <span className="font-semibold text-green-700">
                ({Math.round((1 - processed.processedBytes / item.file.size) * 100)}% smaller)
              </span>
              {' · '}{processed.width}×{processed.height}
            </>
          )}
        </p>

        {/* AI Results */}
        {aiResult && (
          <div className="flex flex-col gap-2 rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3.5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-[var(--line)] px-2 py-[0.15em] text-[0.7rem] font-bold uppercase tracking-[0.07em] text-[var(--muted)]">{aiResult.equipment_type}</span>
              <span className="text-[0.92rem] font-bold text-[var(--ink)]">{aiResult.brand} {aiResult.model}</span>
              {aiResult.year_range && aiResult.year_range !== 'Unknown' && (
                <span className="text-[0.75rem] text-[var(--muted)]">{aiResult.year_range}</span>
              )}
            </div>

            {/* Pricing row */}
            {(aiResult.msrp_original || aiResult.price_range_sold) && (
              <div className="flex flex-wrap gap-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                {aiResult.msrp_original && aiResult.msrp_original !== 'Unknown' && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[0.65rem] font-bold uppercase tracking-[0.04em] text-green-700">MSRP (new)</span>
                    <span className="text-[0.82rem] font-semibold text-[var(--ink)]">{aiResult.msrp_original}</span>
                  </div>
                )}
                {aiResult.price_range_sold && aiResult.price_range_sold !== 'Unknown' && (
                  <div className="flex flex-col gap-0.5 border-l-2 border-green-300 pl-3">
                    <span className="text-[0.65rem] font-bold uppercase tracking-[0.04em] text-green-700">Typical used sold</span>
                    <span className="text-[0.82rem] font-semibold text-green-600">{aiResult.price_range_sold}</span>
                  </div>
                )}
              </div>
            )}

            {aiResult.description && (
              <p className="m-0 text-[0.8rem] leading-[1.55] text-[var(--ink)]">{aiResult.description}</p>
            )}

            {aiResult.condition_notes && (
              <p className="m-0 text-[0.78rem] leading-[1.5] text-[var(--muted)]">
                <span className="font-bold text-[var(--ink)]">Condition:</span> {aiResult.condition_notes}
              </p>
            )}

            {/* Specifications table */}
            {aiResult.specifications && Object.keys(aiResult.specifications).length > 0 && (
              <div className="overflow-hidden rounded-lg border border-[var(--line)]">
                <p className="m-0 border-b border-[var(--line)] bg-[var(--panel)] px-2.5 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.05em] text-[var(--muted)]">Specifications</p>
                <table className="w-full border-collapse text-[0.76rem]">
                  <tbody>
                    {Object.entries(aiResult.specifications).map(([key, val]) => (
                      <tr key={key} className="even:bg-slate-50">
                        <td className="w-[42%] whitespace-nowrap border-r border-[var(--line)] px-2.5 py-1 text-[var(--ink)] font-semibold">{key}</td>
                        <td className="px-2.5 py-1 text-[var(--muted)]">{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {aiResult.suggested_sku && (
                <span className="rounded-[5px] bg-slate-800 px-2 py-[0.15em] text-[0.72rem] font-bold text-slate-200">{aiResult.suggested_sku}</span>
              )}
              {aiResult.shopify_product_type && (
                <span className="rounded-[5px] bg-blue-50 px-2 py-[0.15em] text-[0.72rem] font-semibold text-blue-700">{aiResult.shopify_product_type}</span>
              )}
            </div>

            {aiResult.suggested_tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {aiResult.suggested_tags.map(tag => (
                  <span key={tag} className="rounded-full border border-[var(--line)] bg-[var(--panel)] px-[0.6em] py-[0.15em] text-[0.68rem] font-semibold text-[var(--muted)]">{tag}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[0.8rem] leading-[1.5] text-red-700">
            <strong>Error</strong> — {error}
          </div>
        )}

        {/* Busy indicator */}
        {busy && (
          <div className="flex items-center gap-2.5 text-[0.82rem] text-[var(--muted)]">
            <div className={spinnerClass} />
            <span>{status === 'identifying' ? 'Analyzing with AI…' : 'Processing image…'}</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {apiKeyPresent && (
            <button
              className="rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-3 py-1.5 text-[0.78rem] font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
              onClick={onIdentify}
              disabled={busy}
            >
              {status === 'identified' || status === 'done' ? 'Re-identify' : 'Identify'}
            </button>
          )}

          <button
            className="rounded-lg border border-transparent bg-[linear-gradient(90deg,var(--accent),#2b8cff)] px-3 py-1.5 text-[0.78rem] font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
            onClick={onProcess}
            disabled={busy}
          >
            {status === 'done' ? 'Re-process' : 'Process'}
          </button>

          {processed && (
            <>
              <a
                className="inline-flex items-center rounded-lg border border-transparent bg-green-700 px-3 py-1.5 text-[0.78rem] font-semibold text-white no-underline transition hover:brightness-110"
                href={processed.objectUrl}
                download={processed.filename}
              >
                Download
              </a>
              {aiResult && (
                <button className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[0.78rem] font-semibold text-[var(--ink)] transition hover:border-[var(--muted)] hover:bg-[var(--bg)]" onClick={onCopy}>
                  {isCopied ? 'Copied ✓' : 'Copy details'}
                </button>
              )}
            </>
          )}

          <button
            className="ml-auto rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 py-1.5 text-[0.78rem] font-semibold text-[var(--muted)] transition hover:border-red-300 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-45"
            onClick={onRemove}
            disabled={busy}
            aria-label="Remove"
          >
            ✕
          </button>
        </div>
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: ItemStatus }) {
  const labels: Record<ItemStatus, string> = {
    idle: 'Ready',
    identifying: 'Identifying…',
    identified: 'Identified',
    processing: 'Processing…',
    done: 'Done',
    error: 'Error',
  };
  const statusClass = {
    idle: 'bg-slate-100 text-slate-500',
    identifying: 'bg-blue-100 text-blue-700',
    identified: 'bg-teal-100 text-teal-700',
    processing: 'bg-amber-100 text-amber-700',
    done: 'bg-green-100 text-green-700',
    error: 'bg-red-100 text-red-700',
  } as const;

  return <span className={`inline-block shrink-0 whitespace-nowrap rounded-full px-[0.65em] py-[0.18em] text-[0.68rem] font-bold uppercase tracking-[0.06em] ${statusClass[status]}`}>{labels[status]}</span>;
}
