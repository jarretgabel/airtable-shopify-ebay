import type { ReactNode } from 'react';
import { PAGE_DEFINITIONS, type AppPage } from '@/auth/pages';
import type { UserRole } from '@/stores/auth/authTypes';
import { PageTitleHeader } from '@/components/app/PageTitleHeader';
import {
  getVisiblePageCards,
  getWorkflowFlowStagesForRole,
  ROLE_GUIDES,
  roleSummary,
  shouldShowWorkflowTrashPath,
  type GuideStep,
  type WorkflowFlowStage,
} from '@/components/tabs/workflowGuideContent';

interface WorkflowGuideTabProps {
  currentUserRole: UserRole;
  currentUserName: string;
  accessiblePages: AppPage[];
}

interface GuideSectionProps {
  eyebrow: string;
  title: string;
  summary: string;
  children: ReactNode;
}

function GuideSection({ eyebrow, title, summary, children }: GuideSectionProps) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_18px_40px_rgba(2,6,23,0.18)]">
      <p className="m-0 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{eyebrow}</p>
      <h3 className="mt-2 text-xl font-semibold text-[var(--ink)]">{title}</h3>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">{summary}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function StepList({ steps }: { steps: GuideStep[] }) {
  return (
    <ol className="grid gap-3 lg:grid-cols-2">
      {steps.map((step, index) => (
        <li key={step.title} className="list-none rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/15 text-sm font-semibold text-[var(--accent)]">
              {index + 1}
            </span>
            <div>
              <p className="m-0 text-sm font-semibold text-[var(--ink)]">{step.title}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{step.detail}</p>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function QuickStartCard({ title, items }: { title: string; items: string[] }) {
  return (
    <article className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-4">
      <h4 className="m-0 text-sm font-semibold text-[var(--ink)]">{title}</h4>
      <ul className="mt-3 space-y-2 pl-5 text-sm leading-6 text-[var(--muted)]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}

function FlowStageCard({
  currentUserRole,
  stage,
}: {
  currentUserRole: UserRole;
  stage: WorkflowFlowStage;
}) {
  const isPrimary = stage.primaryRoles.includes(currentUserRole);
  const isSupport = stage.supportRoles?.includes(currentUserRole) ?? false;
  const relevantPages = stage.pages
    .map((page) => PAGE_DEFINITIONS[page]?.label)
    .filter((label): label is string => Boolean(label));
  const toneStyles = {
    intake: {
      edge: 'border-l-4 border-l-cyan-400',
      marker: 'bg-cyan-400/15 text-cyan-200 border-cyan-400/30',
      rail: 'bg-cyan-300/40',
    },
    decision: {
      edge: 'border-l-4 border-l-rose-400',
      marker: 'bg-rose-400/15 text-rose-200 border-rose-400/30',
      rail: 'bg-rose-300/40',
    },
    routing: {
      edge: 'border-l-4 border-l-amber-400',
      marker: 'bg-amber-400/15 text-amber-200 border-amber-400/30',
      rail: 'bg-amber-300/40',
    },
    specialist: {
      edge: 'border-l-4 border-l-sky-400',
      marker: 'bg-sky-400/15 text-sky-200 border-sky-400/30',
      rail: 'bg-sky-300/40',
    },
    publish: {
      edge: 'border-l-4 border-l-violet-400',
      marker: 'bg-violet-400/15 text-violet-200 border-violet-400/30',
      rail: 'bg-violet-300/40',
    },
    'follow-through': {
      edge: 'border-l-4 border-l-emerald-400',
      marker: 'bg-emerald-400/15 text-emerald-200 border-emerald-400/30',
      rail: 'bg-emerald-300/40',
    },
  }[stage.tone];

  return (
    <article
      className={[
        'rounded-2xl border bg-[var(--bg)]/80 p-4 shadow-[0_10px_24px_rgba(2,6,23,0.12)] backdrop-blur-[1px]',
        toneStyles.edge,
        isPrimary
          ? 'border-[var(--accent)] bg-[color:color-mix(in_srgb,var(--accent)_10%,var(--bg))]'
          : isSupport
            ? 'border-sky-400/40'
            : 'border-[var(--line)]',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={['m-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.12em]', toneStyles.marker].join(' ')}>
            {stage.tone.replace('-', ' ')}
          </p>
          <h4 className="mt-2 m-0 text-sm font-semibold text-[var(--ink)]">{stage.title}</h4>
        </div>
        <span
          className={[
            'rounded-full px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em]',
            isPrimary
              ? 'bg-[var(--accent)] text-slate-950'
              : isSupport
                ? 'bg-sky-400/15 text-sky-200'
                : 'bg-[var(--panel)] text-[var(--muted)]',
          ].join(' ')}
        >
          {isPrimary ? 'Your lane' : isSupport ? 'You support' : 'Reference'}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{stage.detail}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {relevantPages.map((label) => (
          <span key={label} className="inline-flex items-center rounded-full border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
            {label}
          </span>
        ))}
      </div>
    </article>
  );
}

function WorkflowFlowChart({ currentUserRole }: { currentUserRole: UserRole }) {
  const visibleStages = getWorkflowFlowStagesForRole(currentUserRole);
  const showTrashPath = shouldShowWorkflowTrashPath(currentUserRole);
  const desktopColumns = visibleStages.length >= 5 ? 'xl:grid-cols-5' : visibleStages.length === 4 ? 'xl:grid-cols-4' : 'xl:grid-cols-3';

  return (
    <div className="space-y-3">
      <div className="rounded-[28px] border border-[var(--line)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--panel)_94%,transparent),color-mix(in_srgb,var(--bg)_90%,transparent))] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.16)] xl:p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
          <span className="rounded-full bg-[var(--accent)]/15 px-2.5 py-1 text-[var(--accent)]">Your lane</span>
          <span className="rounded-full bg-sky-400/15 px-2.5 py-1 text-sky-200">You support</span>
          <span className="rounded-full bg-[var(--panel)] px-2.5 py-1">Reference</span>
        </div>

        <div className="relative hidden xl:block">
          <div className="absolute left-[10%] right-[10%] top-5 h-px bg-[color:color-mix(in_srgb,var(--line)_72%,white_10%)]" />
          <div className={`relative grid gap-3 ${desktopColumns}`}>
            {visibleStages.map((stage, index) => (
              <div key={stage.title} className="relative">
                <div className="mb-3 flex justify-center">
                  <span className="relative z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--panel)] text-sm font-bold text-[var(--ink)] shadow-[0_8px_20px_rgba(2,6,23,0.18)]">
                    {index + 1}
                  </span>
                </div>
                <FlowStageCard currentUserRole={currentUserRole} stage={stage} />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3 xl:hidden">
          {visibleStages.map((stage, index) => (
            <div key={stage.title} className="relative pl-9">
              {index < visibleStages.length - 1 ? (
                <div className="absolute bottom-[-14px] left-[15px] top-9 w-px bg-[color:color-mix(in_srgb,var(--line)_72%,white_10%)]" />
              ) : null}
              <span className="absolute left-0 top-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--panel)] text-xs font-bold text-[var(--ink)] shadow-[0_8px_20px_rgba(2,6,23,0.18)]">
                {index + 1}
              </span>
              <FlowStageCard currentUserRole={currentUserRole} stage={stage} />
            </div>
          ))}
        </div>
      </div>
      {showTrashPath ? (
        <div className="rounded-2xl border border-dashed border-rose-400/30 bg-[color:color-mix(in_srgb,var(--bg)_92%,#3f0d1a_8%)] p-4">
          <p className="m-0 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-rose-200">Side path</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Items that fail qualification move to Trash Review. They can be restored, re-qualified back into Parking Lot 2, or permanently removed.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function WorkflowGuideTab({ currentUserRole, currentUserName: _currentUserName, accessiblePages }: WorkflowGuideTabProps) {
  const roleGuide = ROLE_GUIDES[currentUserRole];
  const visiblePageCards = getVisiblePageCards(accessiblePages);

  return (
    <div className="space-y-5">
      <PageTitleHeader title="User Guide" />

      <section className="rounded-2xl border border-[var(--line)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--panel)_92%,transparent),color-mix(in_srgb,var(--bg)_88%,transparent))] p-5 shadow-[0_20px_45px_rgba(2,6,23,0.2)]">
        <p className="m-0 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Your Starting Point</p>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">{roleSummary(currentUserRole)}</p>
      </section>

      <GuideSection
        eyebrow="Flow"
        title="Your Workflow Lane"
        summary="Read this in order. The chart is trimmed to the stages this role usually touches, with color-coded stops for quicker scanning."
      >
        <WorkflowFlowChart currentUserRole={currentUserRole} />
      </GuideSection>

      <GuideSection
        eyebrow="Role View"
        title={roleGuide.quickStartTitle}
        summary={roleGuide.quickStartSummary}
      >
        <QuickStartCard title="Focus for this login" items={roleGuide.quickStartItems} />
      </GuideSection>

      <GuideSection
        eyebrow="Big Picture"
        title="How The Work Flows For You"
        summary={roleGuide.flowSummary}
      >
        <StepList steps={roleGuide.flowSteps} />
      </GuideSection>

      <GuideSection
        eyebrow="Relevant Pages"
        title="How To Use The Pages For This Role"
        summary="This keeps the page-level instructions in one place so the operational screens can stay focused on the work itself."
      >
        <div className="grid gap-3 lg:grid-cols-2">
          {visiblePageCards.map((card) => (
            <QuickStartCard key={card.title} title={card.title} items={card.items} />
          ))}
        </div>
      </GuideSection>

      <GuideSection
        eyebrow="Quick Answers"
        title="Common Questions For Your Role"
        summary="These answers are trimmed to the work this login is expected to handle."
      >
        <div className="space-y-3">
          {roleGuide.questions.map((item) => (
            <article key={item.question} className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-4">
              <h4 className="m-0 text-sm font-semibold text-[var(--ink)]">{item.question}</h4>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.answer}</p>
            </article>
          ))}
        </div>
      </GuideSection>
    </div>
  );
}