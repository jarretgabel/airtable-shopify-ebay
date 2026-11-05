import { useState } from 'react';
import { INTAKE_DRAFT_FIELDS } from '../../../aws/src/shared/contracts/intakeDraft';
import { createManualIntakeFormDefaults, type ManualIntakeFormValues } from '@/components/tabs/manual-intake/manualIntakeFormSchema';
import type { AssistantIntakeDraft } from '@/services/app-api/ai';
import { submitManualIntakeForm } from '@/services/manualIntakeForm';

interface IntakeDraftCardProps {
  draft: AssistantIntakeDraft;
  onCreated: (recordId: string) => void;
  onDiscard: () => void;
}

export function IntakeDraftCard({ draft, onCreated, onDiscard }: IntakeDraftCardProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filled = INTAKE_DRAFT_FIELDS.filter((spec) => draft.values[spec.key]);
  const ready = draft.missing.length === 0 && draft.invalid.length === 0;

  async function create() {
    if (!ready || saving) return;
    setSaving(true);
    setError(null);
    try {
      const values: ManualIntakeFormValues = { ...createManualIntakeFormDefaults(), ...draft.values };
      const result = await submitManualIntakeForm(values);
      onCreated(result.recordId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create the item.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-sky-700 bg-slate-950 p-3 text-xs">
      <p className="m-0 text-sm font-semibold text-sky-200">Draft intake item (not saved)</p>
      {filled.length === 0 ? (
        <p className="m-0 text-slate-400">No details yet.</p>
      ) : (
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {filled.map((spec) => (
            <div key={spec.key} className="contents">
              <dt className="text-slate-400">{spec.label}</dt>
              <dd className="m-0 break-words">{draft.values[spec.key]}</dd>
            </div>
          ))}
        </dl>
      )}
      {draft.missing.length > 0 && <p className="m-0 text-amber-300">Still needed: {draft.missing.join(', ')}</p>}
      {draft.invalid.map((issue) => (
        <p key={issue.field} className="m-0 text-red-300">{issue.field}: {issue.message}</p>
      ))}
      {error && <p role="alert" className="m-0 text-red-300">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={() => void create()} disabled={!ready || saving} className="rounded-lg bg-sky-600 px-3 py-1.5 font-semibold text-white disabled:opacity-50">
          {saving ? 'Creating…' : 'Create item'}
        </button>
        <button type="button" onClick={onDiscard} disabled={saving} className="rounded-lg border border-slate-600 px-3 py-1.5 text-slate-200">Discard</button>
      </div>
    </div>
  );
}
