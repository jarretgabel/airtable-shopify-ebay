import { PAGE_DEFINITIONS, type AppPage } from '@/auth/pages';
import type { UserRole } from '@/stores/auth/authTypes';

export interface GuideStep {
  title: string;
  detail: string;
}

export interface QuickAnswer {
  question: string;
  answer: string;
}

export interface RoleGuide {
  quickStartTitle: string;
  quickStartSummary: string;
  quickStartItems: string[];
  flowSummary: string;
  flowSteps: GuideStep[];
  questions: QuickAnswer[];
}

export interface PageGuideCard {
  title: string;
  pages: AppPage[];
  items: string[];
}

export interface WorkflowFlowStage {
  title: string;
  detail: string;
  pages: AppPage[];
  tone: 'intake' | 'decision' | 'routing' | 'specialist' | 'publish' | 'follow-through';
  primaryRoles: UserRole[];
  supportRoles?: UserRole[];
}

export function roleSummary(role: UserRole): string {
  if (role === 'processor') {
    return 'Start with Parking Lot 1, the workflow hub, and the specialist queues. Listings takes over once a row reaches Awaiting Pre-Listing Review.';
  }

  if (role === 'tester') {
    return 'Your day usually starts in the testing queue, then moves into the record-specific testing form when a row needs hands-on notes.';
  }

  if (role === 'photographer') {
    return 'Your day usually starts in the photography queue, then moves into the record-specific photos form when a row is ready for images and handoff.';
  }

  if (role === 'developer') {
    return 'Use this page as a plain-language map of the operation while you work in the supporting tools and source feeds.';
  }

  return 'Use this page as the short version of how intake, workflow, listing, and shipping fit together across the app.';
}

export function roleLabel(role: UserRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export const ROLE_GUIDES: Record<UserRole, RoleGuide> = {
  admin: {
    quickStartTitle: 'Admin quick start',
    quickStartSummary: 'Keep the whole operation moving, then drop into the exact queue or record that needs intervention.',
    quickStartItems: [
      'Start on the dashboard to spot backlog, handoff gaps, and publish blockers.',
      'Use Parking Lot 1 and the workflow hub to resolve stalled intake, routing, or post-publish issues.',
      'Check Listings when items are entering listing review or need publish decisions.',
    ],
    flowSummary: 'You need the whole map because your role crosses intake, active workflow, listings, and follow-through.',
    flowSteps: [
      {
        title: 'Watch the dashboard for pressure points',
        detail: 'Use the summary views to see where intake, stage work, or post-publish tasks are backing up.',
      },
      {
        title: 'Resolve intake and routing blockers first',
        detail: 'Parking Lot 1 and the workflow hub are where missing notes, routing problems, active-stage blockers, and post-publish exceptions get cleaned up.',
      },
      {
        title: 'Confirm publish readiness before release',
        detail: 'Listings surfaces should only move forward when pricing, notes, and signoffs are in place.',
      },
      {
        title: 'Close the loop after publish',
        detail: 'Use the Listings record view for stale recovery, sold-ready handoff, shipment completion, and workflow audit once the item reaches listing-phase work.',
      },
    ],
    questions: [
      {
        question: 'Where do I look when the team says work is stuck?',
        answer: 'Start with the dashboard, then open the queue or operational record that owns the current blocker.',
      },
      {
        question: 'Which page should handle publish-ready decisions?',
        answer: 'Listings should handle the final release decision, not the intake or processing queues.',
      },
    ],
  },
  owner: {
    quickStartTitle: 'Owner quick start',
    quickStartSummary: 'Use the same operational map as admin, with focus on throughput, accountability, and exceptions.',
    quickStartItems: [
      'Start on the dashboard to see how work is distributed and where the team needs attention.',
      'Use workflow and queue pages to remove blockers before they delay listings or shipping.',
      'Review user access, notifications, and channel surfaces when process or oversight changes are needed.',
    ],
    flowSummary: 'This view keeps the full operation visible while still emphasizing the checkpoints that need owner attention.',
    flowSteps: [
      {
        title: 'Track the front door',
        detail: 'Parking Lot 1 shows what is new, what still needs qualification, and what should not continue.',
      },
      {
        title: 'Keep active work moving between teams',
        detail: 'Stage status, signoffs, and the next team should always make the next step obvious.',
      },
      {
        title: 'Watch the release gates',
        detail: 'Listings pages are where readiness turns into live selling work.',
      },
      {
        title: 'Finish the sale-to-shipment cycle',
        detail: 'Post-publish follow-through matters because sold items still need clean shipment completion and history.',
      },
    ],
    questions: [
      {
        question: 'Where do I spot process gaps fastest?',
        answer: 'Start on the dashboard, then open the queue with the oldest backlog or the record with the clearest blocker.',
      },
      {
        question: 'What is the shortest path to understanding a problem item?',
        answer: 'Open the operational record for the current stage. Listings now carries the workflow audit and post-publish context once the item reaches listing-phase work.',
      },
    ],
  },
  processor: {
    quickStartTitle: 'Processor quick start',
    quickStartSummary: 'This is the operational lane for intake, handoff, and getting an item ready for the next specialist.',
    quickStartItems: [
      'Start in Parking Lot 1 for fresh intake or the workflow hub for already-active operational items.',
      'Clean up notes, confirm the next stage, and move the item into the next real handoff instead of leaving it parked.',
      'Use the testing and photography queues for specialist work, then use Listings once the item reaches listing review.',
    ],
    flowSummary: 'Your role spans intake and handoff, so the most relevant map is the path from qualification through listing readiness.',
    flowSteps: [
      {
        title: 'Review new intake in Parking Lot 1',
        detail: 'Each row either qualifies into the normal workflow or gets routed out with a clear reason.',
      },
      {
        title: 'Turn accepted items into owned workflow',
        detail: 'Once a row is accepted, use the workflow hub to track stage status, next team, operational notes, and later post-publish follow-through. It is not the listing review page.',
      },
      {
        title: 'Move work through testing and photography',
        detail: 'Use the stage queues and record-specific forms to finish specialist work instead of keeping status in scattered notes.',
      },
      {
        title: 'Clear listing review before publish',
        detail: 'Pricing, description, and signoffs should be in place before the item leaves workflow for live channel publish.',
      },
    ],
    questions: [
      {
        question: 'Where should I start if I am working intake?',
        answer: 'Start in Parking Lot 1. That is the front door for new used-gear rows and the place where items are accepted or rejected.',
      },
      {
        question: 'Where do I go when a queue card feels too light?',
        answer: 'Open the operational record for that stage. Queue cards stay simple on purpose, while the stage-specific pages and Listings hold fuller routing, notes, and follow-through controls.',
      },
    ],
  },
  tester: {
    quickStartTitle: 'Tester quick start',
    quickStartSummary: 'Your lane is narrow on purpose: pick up ready items, capture hands-on findings, and sign off or flag blockers.',
    quickStartItems: [
      'Start in the testing queue to see what is ready for hands-on work.',
      'Open the testing form to capture working condition, issues, and signoff notes.',
      'If something blocks the next step, leave a clear note so workflow can route it correctly.',
    ],
    flowSummary: 'You do not need the full commerce map every day. The relevant part is where an item enters testing, gets documented, and returns to workflow.',
    flowSteps: [
      {
        title: 'Watch the testing queue',
        detail: 'This is the handoff point for items that are ready for hands-on verification.',
      },
      {
        title: 'Capture findings in the testing form',
        detail: 'Record the practical condition and operational notes where the rest of the team can reliably use them.',
      },
      {
        title: 'Sign off or flag a blocker',
        detail: 'Complete the stage when testing is done, or leave a note that makes the next decision obvious.',
      },
      {
        title: 'Return the item to the workflow path',
        detail: 'After testing, the item either continues toward photos and listing or circles back for correction.',
      },
    ],
    questions: [
      {
        question: 'Where should I start each day?',
        answer: 'Start in the testing queue. It is the shortest list of what is actually ready for your hands-on work.',
      },
      {
        question: 'What page should hold my real work notes?',
        answer: 'Use the testing form for the actual findings. The queue should stay focused on triage and status.',
      },
    ],
  },
  photographer: {
    quickStartTitle: 'Photographer quick start',
    quickStartSummary: 'Your lane is the photography handoff: find ready items, complete image work, and hand the record back cleanly.',
    quickStartItems: [
      'Start in the photography queue to see what is ready for image work.',
      'Open the photos form when you are doing the actual image work and record handoff notes there.',
      'Use clear completion notes so the next listing step is not guessing about image readiness.',
    ],
    flowSummary: 'You only need the slice of the workflow that delivers items into photography and hands them onward after images are complete.',
    flowSteps: [
      {
        title: 'Watch the photography queue',
        detail: 'This is the queue for items that have reached the image stage and are ready for visual completion.',
      },
      {
        title: 'Complete work in the photos form',
        detail: 'Use the form for the actual photo task so the record keeps one clean source of truth for image readiness.',
      },
      {
        title: 'Leave the item ready for listing review',
        detail: 'A finished photo handoff should make it obvious whether the next stop is Listings review or a correction step.',
      },
      {
        title: 'Send blockers back with context',
        detail: 'If images cannot be completed cleanly, leave enough detail for workflow to decide the next move quickly.',
      },
    ],
    questions: [
      {
        question: 'Where do I find what is ready for photos?',
        answer: 'Start in the photography queue. That is the filtered list of items that have already reached your stage.',
      },
      {
        question: 'Should I keep photo notes in the queue?',
        answer: 'No. Use the photos form for the actual work details so the queue can stay focused on what is ready and what is done.',
      },
    ],
  },
  developer: {
    quickStartTitle: 'Developer quick start',
    quickStartSummary: 'This guide is your plain-language map while you work in source feeds, account tooling, and local validation.',
    quickStartItems: [
      'Use this page first when you need the operational context behind a route, field, or workflow label.',
      'Use JotForm, HiFi Shark, Image Lab, and workflow-related pages to trace where data enters the system and where it surfaces.',
      'Keep settings and notifications in view when you are testing role-specific behavior or account flows.',
    ],
    flowSummary: 'You mostly need the seams between tools, not every day-to-day operational step, so this version focuses on handoff boundaries.',
    flowSteps: [
      {
        title: 'Intake begins outside the main workflow pages',
        detail: 'JotForm and intake tooling create the front-door data that later becomes inventory and operational records.',
      },
      {
        title: 'Workflow pages carry the operational state',
        detail: 'Queues and operational pages are where stage, handoff, and next-step logic become visible in the app.',
      },
      {
        title: 'Listing surfaces represent publish-side state',
        detail: 'Commerce pages and channel views should only pick up items that workflow has already prepared.',
      },
      {
        title: 'Account tooling controls the experience around the work',
        detail: 'Settings, notifications, and user access shape who sees what and how the operation gets alerted.',
      },
    ],
    questions: [
      {
        question: 'What is the most useful page when a label is unclear?',
        answer: 'Use this guide first, then open the specific route that owns the label or state you are tracing.',
      },
      {
        question: 'Where should I verify role-specific behavior?',
        answer: 'Use the pages in your account list below. Those are the routes your current login can actually reach.',
      },
    ],
  },
};

export const WORKFLOW_FLOW_STAGES: WorkflowFlowStage[] = [
  {
    title: 'Intake Arrives',
    detail: 'New gear enters from intake sources and lands in the front-door review path.',
    pages: ['jotform', 'parking-lot-1'],
    tone: 'intake',
    primaryRoles: ['processor', 'admin', 'owner'],
    supportRoles: ['developer'],
  },
  {
    title: 'Qualify Or Trash',
    detail: 'Parking Lot 1 decides whether the item continues into workflow or moves to Trash Review with a reason.',
    pages: ['parking-lot-1', 'trash-review'],
    tone: 'decision',
    primaryRoles: ['processor', 'admin', 'owner'],
  },
  {
    title: 'Arrival And Routing',
    detail: 'Accepted items move through Parking Lot 2 and the workflow hub for arrival handling, operational notes, current-stage visibility, and next-stage routing.',
    pages: ['manual-intake', 'parking-lot-2', 'inventory'],
    tone: 'routing',
    primaryRoles: ['processor'],
    supportRoles: ['admin', 'owner'],
  },
  {
    title: 'Testing Handoff',
    detail: 'Testing takes the item from routed intake into hands-on verification and sends it forward with clear findings.',
    pages: ['testing-queue', 'testing'],
    tone: 'specialist',
    primaryRoles: ['tester'],
    supportRoles: ['processor', 'admin', 'owner', 'photographer'],
  },
  {
    title: 'Photography Handoff',
    detail: 'Photography takes tested items, completes image work, and returns them ready for listing review.',
    pages: ['photography-queue', 'photos'],
    tone: 'specialist',
    primaryRoles: ['photographer'],
    supportRoles: ['processor', 'admin', 'owner', 'tester'],
  },
  {
    title: 'Pre-List And Publish',
    detail: 'Listings now owns publish-readiness review before channel pages take the item live.',
    pages: ['listings', 'shopify', 'ebay'],
    tone: 'publish',
    primaryRoles: ['processor', 'admin', 'owner'],
    supportRoles: ['developer'],
  },
  {
    title: 'Post-Publish Follow-Through',
    detail: 'The workflow hub tracks stale listings, sold-ready work, and shipment completion after publish, while Listings stays focused on listing-phase review and publish decisions.',
    pages: ['inventory', 'dashboard'],
    tone: 'follow-through',
    primaryRoles: ['admin', 'owner'],
    supportRoles: ['processor'],
  },
];

export function getWorkflowFlowStagesForRole(role: UserRole): WorkflowFlowStage[] {
  if (role === 'tester' || role === 'photographer') {
    return WORKFLOW_FLOW_STAGES.filter((stage) => (
      stage.title === 'Arrival And Routing'
      || stage.title === 'Testing Handoff'
      || stage.title === 'Photography Handoff'
      || stage.title === 'Pre-List And Publish'
    ));
  }

  return WORKFLOW_FLOW_STAGES;
}

export function shouldShowWorkflowTrashPath(role: UserRole): boolean {
  return role !== 'tester' && role !== 'photographer';
}

const PAGE_GUIDE_CARDS: PageGuideCard[] = [
  {
    title: 'Dashboard',
    pages: ['dashboard'],
    items: [
      'Use it to spot backlog, handoff gaps, and high-level workflow pressure.',
      'Treat it as the summary view, not the place for deep record work.',
    ],
  },
  {
    title: 'Manual Intake',
    pages: ['manual-intake'],
    items: [
      'Start here when an operator already has enough detail to create the intake row without waiting for a JotForm submission or Parking Lot 1 review.',
      'Use the same form when an accepted arrival-stage row needs intake corrections instead of switching to a second edit surface.',
      'Manual Intake covers the off-JotForm lane: phone deals, return clients, and other accepted deals that were assembled outside the quote-request flow.',
      'StereoBuyers inventory usually starts either from the customer quote form or from Manual Intake. Use Manual Intake only for the second case.',
      'Choose the route inside the form based on where the item should land next: Parking Lot 1 for qualification, or one of the Parking Lot 2 buckets for accepted arrival-stage work.',
      'Keep entry standards clean and customer-facing: spelling, capitalization, model naming, component types, and seller-reported notes here often flow straight into later listing work.',
      'Use the customer cosmetic, functional, inclusion, and submitted-photo note fields to mirror the seller-provided intake context before staff-specific corrections are added later in workflow review.',
      'Submission Group ID and Pick Up ID are optional. Use them only when the manual row needs to stay tied to a larger deal, grouped submission, or shared pickup/arrival batch.',
      'Qualification Notes are required only when the row is being routed directly into a Parking Lot 2 bucket instead of going through Parking Lot 1 first.',
    ],
  },
  {
    title: 'Parking Lot 1',
    pages: ['parking-lot-1'],
    items: [
      'Review newly arrived intake rows.',
      'Accept qualified items into the workflow.',
      'Route unqualified items into trash review with a reason.',
    ],
  },
  {
    title: 'Parking Lot 2',
    pages: ['parking-lot-2'],
    items: [
      'Work accepted intake rows that still need arrival handling, SKU assignment, or missing-item follow-up.',
      'Use this page for the accepted arrival-stage buckets before the row reaches the broader workflow hub or specialist queues.',
      'Move each row forward into the current operational surface instead of leaving accepted work parked longer than necessary.',
    ],
  },
  {
    title: 'Trash Review',
    pages: ['trash-review'],
    items: [
      'Review unqualified rows in active trash and make the recovery decision.',
      'Use it to restore, re-qualify back into the workflow, or permanently remove rows that should not continue.',
      'Treat this as the exception lane after Parking Lot 1 decides the item does not currently qualify.',
    ],
  },
  {
    title: 'Workflow Hub',
    pages: ['inventory'],
    items: [
      'See pending review, active stage handoffs, and post-publish work in one place.',
      'Pending Review is where new intake rows are reviewed and moved into the next real step.',
      'The processing and holding queue stays focused on accepted rows that still belong to arrival handling, processing, or the shared testing-and-photography holding stage. Listings takes over once both signoffs are complete.',
      'Post-Publish tracks listing follow-up by bucket so you can open the operational record for per-row lifecycle actions.',
      'Use the main queue view for triage, routing, quick actions, and workflow status checks.',
      'Open an operational record when a row needs deeper work.',
    ],
  },
  {
    title: 'Testing Queue And Record',
    pages: ['testing-queue', 'testing'],
    items: [
      'The queue is the shared post-intake holding stage for hands-on bench verification, not a listing-review destination.',
      'Use the queue to triage, filter, sort, and share one exact workset through URL-backed state instead of handing off a vague list.',
      'The record-specific form is where the actual hands-on findings and testing signoff belong.',
      'A row should reach Listings only after both testing and photography signoffs are complete.',
    ],
  },
  {
    title: 'Photography Queue And Record',
    pages: ['photography-queue', 'photos'],
    items: [
      'The queue is the shared post-intake holding stage for photography work, not an early listing-prep page.',
      'Use the queue to keep grouped submissions together, confirm which rows still need image work, and hand off a specific filtered workset through the URL.',
      'The record-specific form is where image work and handoff notes should be completed.',
      'Carry forward testing notes, included-item context, and submission-level handoff detail while planning shoots.',
    ],
  },
  {
    title: 'Listings Review And Channel Views',
    pages: ['listings', 'shopify', 'ebay'],
    items: [
      'Listings is the checkpoint for final pricing, notes, and approve-for-publish work.',
      'Channel pages focus on representation and status after the operational row is publish-ready.',
      'Channel pages are for representation and status, not intake or stage routing.',
    ],
  },
  {
    title: 'Support And Admin Tools',
    pages: ['jotform', 'market', 'users', 'imagelab', 'settings', 'notifications'],
    items: [
      'These pages support intake sources, exceptions, account management, and supporting utilities. HiFi Shark is limited to owners, developers, and processors, while Image Lab is open to every non-tester role.',
      'Use them when the main queue pages do not match the job you are actually trying to do.',
    ],
  },
];

export function getVisiblePageLabels(accessiblePages: AppPage[]): string[] {
  return accessiblePages
    .filter((page) => page !== 'workflow-guide')
    .map((page) => PAGE_DEFINITIONS[page]?.label)
    .filter((label): label is string => Boolean(label));
}

export function getVisiblePageCards(accessiblePages: AppPage[]): PageGuideCard[] {
  const accessiblePageSet = new Set(accessiblePages);
  return PAGE_GUIDE_CARDS.filter((card) => card.pages.some((page) => accessiblePageSet.has(page)));
}