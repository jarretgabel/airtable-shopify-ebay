import { useState } from 'react';
import { getAIProvider } from '@/services/equipmentAI';
import { DEFAULT_OPTIONS, type ProcessingOptions } from '@/services/imageProcessor';
import { ImageLabCard } from '@/components/imagelab/ImageLabCard';
import {
  ImageLabOptionsPanel,
  ImageLabSessionStatsBar,
  ImageLabDropZone,
  ImageLabBulkActions,
} from '@/components/imagelab/ImageLabPanels';
import { useImageLabItems } from '@/components/imagelab/useImageLabItems';

export function ImageLab() {
  const [opts, setOpts] = useState<ProcessingOptions>(DEFAULT_OPTIONS);
  const { provider: aiProvider } = getAIProvider();
  const aiEnabled = aiProvider !== 'none';
  const {
    items,
    dragging,
    copyId,
    fileInputRef,
    onDragOver,
    onDragLeave,
    onDrop,
    onFileChange,
    identifyItem,
    processItem,
    identifyAll,
    processAll,
    removeItem,
    clearAll,
    copyDetails,
    uploadToShopify,
    uploadToEbay,
    hasBusy,
    hasIdleToIdentify,
    hasItemsToProcess,
    sessionStats,
  } = useImageLabItems(opts);

  return (
    <div className="flex flex-col gap-4 pt-1">
      {!aiEnabled ? (
        <div className="rounded-[10px] border border-amber-300 bg-amber-50 px-4 py-3 text-[0.84rem] leading-[1.6] text-amber-900 [&_a]:text-amber-800 [&_code]:rounded [&_code]:bg-black/5 [&_code]:px-[0.35em] [&_code]:py-[0.1em] [&_code]:text-[0.82em]">
          <strong>No AI key configured.</strong> To enable equipment identification, add one of the following to <code>.env.local</code> and restart:
          <br />
          {' '}• <code>VITE_GITHUB_TOKEN=github_pat_...</code> - free with your Copilot subscription (<a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer">generate a PAT</a>, no special scopes needed)
          <br />
          {' '}• <code>VITE_OPENAI_API_KEY=sk-...</code> - OpenAI paid API
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

      <ImageLabOptionsPanel opts={opts} setOpts={setOpts} />

      <ImageLabSessionStatsBar itemsLength={items.length} sessionStats={sessionStats} />

      <ImageLabDropZone
        dragging={dragging}
        itemsLength={items.length}
        fileInputRef={fileInputRef}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onFileChange={onFileChange}
      />

      <ImageLabBulkActions
        itemsLength={items.length}
        hasBusy={hasBusy}
        aiEnabled={aiEnabled}
        hasIdleToIdentify={hasIdleToIdentify}
        hasItemsToProcess={hasItemsToProcess}
        onIdentifyAll={identifyAll}
        onProcessAll={processAll}
        onClearAll={clearAll}
      />

      {items.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4 max-[600px]:grid-cols-1">
          {items.map((item) => (
            <ImageLabCard
              key={item.id}
              item={item}
              apiKeyPresent={aiEnabled}
              isCopied={copyId === item.id}
              onIdentify={() => identifyItem(item.id)}
              onProcess={() => processItem(item.id)}
              onRemove={() => removeItem(item.id)}
              onCopy={() => item.aiResult && copyDetails(item.id, item.aiResult)}
              onUploadToShopify={() => uploadToShopify(item.id)}
              onUploadToEbay={() => uploadToEbay(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
