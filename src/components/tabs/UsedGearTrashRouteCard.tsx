import { AppSectionTitle } from '@/components/app/AppSectionTitle';
import { useConfirmationDialog } from '@/hooks/useConfirmationDialog';
import { getUsedGearWorkflowNoteTemplates } from '@/services/usedGearWorkflowNoteTemplates';

export interface UsedGearTrashRouteCardProps {
  description: string;
  reason: string;
  onReasonChange: (value: string) => void;
  onApplyTemplate: (templateValue: string) => void;
  onSubmit: () => void;
  submitLabel?: string;
  savingLabel?: string;
  disabled?: boolean;
  sectionId?: string;
  className?: string;
  textareaClassName?: string;
  isSaving?: boolean;
}

export function UsedGearTrashRouteCard({
  description,
  reason,
  onReasonChange,
  onApplyTemplate,
  onSubmit,
  submitLabel = 'Send To Trash',
  savingLabel = 'Saving...',
  disabled = false,
  sectionId,
  className,
  textareaClassName,
  isSaving = false,
}: UsedGearTrashRouteCardProps) {
  const templates = getUsedGearWorkflowNoteTemplates('unqualified-reason');
  const { requestConfirmation, confirmationModal } = useConfirmationDialog();

  const handleConfirmSubmit = async () => {
    const confirmed = await requestConfirmation({
      title: 'Send row to Trash Review?',
      message: 'This moves the record out of the active parking-lot workflow and into Trash Review.',
      confirmLabel: 'Send To Trash',
      cancelLabel: 'Keep In Parking Lot',
      tone: 'danger',
      bullets: [
        'The current parking-lot review will stop here.',
        'The unqualified reason will be saved with the row for downstream review.',
      ],
    });

    if (!confirmed) {
      return;
    }

    await onSubmit();
  };

  return (
    <>
      <section
        id={sectionId}
        className={[
          'rounded-2xl border border-rose-400/20 bg-rose-500/10 p-5 scroll-mt-28',
          className ?? '',
        ].join(' ').trim()}
      >
        <AppSectionTitle title="Route To Trash" titleClassName="text-lg text-white" className="border-b-rose-300/20 pt-0" />
        <p className="mt-2 text-sm text-rose-100/80">{description}</p>
        <label className="mt-4 block">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-rose-100/70">Unqualified Reason</span>
          <textarea
            className={textareaClassName}
            rows={5}
            value={reason}
            onChange={(event) => onReasonChange(event.currentTarget.value)}
            placeholder="Required before sending this row into trash"
          />
        </label>
        <div className="mt-3 rounded-2xl border border-rose-300/20 bg-white/5 p-3">
          <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-rose-100/80">Common reasons</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                className="rounded-xl border border-rose-200/20 bg-white/5 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-rose-100 shadow-[0_4px_14px_rgba(17,32,49,0.04)] transition hover:-translate-y-0.5 hover:border-rose-200/50 hover:bg-white/10"
                onClick={() => onApplyTemplate(template.value)}
              >
                {template.label}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="mt-4 w-full rounded-xl border border-rose-300/35 bg-rose-500/20 px-4 py-3 text-sm font-semibold text-rose-50 transition hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => {
            void handleConfirmSubmit();
          }}
          disabled={disabled}
        >
          {isSaving ? savingLabel : submitLabel}
        </button>
      </section>
      {confirmationModal}
    </>
  );
}