import { ChangeEvent, DragEvent, RefObject } from 'react';
import { formatBytes, ProcessingOptions } from '@/services/imageProcessor';
import { ImageLabSessionStats } from './types';

interface OptionsPanelProps {
  opts: ProcessingOptions;
  setOpts: (updater: (prev: ProcessingOptions) => ProcessingOptions) => void;
}

export function ImageLabOptionsPanel({ opts, setOpts }: OptionsPanelProps) {
  return (
    <section className="rounded-[14px] border border-[var(--line)] bg-[var(--panel)] px-5 py-4 shadow-[0_1px_3px_rgba(17,32,49,0.06)]">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.72rem] font-bold uppercase tracking-[0.07em] text-[var(--muted)]">Max size</span>
          <select className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-[0.88rem] text-[var(--ink)] outline-none transition-colors focus:border-[var(--accent)]" value={opts.maxPx} onChange={(e) => setOpts((o) => ({ ...o, maxPx: Number(e.target.value) }))}>
            <option value={800}>800 px</option><option value={1200}>1200 px</option><option value={1600}>1600 px</option><option value={2400}>2400 px</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.72rem] font-bold uppercase tracking-[0.07em] text-[var(--muted)]">JPEG quality</span>
          <select className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-[0.88rem] text-[var(--ink)] outline-none transition-colors focus:border-[var(--accent)]" value={opts.quality} onChange={(e) => setOpts((o) => ({ ...o, quality: Number(e.target.value) }))}>
            <option value={70}>70%</option><option value={80}>80%</option><option value={85}>85%</option><option value={90}>90%</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.72rem] font-bold uppercase tracking-[0.07em] text-[var(--muted)]">Watermark text</span>
          <input className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-[0.88rem] text-[var(--ink)] outline-none transition-colors focus:border-[var(--accent)]" type="text" value={opts.watermarkText} placeholder="Resolution AV" onChange={(e) => setOpts((o) => ({ ...o, watermarkText: e.target.value }))} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.72rem] font-bold uppercase tracking-[0.07em] text-[var(--muted)]">Watermark position</span>
          <div className="grid grid-cols-4 gap-1">
            {(['top-right', 'bottom-right', 'bottom-left', 'bottom-center'] as const).map((p) => (
              <button key={p} className={['cursor-pointer rounded-md border border-[var(--line)] bg-[var(--bg)] py-1 text-base leading-none text-[var(--muted)] transition-[background,color,border-color]', 'hover:bg-slate-200 hover:text-[var(--ink)]', opts.watermarkPos === p ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : ''].filter(Boolean).join(' ')} onClick={() => setOpts((o) => ({ ...o, watermarkPos: p }))} title={p.replace(/-/g, ' ')}>
                {p === 'top-right' && '↗'}{p === 'bottom-right' && '↘'}{p === 'bottom-left' && '↙'}{p === 'bottom-center' && '↓'}
              </button>
            ))}
          </div>
        </label>
      </div>
    </section>
  );
}

export function ImageLabSessionStatsBar({ itemsLength, sessionStats }: { itemsLength: number; sessionStats: ImageLabSessionStats }) {
  if (!(itemsLength > 0 && (sessionStats.identified > 0 || sessionStats.processed > 0))) return null;

  return (
    <div className="flex flex-wrap items-center gap-0 rounded-[14px] border border-[var(--line)] bg-[var(--panel)] px-5 py-3 shadow-[0_1px_3px_rgba(17,32,49,0.06)] max-[900px]:items-stretch max-[900px]:gap-3">
      <div className="flex flex-col items-center gap-0.5 px-5 first:pl-0 max-[900px]:items-start max-[900px]:px-0"><span className="whitespace-nowrap text-[1.35rem] font-extrabold leading-none text-[var(--ink)]">{sessionStats.total}</span><span className="whitespace-nowrap text-[0.65rem] font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">Images</span></div>
      <div className="h-[2.2rem] w-px shrink-0 bg-[var(--line)] max-[900px]:hidden" />
      <div className="flex flex-col items-center gap-0.5 px-5 max-[900px]:items-start max-[900px]:px-0"><span className="whitespace-nowrap text-[1.35rem] font-extrabold leading-none text-[var(--ink)]">{sessionStats.identified}</span><span className="whitespace-nowrap text-[0.65rem] font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">Identified</span></div>
      <div className="h-[2.2rem] w-px shrink-0 bg-[var(--line)] max-[900px]:hidden" />
      <div className="flex flex-col items-center gap-0.5 px-5 max-[900px]:items-start max-[900px]:px-0"><span className="whitespace-nowrap text-[1.35rem] font-extrabold leading-none text-[var(--ink)]">{sessionStats.processed}</span><span className="whitespace-nowrap text-[0.65rem] font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">Processed</span></div>
      {sessionStats.savedBytes > 0 && <><div className="h-[2.2rem] w-px shrink-0 bg-[var(--line)] max-[900px]:hidden" /><div className="flex flex-col items-center gap-0.5 px-5 max-[900px]:items-start max-[900px]:px-0"><span className="whitespace-nowrap text-[1.35rem] font-extrabold leading-none text-green-600">{formatBytes(sessionStats.savedBytes)}</span><span className="whitespace-nowrap text-[0.65rem] font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">Size saved</span></div></>}
      {sessionStats.hasPricing && <><div className="h-[2.2rem] w-px shrink-0 bg-[var(--line)] max-[900px]:hidden" /><div className="flex flex-col items-center gap-0.5 px-5 max-[900px]:items-start max-[900px]:px-0"><span className="whitespace-nowrap text-[1.35rem] font-extrabold leading-none text-[var(--accent)]">{sessionStats.fmtUSD(sessionStats.estLow)}{sessionStats.estHigh !== sessionStats.estLow && `–${sessionStats.fmtUSD(sessionStats.estHigh)}`}</span><span className="whitespace-nowrap text-[0.65rem] font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">Est. portfolio value</span></div></>}
      {sessionStats.brands.length > 0 && <><div className="h-[2.2rem] w-px shrink-0 bg-[var(--line)] max-[900px]:hidden" /><div className="flex flex-col items-start gap-0.5 px-5 max-[900px]:px-0"><div className="flex max-w-[260px] flex-wrap gap-1.5 max-[900px]:max-w-none">{sessionStats.brands.map((b) => <span key={b} className="whitespace-nowrap rounded-full bg-blue-50 px-[0.6em] py-[0.15em] text-[0.7rem] font-bold text-blue-700">{b}</span>)}</div><span className="whitespace-nowrap text-[0.65rem] font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">Brands</span></div></>}
    </div>
  );
}

interface DropZoneProps {
  dragging: boolean;
  itemsLength: number;
  fileInputRef: RefObject<HTMLInputElement>;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent) => void;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

export function ImageLabDropZone({ dragging, itemsLength, fileInputRef, onDragOver, onDragLeave, onDrop, onFileChange }: DropZoneProps) {
  return (
    <div className={['cursor-pointer select-none rounded-[14px] border-2 border-dashed border-[var(--line)] bg-[var(--panel)] px-8 py-8 text-center text-[var(--muted)] transition-[border-color,background,color]', 'flex min-h-[180px] flex-col items-center justify-center gap-2.5', dragging ? 'border-[var(--accent)] bg-blue-50 text-[var(--accent)]' : '', itemsLength > 0 ? 'min-h-[52px] flex-row px-6 py-3' : ''].filter(Boolean).join(' ')} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} onClick={() => fileInputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()} aria-label="Upload images">
      <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={onFileChange} />
      {itemsLength === 0 ? (
        <>
          <div className={dragging ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>
          <p className="m-0 text-base font-semibold text-[var(--ink)]">Drop equipment photos here</p>
          <p className="m-0 text-[0.82rem]">or click to browse · JPEG, PNG, HEIC, WebP accepted</p>
        </>
      ) : (
        <span className="text-[0.87rem] font-semibold">+ Add more images</span>
      )}
    </div>
  );
}

interface BulkActionsProps {
  itemsLength: number;
  hasBusy: boolean;
  aiEnabled: boolean;
  hasIdleToIdentify: boolean;
  hasItemsToProcess: boolean;
  onIdentifyAll: () => void;
  onProcessAll: () => void;
  onClearAll: () => void;
}

export function ImageLabBulkActions({ itemsLength, hasBusy, aiEnabled, hasIdleToIdentify, hasItemsToProcess, onIdentifyAll, onProcessAll, onClearAll }: BulkActionsProps) {
  if (itemsLength === 0) return null;

  return (
    <div className="flex items-center justify-between gap-3 py-2 max-[600px]:flex-col max-[600px]:items-stretch">
      <div className="flex items-center gap-2.5">
        <span className="text-[0.84rem] font-semibold text-[var(--muted)]">{itemsLength} {itemsLength === 1 ? 'image' : 'images'}</span>
        {hasBusy && <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent)]" />}
      </div>
      <div className="flex items-center gap-2 max-[600px]:justify-stretch [&>button]:max-[600px]:flex-1">
        {aiEnabled && <button className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-4 py-2 text-[0.84rem] font-semibold text-[var(--ink)] transition hover:border-[var(--muted)] hover:bg-[var(--bg)] disabled:cursor-not-allowed disabled:opacity-45" onClick={onIdentifyAll} disabled={hasBusy || !hasIdleToIdentify}>Identify All</button>}
        <button className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-4 py-2 text-[0.84rem] font-semibold text-[var(--ink)] transition hover:border-[var(--muted)] hover:bg-[var(--bg)] disabled:cursor-not-allowed disabled:opacity-45" onClick={onProcessAll} disabled={hasBusy || !hasItemsToProcess}>Process All</button>
        <button className="rounded-lg border border-red-300 bg-[var(--panel)] px-4 py-2 text-[0.84rem] font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-45" onClick={onClearAll}>Clear All</button>
      </div>
    </div>
  );
}
