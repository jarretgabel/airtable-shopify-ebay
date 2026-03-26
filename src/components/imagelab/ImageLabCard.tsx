import { spinnerClass } from '@/components/tabs/uiClasses';
import { formatBytes } from '@/services/imageProcessor';
import { ImageItem, ItemStatus } from './types';

interface CardProps {
  item: ImageItem;
  apiKeyPresent: boolean;
  isCopied: boolean;
  onIdentify: () => void;
  onProcess: () => void;
  onRemove: () => void;
  onCopy: () => void;
  onUploadToShopify: () => void;
  onUploadToEbay: () => void;
}

export function ImageLabCard({ item, apiKeyPresent, isCopied, onIdentify, onProcess, onRemove, onCopy, onUploadToShopify, onUploadToEbay }: CardProps) {
  const { status, aiResult, processed, error, uploads } = item;
  const busy = status === 'identifying' || status === 'processing';
  const shopifyUpload = uploads?.shopify;
  const ebayUpload = uploads?.ebay;
  const uploadBusy = shopifyUpload?.status === 'uploading' || ebayUpload?.status === 'uploading';

  return (
    <article
      className={[
        'flex flex-col overflow-hidden rounded-[14px] border bg-[var(--panel)] shadow-[0_1px_4px_rgba(17,32,49,0.07)] transition-shadow hover:shadow-[0_3px_12px_rgba(17,32,49,0.11)]',
        status === 'done' ? 'border-green-400/35' : '',
        status === 'error' ? 'border-red-400/35' : '',
        status === 'identifying' ? 'border-blue-400/35' : '',
        status !== 'done' && status !== 'error' && status !== 'identifying' ? 'border-[var(--line)]' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex gap-0 max-[600px]:flex-col">
        <div className="relative min-h-[160px] max-h-[220px] flex-1 overflow-hidden bg-[#0a121c] max-[600px]:max-h-[260px]">
          <img src={item.previewUrl} alt={item.file.name} className="block h-full w-full object-cover" />
          <span className="absolute left-1.5 top-1.5 rounded-full bg-[rgba(10,18,28,0.62)] px-[0.55em] py-[0.2em] text-[0.65rem] font-bold uppercase tracking-[0.07em] text-white">Original</span>
        </div>
        {processed && (
          <div className="relative min-h-[160px] max-h-[220px] flex-1 overflow-hidden bg-[#0a121c] max-[600px]:max-h-[260px]">
            <img src={processed.objectUrl} alt="Processed" className="block h-full w-full object-cover" />
            <span className="absolute left-1.5 top-1.5 rounded-full bg-[rgba(21,128,61,0.78)] px-[0.55em] py-[0.2em] text-[0.65rem] font-bold uppercase tracking-[0.07em] text-white">Processed</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 px-4 pb-3.5 pt-3.5">
        <div className="flex items-center justify-between gap-2">
          <p className="m-0 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[0.82rem] font-semibold text-[var(--ink)]" title={item.file.name}>{item.file.name}</p>
          <StatusBadge status={status} />
        </div>

        <p className="m-0 text-[0.75rem] text-[var(--muted)]">
          {formatBytes(item.file.size)}
          {processed && (
            <>
              {' -> '}
              <span className="font-semibold text-[var(--ink)]">{formatBytes(processed.processedBytes)}</span>{' '}
              <span className="font-semibold text-green-300">({Math.round((1 - processed.processedBytes / item.file.size) * 100)}% smaller)</span>
              {' · '}
              {processed.width}×{processed.height}
            </>
          )}
        </p>

        {aiResult && (
          <div className="flex flex-col gap-2 rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3.5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-[var(--line)] px-2 py-[0.15em] text-[0.7rem] font-bold uppercase tracking-[0.07em] text-[var(--muted)]">{aiResult.equipment_type}</span>
              <span className="text-[0.92rem] font-bold text-[var(--ink)]">{aiResult.brand} {aiResult.model}</span>
              {aiResult.year_range && aiResult.year_range !== 'Unknown' && <span className="text-[0.75rem] text-[var(--muted)]">{aiResult.year_range}</span>}
            </div>

            {(aiResult.msrp_original || aiResult.price_range_sold) && (
              <div className="flex flex-wrap gap-3 rounded-lg border border-green-400/35 bg-green-500/15 px-3 py-2">
                {aiResult.msrp_original && aiResult.msrp_original !== 'Unknown' && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[0.65rem] font-bold uppercase tracking-[0.04em] text-green-300">MSRP (new)</span>
                    <span className="text-[0.82rem] font-semibold text-[var(--ink)]">{aiResult.msrp_original}</span>
                  </div>
                )}
                {aiResult.price_range_sold && aiResult.price_range_sold !== 'Unknown' && (
                  <div className="flex flex-col gap-0.5 border-l-2 border-green-400/45 pl-3">
                    <span className="text-[0.65rem] font-bold uppercase tracking-[0.04em] text-green-300">Typical used sold</span>
                    <span className="text-[0.82rem] font-semibold text-green-200">{aiResult.price_range_sold}</span>
                  </div>
                )}
              </div>
            )}

            {aiResult.description && <p className="m-0 text-[0.8rem] leading-[1.55] text-[var(--ink)]">{aiResult.description}</p>}
            {aiResult.condition_notes && (
              <p className="m-0 text-[0.78rem] leading-[1.5] text-[var(--muted)]">
                <span className="font-bold text-[var(--ink)]">Condition:</span> {aiResult.condition_notes}
              </p>
            )}

            {aiResult.specifications && Object.keys(aiResult.specifications).length > 0 && (
              <div className="overflow-hidden rounded-lg border border-[var(--line)]">
                <p className="m-0 border-b border-[var(--line)] bg-[var(--panel)] px-2.5 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.05em] text-[var(--muted)]">Specifications</p>
                <table className="w-full border-collapse text-[0.76rem]"><tbody>{Object.entries(aiResult.specifications).map(([key, val]) => (
                  <tr key={key} className="even:bg-white/5">
                    <td className="w-[42%] whitespace-nowrap border-r border-[var(--line)] px-2.5 py-1 font-semibold text-[var(--ink)]">{key}</td>
                    <td className="px-2.5 py-1 text-[var(--muted)]">{val}</td>
                  </tr>
                ))}</tbody></table>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {aiResult.suggested_sku && <span className="rounded-[5px] bg-slate-800 px-2 py-[0.15em] text-[0.72rem] font-bold text-slate-200">{aiResult.suggested_sku}</span>}
              {aiResult.shopify_product_type && <span className="rounded-[5px] border border-blue-400/35 bg-blue-500/20 px-2 py-[0.15em] text-[0.72rem] font-semibold text-blue-200">{aiResult.shopify_product_type}</span>}
            </div>

            {aiResult.suggested_tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">{aiResult.suggested_tags.map((tag) => <span key={tag} className="rounded-full border border-[var(--line)] bg-[var(--panel)] px-[0.6em] py-[0.15em] text-[0.68rem] font-semibold text-[var(--muted)]">{tag}</span>)}</div>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-400/40 bg-red-500/15 px-3 py-2 text-[0.8rem] leading-[1.5] text-red-200"><strong>Error</strong> - {error}</div>
        )}

        {busy && (
          <div className="flex items-center gap-2.5 text-[0.82rem] text-[var(--muted)]"><div className={spinnerClass} /><span>{status === 'identifying' ? 'Analyzing with AI…' : 'Processing image…'}</span></div>
        )}

        {(shopifyUpload || ebayUpload) && (
          <div className="flex flex-col gap-2 rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-[0.76rem]">
            {shopifyUpload && (
              <div className="flex flex-wrap items-center gap-2 text-[var(--muted)]">
                <span className="font-semibold text-[var(--ink)]">Shopify</span>
                <span>{shopifyUpload.assetLabel ?? 'Image'}</span>
                {shopifyUpload.status === 'uploading' && <span className="text-blue-300">Uploading…</span>}
                {shopifyUpload.status === 'done' && shopifyUpload.url && <a className="text-[var(--accent)] underline-offset-2 hover:underline" href={shopifyUpload.url} target="_blank" rel="noreferrer">Open uploaded image</a>}
                {shopifyUpload.status === 'error' && <span className="text-red-300">{shopifyUpload.error}</span>}
              </div>
            )}
            {ebayUpload && (
              <div className="flex flex-wrap items-center gap-2 text-[var(--muted)]">
                <span className="font-semibold text-[var(--ink)]">eBay</span>
                <span>{ebayUpload.assetLabel ?? 'Image'}</span>
                {ebayUpload.status === 'uploading' && <span className="text-blue-300">Uploading…</span>}
                {ebayUpload.status === 'done' && ebayUpload.url && <a className="text-[var(--accent)] underline-offset-2 hover:underline" href={ebayUpload.url} target="_blank" rel="noreferrer">Open hosted picture</a>}
                {ebayUpload.status === 'error' && <span className="text-red-300">{ebayUpload.error}</span>}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {apiKeyPresent && (
            <button className="rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-3 py-1.5 text-[0.78rem] font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45" onClick={onIdentify} disabled={busy}>
              {status === 'identified' || status === 'done' ? 'Re-identify' : 'Identify'}
            </button>
          )}

          <button className="rounded-lg border border-transparent bg-[linear-gradient(90deg,var(--accent),#2b8cff)] px-3 py-1.5 text-[0.78rem] font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45" onClick={onProcess} disabled={busy}>
            {status === 'done' ? 'Re-process' : 'Process'}
          </button>

          {processed && (
            <>
              <a className="inline-flex items-center rounded-lg border border-transparent bg-green-700 px-3 py-1.5 text-[0.78rem] font-semibold text-white no-underline transition hover:brightness-110" href={processed.objectUrl} download={processed.filename}>Download</a>
              {aiResult && <button className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[0.78rem] font-semibold text-[var(--ink)] transition hover:border-[var(--muted)] hover:bg-[var(--bg)]" onClick={onCopy}>{isCopied ? 'Copied ✓' : 'Copy details'}</button>}
            </>
          )}

          <button className="rounded-lg border border-[#7dd3fc]/35 bg-[#0c4a6e]/50 px-3 py-1.5 text-[0.78rem] font-semibold text-sky-100 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45" onClick={onUploadToShopify} disabled={busy || uploadBusy}>
            {shopifyUpload?.status === 'uploading' ? 'Uploading to Shopify…' : 'Upload to Shopify'}
          </button>

          <button className="rounded-lg border border-[#fda4af]/35 bg-[#7f1d1d]/45 px-3 py-1.5 text-[0.78rem] font-semibold text-rose-100 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45" onClick={onUploadToEbay} disabled={busy || uploadBusy}>
            {ebayUpload?.status === 'uploading' ? 'Uploading to eBay…' : 'Upload to eBay'}
          </button>

          <button className="ml-auto rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 py-1.5 text-[0.78rem] font-semibold text-[var(--muted)] transition hover:border-red-300 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-45" onClick={onRemove} disabled={busy} aria-label="Remove">
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
    idle: 'border border-slate-400/35 bg-slate-500/20 text-slate-200',
    identifying: 'border border-blue-400/35 bg-blue-500/20 text-blue-200',
    identified: 'border border-teal-400/35 bg-teal-500/20 text-teal-200',
    processing: 'border border-amber-400/35 bg-amber-500/20 text-amber-200',
    done: 'border border-green-400/35 bg-green-500/20 text-green-200',
    error: 'border border-red-400/35 bg-red-500/20 text-red-200',
  } as const;

  return <span className={`inline-block shrink-0 whitespace-nowrap rounded-full px-[0.65em] py-[0.18em] text-[0.68rem] font-bold uppercase tracking-[0.06em] ${statusClass[status]}`}>{labels[status]}</span>;
}
