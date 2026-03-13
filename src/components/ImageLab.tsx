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
    <div className="ilab">

      {/* API provider status banner */}
      {!aiEnabled ? (
        <div className="ilab-api-warn">
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
        <div className="ilab-api-ok">
          AI provider: <strong>{aiProvider === 'github' ? 'GitHub Models (Copilot)' : 'OpenAI'}</strong>
          {' · '}
          <span>GPT-4o Vision</span>
        </div>
      )}

      {/* Options panel */}
      <section className="ilab-options">
        <div className="ilab-options-grid">
          <label className="ilab-opt-group">
            <span className="ilab-opt-label">Max size</span>
            <select
              className="ilab-select"
              value={opts.maxPx}
              onChange={e => setOpts(o => ({ ...o, maxPx: Number(e.target.value) }))}
            >
              <option value={800}>800 px</option>
              <option value={1200}>1200 px</option>
              <option value={1600}>1600 px</option>
              <option value={2400}>2400 px</option>
            </select>
          </label>

          <label className="ilab-opt-group">
            <span className="ilab-opt-label">JPEG quality</span>
            <select
              className="ilab-select"
              value={opts.quality}
              onChange={e => setOpts(o => ({ ...o, quality: Number(e.target.value) }))}
            >
              <option value={70}>70%</option>
              <option value={80}>80%</option>
              <option value={85}>85%</option>
              <option value={90}>90%</option>
            </select>
          </label>

          <label className="ilab-opt-group">
            <span className="ilab-opt-label">Watermark text</span>
            <input
              className="ilab-input"
              type="text"
              value={opts.watermarkText}
              placeholder="Resolution AV"
              onChange={e => setOpts(o => ({ ...o, watermarkText: e.target.value }))}
            />
          </label>

          <label className="ilab-opt-group">
            <span className="ilab-opt-label">Watermark position</span>
            <div className="ilab-pos-grid">
              {(['top-right', 'bottom-right', 'bottom-left', 'bottom-center'] as const).map(p => (
                <button
                  key={p}
                  className={`ilab-pos-btn${opts.watermarkPos === p ? ' ilab-pos-active' : ''}`}
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
        <div className="ilab-stats-bar">
          <div className="ilab-stat">
            <span className="ilab-stat-val">{sessionStats.total}</span>
            <span className="ilab-stat-label">Images</span>
          </div>
          <div className="ilab-stat-div" />
          <div className="ilab-stat">
            <span className="ilab-stat-val">{sessionStats.identified}</span>
            <span className="ilab-stat-label">Identified</span>
          </div>
          <div className="ilab-stat-div" />
          <div className="ilab-stat">
            <span className="ilab-stat-val">{sessionStats.processed}</span>
            <span className="ilab-stat-label">Processed</span>
          </div>
          {sessionStats.savedBytes > 0 && (
            <>
              <div className="ilab-stat-div" />
              <div className="ilab-stat">
                <span className="ilab-stat-val ilab-stat-green">{formatBytes(sessionStats.savedBytes)}</span>
                <span className="ilab-stat-label">Size saved</span>
              </div>
            </>
          )}
          {sessionStats.hasPricing && (
            <>
              <div className="ilab-stat-div" />
              <div className="ilab-stat">
                <span className="ilab-stat-val ilab-stat-accent">
                  {sessionStats.fmtUSD(sessionStats.estLow)}
                  {sessionStats.estHigh !== sessionStats.estLow && `–${sessionStats.fmtUSD(sessionStats.estHigh)}`}
                </span>
                <span className="ilab-stat-label">Est. portfolio value</span>
              </div>
            </>
          )}
          {sessionStats.brands.length > 0 && (
            <>
              <div className="ilab-stat-div" />
              <div className="ilab-stat ilab-stat-brands">
                <div className="ilab-stat-brand-chips">
                  {sessionStats.brands.map(b => (
                    <span key={b} className="ilab-stat-brand-chip">{b}</span>
                  ))}
                </div>
                <span className="ilab-stat-label">Brands</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Drop zone */}
      <div
        className={`ilab-drop${dragging ? ' ilab-drop-active' : ''}${items.length > 0 ? ' ilab-drop-compact' : ''}`}
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
            <div className="ilab-drop-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <p className="ilab-drop-title">Drop equipment photos here</p>
            <p className="ilab-drop-sub">or click to browse · JPEG, PNG, HEIC, WebP accepted</p>
          </>
        ) : (
          <span className="ilab-drop-compact-text">+ Add more images</span>
        )}
      </div>

      {/* Bulk actions */}
      {items.length > 0 && (
        <div className="ilab-bulk">
          <div className="ilab-bulk-left">
            <span className="ilab-bulk-count">
              {items.length} {items.length === 1 ? 'image' : 'images'}
            </span>
            {hasBusy && <span className="ilab-busy-dot" />}
          </div>
          <div className="ilab-bulk-right">
            {aiEnabled && (
              <button
                className="ilab-btn ilab-btn-ghost"
                onClick={identifyAll}
                disabled={hasBusy || !items.some(i => i.status === 'idle')}
              >
                Identify All
              </button>
            )}
            <button
              className="ilab-btn ilab-btn-ghost"
              onClick={processAll}
              disabled={hasBusy || !items.some(i => i.status === 'idle' || i.status === 'identified')}
            >
              Process All
            </button>
            <button className="ilab-btn ilab-btn-danger" onClick={clearAll}>
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* Image cards grid */}
      {items.length > 0 && (
        <div className="ilab-grid">
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
    <article className={`ilab-card ilab-card-${status}`}>

      {/* Preview row */}
      <div className="ilab-card-previews">
        {/* Original */}
        <div className="ilab-preview-wrap">
          <img src={item.previewUrl} alt={item.file.name} className="ilab-preview-img" />
          <span className="ilab-preview-badge">Original</span>
        </div>
        {/* Processed (if done) */}
        {processed && (
          <div className="ilab-preview-wrap">
            <img src={processed.objectUrl} alt="Processed" className="ilab-preview-img" />
            <span className="ilab-preview-badge ilab-preview-badge-green">Processed</span>
          </div>
        )}
      </div>

      {/* File info */}
      <div className="ilab-card-body">
        <div className="ilab-card-header">
          <p className="ilab-card-filename" title={item.file.name}>{item.file.name}</p>
          <StatusBadge status={status} />
        </div>

        <p className="ilab-card-meta">
          {formatBytes(item.file.size)}
          {processed && (
            <>
              {' → '}
              <span className="ilab-size-after">{formatBytes(processed.processedBytes)}</span>
              {' '}
              <span className="ilab-size-saved">
                ({Math.round((1 - processed.processedBytes / item.file.size) * 100)}% smaller)
              </span>
              {' · '}{processed.width}×{processed.height}
            </>
          )}
        </p>

        {/* AI Results */}
        {aiResult && (
          <div className="ilab-ai-results">
            <div className="ilab-ai-primary">
              <span className="ilab-ai-type">{aiResult.equipment_type}</span>
              <span className="ilab-ai-brand-model">{aiResult.brand} {aiResult.model}</span>
              {aiResult.year_range && aiResult.year_range !== 'Unknown' && (
                <span className="ilab-ai-year">{aiResult.year_range}</span>
              )}
            </div>

            {/* Pricing row */}
            {(aiResult.msrp_original || aiResult.price_range_sold) && (
              <div className="ilab-pricing-row">
                {aiResult.msrp_original && aiResult.msrp_original !== 'Unknown' && (
                  <div className="ilab-price-block">
                    <span className="ilab-price-label">MSRP (new)</span>
                    <span className="ilab-price-val">{aiResult.msrp_original}</span>
                  </div>
                )}
                {aiResult.price_range_sold && aiResult.price_range_sold !== 'Unknown' && (
                  <div className="ilab-price-block ilab-price-block-sold">
                    <span className="ilab-price-label">Typical used sold</span>
                    <span className="ilab-price-val ilab-price-sold">{aiResult.price_range_sold}</span>
                  </div>
                )}
              </div>
            )}

            {aiResult.description && (
              <p className="ilab-ai-desc">{aiResult.description}</p>
            )}

            {aiResult.condition_notes && (
              <p className="ilab-ai-condition">
                <span className="ilab-ai-condition-label">Condition:</span> {aiResult.condition_notes}
              </p>
            )}

            {/* Specifications table */}
            {aiResult.specifications && Object.keys(aiResult.specifications).length > 0 && (
              <div className="ilab-specs">
                <p className="ilab-specs-title">Specifications</p>
                <table className="ilab-specs-table">
                  <tbody>
                    {Object.entries(aiResult.specifications).map(([key, val]) => (
                      <tr key={key} className="ilab-specs-row">
                        <td className="ilab-specs-key">{key}</td>
                        <td className="ilab-specs-val">{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="ilab-ai-meta-row">
              {aiResult.suggested_sku && (
                <span className="ilab-ai-sku">{aiResult.suggested_sku}</span>
              )}
              {aiResult.shopify_product_type && (
                <span className="ilab-ai-ptype">{aiResult.shopify_product_type}</span>
              )}
            </div>

            {aiResult.suggested_tags?.length > 0 && (
              <div className="ilab-tags">
                {aiResult.suggested_tags.map(tag => (
                  <span key={tag} className="ilab-tag">{tag}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="ilab-error">
            <strong>Error</strong> — {error}
          </div>
        )}

        {/* Busy indicator */}
        {busy && (
          <div className="ilab-card-busy">
            <div className="loader" />
            <span>{status === 'identifying' ? 'Analyzing with AI…' : 'Processing image…'}</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="ilab-card-actions">
          {apiKeyPresent && (
            <button
              className="ilab-btn ilab-btn-sm ilab-btn-accent"
              onClick={onIdentify}
              disabled={busy}
            >
              {status === 'identified' || status === 'done' ? 'Re-identify' : 'Identify'}
            </button>
          )}

          <button
            className="ilab-btn ilab-btn-sm ilab-btn-primary"
            onClick={onProcess}
            disabled={busy}
          >
            {status === 'done' ? 'Re-process' : 'Process'}
          </button>

          {processed && (
            <>
              <a
                className="ilab-btn ilab-btn-sm ilab-btn-green"
                href={processed.objectUrl}
                download={processed.filename}
              >
                Download
              </a>
              {aiResult && (
                <button className="ilab-btn ilab-btn-sm ilab-btn-ghost" onClick={onCopy}>
                  {isCopied ? 'Copied ✓' : 'Copy details'}
                </button>
              )}
            </>
          )}

          <button
            className="ilab-btn ilab-btn-sm ilab-btn-ghost ilab-btn-remove"
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
  return <span className={`ilab-status ilab-status-${status}`}>{labels[status]}</span>;
}
