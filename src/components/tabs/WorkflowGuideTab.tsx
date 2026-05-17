import { useMemo, type ReactNode } from 'react';
import { PAGE_DEFINITIONS, type AppPage } from '@/auth/pages';
import { AppPageLayout } from '@/components/app/AppPageLayout';
import { MainPageSectionNav } from '@/components/app/MainPageSectionNav';
import type { UserRole } from '@/stores/auth/authTypes';
import { PageTitleHeader } from '@/components/app/PageTitleHeader';
import { usePageSectionTracking } from '@/components/app/usePageSectionTracking';
import {
  getVisibleRecordCards,
  getVisiblePageCards,
  getRoleStartPoints,
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
  id?: string;
  eyebrow: string;
  title: string;
  summary: string;
  children: ReactNode;
}

function GuideSection({ id, eyebrow, title, summary, children }: GuideSectionProps) {
  return (
    <section id={id} className="scroll-mt-28 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_18px_40px_rgba(2,6,23,0.18)]">
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

function GuideReferenceCard({
  title,
  summary,
  leftLabel,
  leftItems,
  workflows,
  href,
  ctaLabel,
}: {
  title: string;
  summary: string;
  leftLabel: string;
  leftItems: string[];
  workflows: string[];
  href?: string;
  ctaLabel?: string;
}) {
  return (
    <article className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-4">
      <h4 className="m-0 text-sm font-semibold text-[var(--ink)]">{title}</h4>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{summary}</p>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div>
          <p className="m-0 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{leftLabel}</p>
          <ul className="mt-2 space-y-2 pl-5 text-sm leading-6 text-[var(--muted)]">
            {leftItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div>
          <p className="m-0 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Use It For</p>
          <ul className="mt-2 space-y-2 pl-5 text-sm leading-6 text-[var(--muted)]">
            {workflows.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      {href && ctaLabel ? (
        <div className="mt-4">
          <a
            href={href}
            className="inline-flex items-center rounded-full border border-[var(--accent)]/35 bg-[var(--accent)]/10 px-3 py-1.5 text-sm font-semibold text-[var(--accent)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--accent)]/16"
          >
            {ctaLabel}
          </a>
        </div>
      ) : null}
    </article>
  );
}

function RoleStartStrip({
  currentUserRole,
  accessiblePages,
}: {
  currentUserRole: UserRole;
  accessiblePages: AppPage[];
}) {
  const startPoints = getRoleStartPoints(currentUserRole, accessiblePages);

  if (startPoints.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {startPoints.map((item) => {
        const pageLabel = PAGE_DEFINITIONS[item.page]?.label ?? item.page;
        const pagePath = PAGE_DEFINITIONS[item.page]?.path ?? '#';

        return (
          <article key={`${item.page}-${item.title}`} className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-4">
            <p className="m-0 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Open this first</p>
            <p className="mt-2 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{pageLabel}</p>
            <h4 className="mt-2 m-0 text-sm font-semibold text-[var(--ink)]">{item.title}</h4>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.detail}</p>
            <a
              href={pagePath}
              className="mt-4 inline-flex items-center rounded-full border border-[var(--accent)]/35 bg-[var(--accent)]/10 px-3 py-1.5 text-sm font-semibold text-[var(--accent)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--accent)]/16"
            >
              Open {pageLabel}
            </a>
          </article>
        );
      })}
    </div>
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
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className={['m-0 inline-flex items-center rounded-full border px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.12em] whitespace-nowrap', toneStyles.marker].join(' ')}>
            {stage.tone.replace('-', ' ')}
          </p>
          <span
            className={[
              'inline-flex items-center whitespace-nowrap rounded-full px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em]',
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
        <h4 className="mt-3 m-0 text-sm font-semibold text-[var(--ink)]">{stage.title}</h4>
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

  return (
    <div className="space-y-3">
      <div className="rounded-[28px] border border-[var(--line)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--panel)_94%,transparent),color-mix(in_srgb,var(--bg)_90%,transparent))] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.16)] xl:p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
          <span className="inline-flex items-center whitespace-nowrap rounded-full bg-[var(--accent)]/15 px-3 py-1 text-[var(--accent)]">Your lane</span>
          <span className="inline-flex items-center whitespace-nowrap rounded-full bg-sky-400/15 px-3 py-1 text-sky-200">You support</span>
          <span className="inline-flex items-center whitespace-nowrap rounded-full bg-[var(--panel)] px-3 py-1">Reference</span>
        </div>

        <div className="space-y-4">
          {visibleStages.map((stage, index) => (
            <div key={stage.title} className="relative pl-12">
              {index < visibleStages.length - 1 ? (
                <div className="absolute bottom-[-18px] left-5 top-11 w-px bg-[color:color-mix(in_srgb,var(--line)_72%,white_10%)]" />
              ) : null}
              <span className="absolute left-0 top-1 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--panel)] text-sm font-bold text-[var(--ink)] shadow-[0_8px_20px_rgba(2,6,23,0.18)]">
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
  const visibleRecordCards = getVisibleRecordCards(accessiblePages);
  const guideSections = useMemo(
    () => [
      { id: 'workflow-lane', key: 'workflow-lane', label: 'Workflow Lane' },
      { id: 'role-view', key: 'role-view', label: 'Role View' },
      { id: 'daily-flow', key: 'daily-flow', label: 'Daily Flow' },
      { id: 'page-reference', key: 'page-reference', label: 'Pages' },
      { id: 'record-reference', key: 'record-reference', label: 'Record Pages' },
      { id: 'quick-answers', key: 'quick-answers', label: 'Quick Answers' },
    ],
    [],
  );
  const { activeSectionId, scrollToSection } = usePageSectionTracking(guideSections, guideSections[0].id);

  return (
    <AppPageLayout>
      <PageTitleHeader eyebrow="Guide" title="User Guide" />

      <MainPageSectionNav
        ariaLabel="User guide sections"
        items={guideSections.map((section) => ({ key: section.id, label: section.label }))}
        activeKey={activeSectionId}
        onSelect={scrollToSection}
        className="mb-1"
      />

      <section className="rounded-2xl border border-[var(--line)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--panel)_92%,transparent),color-mix(in_srgb,var(--bg)_88%,transparent))] p-5 shadow-[0_20px_45px_rgba(2,6,23,0.2)]">
        <p className="m-0 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Your Starting Point</p>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">{roleSummary(currentUserRole)}</p>
        <div className="mt-4">
          <RoleStartStrip currentUserRole={currentUserRole} accessiblePages={accessiblePages} />
        </div>
      </section>

      <GuideSection
        id="workflow-lane"
        eyebrow="Flow"
        title="Your Workflow Lane"
        summary="Read this in order. The chart is trimmed to the stages this role usually touches, with adjacent handoffs left in when they help explain the flow. The page references below are the strictly access-scoped part."
      >
        <WorkflowFlowChart currentUserRole={currentUserRole} />
      </GuideSection>

      <GuideSection
        id="role-view"
        eyebrow="Role View"
        title={roleGuide.quickStartTitle}
        summary={roleGuide.quickStartSummary}
      >
        <QuickStartCard title="Focus for this login" items={roleGuide.quickStartItems} />
      </GuideSection>

      <GuideSection
        id="daily-flow"
        eyebrow="Big Picture"
        title="How The Work Flows For You"
        summary={roleGuide.flowSummary}
      >
        <StepList steps={roleGuide.flowSteps} />
      </GuideSection>

      <GuideSection
        id="page-reference"
        eyebrow="Relevant Pages"
        title="How To Use The Pages For This Role"
        summary="This is organized page first, then module-by-module, so the fastest question stays clear: which page owns the job you are trying to do? Only pages this login can access appear here."
      >
        <div className="grid gap-3">
          {visiblePageCards.map((card) => (
            <GuideReferenceCard
              key={card.title}
              title={card.title}
              summary={card.summary}
              leftLabel="Modules On This Page"
              leftItems={card.modules}
              workflows={card.workflows}
              href={PAGE_DEFINITIONS[card.pages[0]]?.path}
              ctaLabel={`Open ${card.title}`}
            />
          ))}
        </div>
      </GuideSection>

      <GuideSection
        id="record-reference"
        eyebrow="Deeper Surfaces"
        title="Record And Detail Pages"
        summary="Use this section when a queue or directory gets you close, but the actual work, audit trail, or grouped decision lives on a deeper single-record or group page. Only record surfaces tied to accessible pages appear here."
      >
        <div className="grid gap-3">
          {visibleRecordCards.map((card) => (
            <GuideReferenceCard
              key={card.title}
              title={card.title}
              summary={card.summary}
              leftLabel="Key Surfaces"
              leftItems={card.surfaces}
              workflows={card.workflows}
              href={PAGE_DEFINITIONS[card.pages[0]]?.path}
              ctaLabel={`Open ${PAGE_DEFINITIONS[card.pages[0]]?.label ?? 'parent page'}`}
            />
          ))}
        </div>
      </GuideSection>

      <GuideSection
        id="quick-answers"
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
    </AppPageLayout>
  );
}