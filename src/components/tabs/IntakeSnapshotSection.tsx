import type { ReactNode } from 'react';
import { AppSectionTitle } from '@/components/app/AppSectionTitle';

export interface IntakeSnapshotField {
  label: string;
  value: string;
  description?: string;
}

export interface IntakeSnapshotCard {
  title: string;
  value: string;
  emptyValue?: string;
}

export interface IntakeSnapshotSectionProps {
  fields: IntakeSnapshotField[];
  cards: IntakeSnapshotCard[];
  title?: string;
  description?: string;
  className?: string;
  actions?: ReactNode;
  sectionId?: string;
  children?: ReactNode;
}

function SnapshotFieldCard({ label, value, description }: IntakeSnapshotField) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5">
      <p className="m-0 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-sm leading-5 text-[var(--ink)]">{value || 'Not provided'}</p>
      {description ? <p className="mt-1 text-[0.72rem] leading-5 text-[var(--muted)]">{description}</p> : null}
    </div>
  );
}

function SnapshotNoteCard({ title, value, emptyValue }: IntakeSnapshotCard) {
  const content = value.trim() || emptyValue || 'No notes available.';

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] p-4 text-sm text-[var(--muted)]">
      <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{title}</p>
      <p className="mt-2 whitespace-pre-wrap leading-6 text-[var(--ink)]">{content}</p>
    </div>
  );
}

export function IntakeSnapshotSection({
  fields,
  cards,
  title = 'Intake Snapshot',
  description,
  className,
  actions,
  sectionId,
  children,
}: IntakeSnapshotSectionProps) {
  return (
    <div id={sectionId} className={['rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5', className].filter(Boolean).join(' ')}>
      <AppSectionTitle title={title} titleClassName="text-lg" actions={actions} />
      {description ? <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p> : null}
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((field) => <SnapshotFieldCard key={field.label} {...field} />)}
      </div>

      {cards.length > 0 ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {cards.map((card) => <SnapshotNoteCard key={card.title} {...card} />)}
        </div>
      ) : null}

      {children}
    </div>
  );
}