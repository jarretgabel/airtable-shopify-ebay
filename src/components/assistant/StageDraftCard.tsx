import { useEffect, useMemo, useState } from 'react';
import { PHOTOS_DRAFT_FIELDS, TESTING_DRAFT_FIELDS } from '../../../aws/src/shared/contracts/intakeDraft';
import { FormImageUploadEditor } from '@/components/tabs/FormImageUploadEditor';
import { buildApplicableIncludedItems, validatePhotosForm, type InclusionConfirmationKey, type PhotosSubmitIntent } from '@/components/tabs/photos/photosFormValidation';
import type { PhotosFormValues } from '@/components/tabs/photos/photosFormSchema';
import type { TestingFormValues } from '@/components/tabs/testing/testingFormSchema';
import { validateTestingForm } from '@/components/tabs/testing/testingFormValidation';
import type { AssistantIntakeDraft } from '@/services/app-api/ai';
import type { FormImageUploadAsset } from '@/services/formImageUploads';
import { isImageRoleComplete } from '@/services/imageNamingFormatter';
import { loadPhotosFormValues, submitPhotosForm, type PhotosFormLoadResult } from '@/services/photosForm';
import { loadTestingFormValues, submitTestingForm, type TestingFormLoadResult } from '@/services/testingForm';
import { useAssistantStore } from '@/stores/assistantStore';

interface StageDraftCardProps {
  stage: 'testing' | 'photos';
  draft: AssistantIntakeDraft & { recordId: string };
  onDone: (message: string) => void;
  onDiscard: () => void;
}

type Loaded = { stage: 'testing'; data: TestingFormLoadResult } | { stage: 'photos'; data: PhotosFormLoadResult };

const today = () => new Date().toISOString().slice(0, 10);

export function StageDraftCard({ stage, draft, onDone, onDiscard }: StageDraftCardProps) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [assets, setAssets] = useState<FormImageUploadAsset[]>([]);
  const [processing, setProcessing] = useState(false);
  const [confirmations, setConfirmations] = useState<Partial<Record<InclusionConfirmationKey, boolean>>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingFiles = useAssistantStore((state) => state.pendingFiles);
  const clearPendingFiles = useAssistantStore((state) => state.clearPendingFiles);

  useEffect(() => {
    let cancelled = false;
    setLoaded(null);
    setLoadError(null);
    const request = stage === 'testing'
      ? loadTestingFormValues(draft.recordId).then((data): Loaded => ({ stage: 'testing', data }))
      : loadPhotosFormValues(draft.recordId).then((data): Loaded => ({ stage: 'photos', data }));
    request.then((result) => { if (!cancelled) setLoaded(result); })
      .catch((err: unknown) => { if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Unable to load this item.'); });
    return () => { cancelled = true; };
  }, [stage, draft.recordId]);

  const specs = stage === 'testing' ? TESTING_DRAFT_FIELDS : PHOTOS_DRAFT_FIELDS;
  const changed = specs.filter((spec) => draft.values[spec.key]);

  const merged = useMemo(() => {
    if (!loaded) return null;
    const base = { ...loaded.data.values, ...draft.values, imageFiles: files };
    if (loaded.stage === 'testing') {
      const values = base as TestingFormValues;
      return { ...values, testingDate: values.testingDate || today() };
    }
    const values = base as PhotosFormValues;
    return { ...values, photoDate: values.photoDate || today() };
  }, [loaded, draft.values, files]);

  const includedItems = loaded?.stage === 'photos' && merged ? buildApplicableIncludedItems(merged as PhotosFormValues) : [];

  function completionIssue(): string | null {
    if (!loaded || !merged) return 'Still loading the item.';
    if (loaded.stage === 'testing') return validateTestingForm(merged as TestingFormValues);
    return validatePhotosForm(merged as PhotosFormValues, loaded.data.stageContext, confirmations, 'complete', processing);
  }

  async function submit(intent: PhotosSubmitIntent) {
    if (!loaded || !merged || saving) return;
    setError(null);
    if (processing) { setError('Wait for image processing to finish.'); return; }
    if (assets.some((asset) => !isImageRoleComplete(asset.imageRole, asset.customImageRole))) {
      setError('Select an image role for every uploaded image.');
      return;
    }
    if (intent === 'complete') {
      const issue = completionIssue();
      if (issue) { setError(issue); return; }
    } else if (loaded.stage === 'photos') {
      const issue = validatePhotosForm(merged as PhotosFormValues, loaded.data.stageContext, confirmations, 'save', processing);
      if (issue) { setError(issue); return; }
    }

    setSaving(true);
    try {
      const options = {
        recordSource: loaded.data.source,
        originalAudiogonRating: loaded.data.values.audiogonRating,
        imageMetadata: loaded.data.stageContext.imageMetadata,
        originalImageMetadata: loaded.data.stageContext.imageMetadata,
        imageUploadAssets: assets,
        completeWorkflowStage: intent === 'complete',
      };
      const result = loaded.stage === 'testing'
        ? await submitTestingForm(merged as TestingFormValues, draft.recordId, options)
        : await submitPhotosForm(merged as PhotosFormValues, draft.recordId, options);
      const verb = intent === 'complete' ? 'Completed' : 'Saved';
      onDone(`${verb} ${stage === 'testing' ? 'testing' : 'photography'} for ${loaded.data.itemTitle}. [Open it](/workflow-hub/${encodeURIComponent(result.recordId)})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save.');
    } finally {
      setSaving(false);
    }
  }

  const issue = loaded ? completionIssue() : null;
  const label = stage === 'testing' ? 'Testing' : 'Photography';

  return (
    <div className="space-y-2 rounded-xl border border-sky-700 bg-slate-950 p-3 text-xs">
      <p className="m-0 text-sm font-semibold text-sky-200">Draft {label} update (not saved)</p>
      {loadError && <p role="alert" className="m-0 text-red-300">{loadError}</p>}
      {!loaded && !loadError && <p className="m-0 text-slate-400">Loading item…</p>}
      {loaded && <p className="m-0 text-slate-300">{loaded.data.itemTitle}</p>}
      <p className="m-0 text-sky-300">Tip: drag photos anywhere onto this chat to attach them.</p>
      {changed.length > 0 && (
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {changed.map((spec) => (
            <div key={spec.key} className="contents">
              <dt className="text-slate-400">{spec.label}</dt>
              <dd className="m-0 break-words">{draft.values[spec.key]}</dd>
            </div>
          ))}
        </dl>
      )}
      {draft.invalid.map((entry) => (
        <p key={entry.field} className="m-0 text-red-300">{entry.field}: {entry.message}</p>
      ))}
      {loaded && merged && (
        <FormImageUploadEditor
          title={`${label} images`}
          disabled={saving}
          namingContext={{ brand: merged.make, model: merged.model, productType: merged.componentType, companyName: 'Resolution AV' }}
          requireImageRole
          onFilesChange={setFiles}
          onUploadAssetsChange={setAssets}
          onProcessingStateChange={setProcessing}
          incomingFiles={pendingFiles}
          onIncomingFilesConsumed={clearPendingFiles}
          description="Drag images onto the chat or here."
        />
      )}
      {includedItems.length > 0 && (
        <div className="space-y-1">
          <p className="m-0 text-slate-400">Confirm these included items were checked and photographed:</p>
          {includedItems.map((item) => (
            <label key={item.key} className="flex items-center gap-2">
              <input type="checkbox" checked={Boolean(confirmations[item.key])} onChange={(event) => setConfirmations((current) => ({ ...current, [item.key]: event.target.checked }))} />
              {item.label}: {item.value}
            </label>
          ))}
        </div>
      )}
      {loaded && issue && <p className="m-0 text-amber-300">To complete: {issue}</p>}
      {error && <p role="alert" className="m-0 text-red-300">{error}</p>}
      <div className="flex flex-wrap gap-2 pt-1">
        <button type="button" onClick={() => void submit('save')} disabled={!loaded || saving || draft.invalid.length > 0} className="rounded-lg border border-sky-500 px-3 py-1.5 font-semibold text-sky-100 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save progress'}
        </button>
        <button type="button" onClick={() => void submit('complete')} disabled={!loaded || saving || draft.invalid.length > 0 || Boolean(issue)} className="rounded-lg bg-sky-600 px-3 py-1.5 font-semibold text-white disabled:opacity-50">
          Complete {label.toLowerCase()}
        </button>
        <button type="button" onClick={onDiscard} disabled={saving} className="rounded-lg border border-slate-600 px-3 py-1.5 text-slate-200">Discard</button>
      </div>
    </div>
  );
}
