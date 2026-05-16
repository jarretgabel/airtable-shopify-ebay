import { CollapsibleHelperText } from '@/components/app/CollapsibleHelperText';
import { PanelSurface } from '@/components/app/StateSurfaces';
import { WorkflowPageHeader } from '@/components/app/WorkflowPageHeader';
import { AirtableEmbeddedForm } from '@/components/tabs/AirtableEmbeddedForm';

interface UsedGearManualIntakePageProps {
  recordId?: string | null;
  onBackToDirectory?: () => void;
}

const MANUAL_ROUTE_GUIDANCE = [
  {
    label: 'Parking Lot 1',
    description: 'Use for purchases that still need in-app qualification before the rest of intake work begins.',
  },
  {
    label: 'Lot 2: Awaiting Arrival',
    description: 'Use when the deal is confirmed but the unit has not physically arrived yet.',
  },
  {
    label: 'Lot 2: Awaiting SKU',
    description: 'Use when the item is already on site and SKU assignment is the next intake step.',
  },
  {
    label: 'Lot 2: Awaiting Missing Item',
    description: 'Use when intake can start, but follow-up is still needed for a missing unit or missing pieces.',
  },
] as const;

export function UsedGearManualIntakePage({ recordId, onBackToDirectory }: UsedGearManualIntakePageProps) {
  return (
    <PanelSurface>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <WorkflowPageHeader
          eyebrow="Inventory Processing"
          title="Manual Intake"
          description={recordId
            ? 'Update the routed intake record in the same operator-owned surface used for manual entry creation. This keeps accepted arrival-stage rows on one intake page instead of splitting them across duplicate forms.'
            : 'Create used-gear intake records directly from operator knowledge when the item did not start from the shared submission flow. This surface is for first-pass record creation and routing, not broad queue browsing.'}
          actions={onBackToDirectory ? (
            <button
              type="button"
              className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              onClick={onBackToDirectory}
            >
              Back to Inventory
            </button>
          ) : null}
        />

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)]">
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">When To Use This Page</p>
            <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--muted)]">
              <p className="m-0">{recordId
                ? 'Use this page to finish or correct intake details for an accepted arrival-stage row without switching to a separate duplicate form surface.'
                : 'Start here when the operator already has enough information to create the intake row without waiting for a Jotform submission or parking-lot review handoff.'}</p>
              <p className="m-0">{recordId
                ? 'The same field set now handles both first-pass manual creation and later intake edits for accepted items.'
                : 'Pick the route inside the form based on where the item should land next. The route choice determines whether the record enters Parking Lot 1 or one of the arrival-stage Parking Lot 2 buckets.'}</p>
              <p className="m-0">Use submission-group, pickup, and qualification notes when the manual record still needs to stay connected to a larger deal or shared intake context.</p>
            </div>
          </div>

          <aside className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Routing Outcomes</p>
            <div className="mt-4 space-y-3">
              {MANUAL_ROUTE_GUIDANCE.map((route) => (
                <div key={route.label} className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3">
                  <p className="m-0 text-sm font-semibold text-[var(--ink)]">{route.label}</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{route.description}</p>
                </div>
              ))}
            </div>
          </aside>
        </section>

        <div className="max-w-3xl">
          <CollapsibleHelperText label="Operator guide">
            Manual intake is the dedicated creation surface for non-Jotform arrivals. If the item already exists in Parking Lot 1, Parking Lot 2, Testing, Photography, or Listings, open the existing workflow record instead of creating a duplicate here.
          </CollapsibleHelperText>
        </div>

        <AirtableEmbeddedForm recordId={recordId} onBackToDirectory={onBackToDirectory} />
      </div>
    </PanelSurface>
  );
}
