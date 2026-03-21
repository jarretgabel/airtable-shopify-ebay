import { PAGE_DEFINITIONS } from '@/auth/pages';
import type { WorkflowCard } from './dashboardTabTypes';
import { DashboardSectionPanel } from './dashboardPrimitives';

const innerPanelClass =
  'flex flex-col gap-4 rounded-[14px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_1px_3px_rgba(17,32,49,0.06),0_4px_14px_rgba(17,32,49,0.05)]';
const subHeadClass =
  'm-0 flex items-baseline gap-2 border-b border-[var(--line)] pb-3 text-[0.92rem] font-bold text-[var(--ink)]';

export function DashboardWorkflowSection({
  sectionId,
  title,
  cards,
  singleCardId,
  onSelect,
}: {
  sectionId: string;
  title: string;
  cards: WorkflowCard[];
  singleCardId?: string;
  onSelect: (tab: WorkflowCard['id']) => void;
}) {
  if (cards.length === 0) return null;

  return (
    <DashboardSectionPanel id={sectionId} title={title}>
      <WorkflowCardGrid cards={cards} cardKeyPrefix={singleCardId ?? sectionId} onSelect={onSelect} />
    </DashboardSectionPanel>
  );
}

/**
 * Reusable card-grid panel for the "Publishing & Queue" style module.
 * When `title` is provided the grid is wrapped in an inner bordered panel;
 * otherwise the grid is rendered unwrapped (suitable inside DashboardSectionPanel directly).
 */
export function DashboardWorkflowCardGrid({
  title,
  cards,
  cardKeyPrefix,
  onSelect,
}: {
  title?: string;
  cards: WorkflowCard[];
  cardKeyPrefix?: string;
  onSelect: (tab: WorkflowCard['id']) => void;
}) {
  const gridClass =
    cards.length >= 3
      ? 'grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3'
      : 'grid grid-cols-1 gap-3 lg:grid-cols-2';

  const grid = (
    <div className={gridClass}>
      {cards.map((card, index) => (
        <WorkflowButton key={`${cardKeyPrefix ?? 'card'}-${card.id}-${index}`} card={card} onSelect={onSelect} />
      ))}
    </div>
  );

  if (!title) return grid;

  return (
    <section className={innerPanelClass}>
      <h3 className={subHeadClass}>{title}</h3>
      {grid}
    </section>
  );
}

function WorkflowCardGrid({
  cards,
  cardKeyPrefix,
  onSelect,
}: {
  cards: WorkflowCard[];
  cardKeyPrefix: string;
  onSelect: (tab: WorkflowCard['id']) => void;
}) {
  const gridClass =
    cards.length >= 3
      ? 'grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3'
      : 'grid grid-cols-1 gap-3 lg:grid-cols-2';
  return (
    <div className={gridClass}>
      {cards.map((card) => (
        <WorkflowButton key={`${cardKeyPrefix}-${card.id}`} card={card} onSelect={onSelect} />
      ))}
    </div>
  );
}

function WorkflowButton({ card, onSelect }: { card: WorkflowCard; onSelect: (tab: WorkflowCard['id']) => void }) {
  return (
    <button
      type="button"
      className="flex h-full flex-col gap-3 rounded-[16px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(104,164,255,0.1),transparent_56%),linear-gradient(180deg,rgba(15,23,42,0.9),rgba(8,15,26,0.96))] p-4 text-left text-[var(--ink)] transition hover:-translate-y-px hover:border-sky-400/35 hover:shadow-[0_18px_34px_rgba(2,6,23,0.28)]"
      onClick={() => onSelect(card.id)}
    >
      <div>
        <p className="m-0 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-sky-200/80">{card.eyebrow}</p>
        <h3 className="m-0 mt-1 text-[0.98rem] font-bold text-white">{card.title}</h3>
      </div>
      <p className="m-0 min-h-[3.6rem] text-[0.8rem] leading-[1.55] text-slate-300">{card.detail}</p>
      <div className="mt-auto flex flex-wrap gap-2">
        {card.stats.map((stat, index) => (
          <span key={`${stat}-${index}`} className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2.5 py-1 text-[0.7rem] font-semibold text-sky-100">
            {stat}
          </span>
        ))}
      </div>
      <span className="text-[0.74rem] font-semibold text-[var(--accent)]">Open {PAGE_DEFINITIONS[card.id].label} →</span>
    </button>
  );
}
