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
  roleSummary: string;
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
  summary: string;
  modules: string[];
  workflows: string[];
}

export interface RecordGuideCard {
  title: string;
  pages: AppPage[];
  summary: string;
  surfaces: string[];
  workflows: string[];
}

export interface WorkflowFlowStage {
  title: string;
  detail: string;
  pages: AppPage[];
  tone: 'intake' | 'decision' | 'routing' | 'specialist' | 'publish' | 'follow-through';
  primaryRoles: UserRole[];
  supportRoles?: UserRole[];
}

export interface RoleStartPoint {
  page: AppPage;
  title: string;
  detail: string;
}

export interface WorkflowGuideContent {
  roleGuides: Record<UserRole, RoleGuide>;
  advancementRules: GuideStep[];
  flowStages: WorkflowFlowStage[];
  pageCards: PageGuideCard[];
  recordCards: RecordGuideCard[];
  roleStartPoints: Record<UserRole, RoleStartPoint[]>;
}

export const WORKFLOW_ADVANCEMENT_RULES: GuideStep[] = [
  {
    title: 'Parking Lot intake workflow',
    detail: 'A new intake should only leave Parking Lot after it has a clear qualification decision and qualification notes. Accepted rows stay in Parking Lot for arrival-stage handling; rejected rows move into Trash Review.',
  },
  {
    title: 'Parking Lot to specialist work',
    detail: 'Accepted rows should only move past Parking Lot once the arrival-stage handoff is complete for the current situation: arrival captured, SKU assigned when needed, and missing-item issues resolved before downstream work starts. When those handoff details are already known during intake review, the record page can save them and move the row directly into Testing.',
  },
  {
    title: 'Testing, then Photography, then Listings',
    detail: 'A row reaches Listings only after testing is complete first and photography is complete second. Each specialist handoff should leave enough notes and completion detail that the next team does not have to guess why the row is ready.',
  },
  {
    title: 'Listings to live listing status',
    detail: 'A row should only move from Awaiting Pre-Listing Review to Approved for Publish when listing review is complete and title, price, description, and required signoffs are in place. It should only move into listed statuses after the publish action is completed.',
  },
  {
    title: 'Live listings to follow-through',
    detail: 'Once a row is already listed, Post-Publish owns active follow-through and Archive owns shipped lookup, while Listings stays as record context only. Workflow Status stays unchanged through Shipped, and post-sale outcomes stay in the approved post-sale fields instead of becoming new workflow statuses.',
  },
];

export function roleLabel(role: UserRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export const ROLE_GUIDES: Record<UserRole, RoleGuide> = {
  admin: {
    roleSummary: 'Use this page as the short version of how intake, workflow, listing, and shipping fit together across the app.',
    quickStartTitle: 'Admin quick start',
    quickStartSummary: 'Keep the whole operation moving, then drop into the exact queue or record that needs intervention.',
    quickStartItems: [
      'Start on the dashboard to spot backlog, handoff gaps, and publish blockers.',
      'Use Parking Lot for intake decisions, the Workflow Hub for directory lookup and workflow snapshots, Post-Publish for active live-listing and post-sale follow-through, and Archive for shipped lookup.',
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
        detail: 'Parking Lot handles intake decisions, while the Workflow Hub helps you look up accepted rows, confirm current workflow state, and open the real working page that owns the blocker.',
      },
      {
        title: 'Confirm publish readiness before release',
        detail: 'Listings surfaces should only move forward when pricing, notes, and signoffs are in place.',
      },
      {
        title: 'Close the loop after publish',
        detail: 'Use Post-Publish for active stale, sold-ready, shipment, and post-sale exception work, then use Archive for shipped lookup while Listings remains the record-context surface.',
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
    roleSummary: 'Use this page as the short version of how intake, workflow, listing, and shipping fit together across the app.',
    quickStartTitle: 'Owner quick start',
    quickStartSummary: 'Use the same operational map as admin, with focus on throughput, accountability, and exceptions.',
    quickStartItems: [
      'Start on the dashboard to see how work is distributed and where the team needs attention.',
      'Use workflow and queue pages to remove blockers before they delay listings, stale follow-up, or shipping.',
      'Review user access, notifications, and channel surfaces when process or oversight changes are needed.',
    ],
    flowSummary: 'This view keeps the full operation visible while still emphasizing the checkpoints that need owner attention.',
    flowSteps: [
      {
        title: 'Track the front door',
        detail: 'Parking Lot shows what is new, what still needs qualification, and what should not continue.',
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
        detail: 'Post-Publish and Archive matter because sold items still need clean stale follow-up, shipment completion, post-sale exception handling, and shipped reference.',
      },
    ],
    questions: [
      {
        question: 'Where do I spot process gaps fastest?',
        answer: 'Start on the dashboard, then open the queue with the oldest backlog or the record with the clearest blocker.',
      },
      {
        question: 'What is the shortest path to understanding a problem item?',
        answer: 'Open the operational record for the current stage. Listings carries listing-phase context, while Post-Publish and Archive own active post-sale follow-through and shipped lookup.',
      },
    ],
  },
  processor: {
    roleSummary: 'Start with Parking Lot, the intake directories, the Workflow Hub, and the specialist queues. Use Post-Publish once a live listing needs stale, sold-ready, shipment, or post-sale follow-through, and use Archive for shipped lookup.',
    quickStartTitle: 'Processor quick start',
    quickStartSummary: 'This is the operational lane for intake, handoff, and getting an item ready for the next specialist.',
    quickStartItems: [
      'Start in Parking Lot for fresh intake, use Manual Intake and JotForm for editable intake directories, use JotForm Audit when you need raw submission context, use the Workflow Hub for accepted-row lookup and workflow snapshots, open Post-Publish for active live-listing and post-sale follow-through, or use Archive for shipped lookup.',
      'Clean up notes, confirm the next stage, and move the item into the next real handoff instead of leaving it parked.',
      'Use the testing and photography queues for specialist work, then use Listings once the item reaches listing review.',
    ],
    flowSummary: 'Your role spans intake and handoff, so the most relevant map is the path from qualification through listing readiness.',
    flowSteps: [
      {
        title: 'Review new intake in Parking Lot',
        detail: 'Each row either qualifies into the normal workflow or gets routed out with a clear reason.',
      },
      {
        title: 'Turn accepted items into owned workflow',
        detail: 'Once a row is accepted, use JotForm when you need to edit the webhooked intake row, use JotForm Audit when you need to verify the original submission details, then use the Workflow Hub to confirm stage status and open the exact page that owns the next step. Use Post-Publish later for active live-listing and post-sale follow-through; neither page is the listing review page.',
      },
      {
        title: 'Move work through testing and photography',
        detail: 'Use the stage queues and record-specific forms to move items through testing first and photography second instead of keeping status in scattered notes.',
      },
      {
        title: 'Clear listing review before publish',
        detail: 'Pricing, description, and signoffs should be in place before the item leaves workflow for live channel publish.',
      },
    ],
    questions: [
      {
        question: 'Where should I start if I am working intake?',
        answer: 'Start in Parking Lot. That is the front door for new used-gear rows and the place where items are accepted or rejected.',
      },
      {
        question: 'Where do I go when a queue card feels too light?',
        answer: 'Open the operational record for that stage. Queue cards stay simple on purpose, while the stage-specific pages and Listings hold fuller routing, notes, and follow-through controls.',
      },
    ],
  },
  tester: {
    roleSummary: 'Your day usually starts in the testing queue, then moves into the record-specific testing form when a row needs hands-on notes.',
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
        detail: 'After testing, the item moves forward to photography or circles back for correction with clear notes.',
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
    roleSummary: 'Your day usually starts in the photography queue, then moves into the record-specific photos form when a row is ready for images and handoff.',
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
    roleSummary: 'Use this page as a plain-language map of the operation while you work in the supporting tools and source feeds.',
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
    pages: ['manual-intake', 'create-intake-item', 'jotform', 'jotform-audit', 'parking-lot'],
    tone: 'intake',
    primaryRoles: ['processor', 'admin', 'owner'],
    supportRoles: ['developer'],
  },
  {
    title: 'Qualify Or Trash',
    detail: 'Parking Lot decides whether the item continues into workflow or moves to Trash Review with a reason.',
    pages: ['parking-lot', 'trash-review'],
    tone: 'decision',
    primaryRoles: ['processor', 'admin', 'owner'],
  },
  {
    title: 'Arrival And Routing',
    detail: 'Accepted items stay inside Parking Lot for arrival handling and then move into the specialist queues, while the Workflow Hub stays focused on record lookup and workflow snapshots.',
    pages: ['manual-intake', 'parking-lot', 'inventory'],
    tone: 'routing',
    primaryRoles: ['processor'],
    supportRoles: ['admin', 'owner'],
  },
  {
    title: 'Testing Handoff',
    detail: 'Testing takes the item from routed intake into hands-on verification and sends it forward to photography with clear findings.',
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
    pages: ['listings'],
    tone: 'publish',
    primaryRoles: ['processor', 'admin', 'owner'],
    supportRoles: ['developer'],
  },
  {
    title: 'Post-Publish Follow-Through',
    detail: 'Post-Publish handles active stale listings, sold-ready work, shipment completion, and post-sale exception handling after publish, while Archive holds shipped lookup and Listings stays focused on listing-phase review and record context.',
    pages: ['post-publish', 'archive', 'listings', 'dashboard'],
    tone: 'follow-through',
    primaryRoles: ['admin', 'owner'],
    supportRoles: ['processor'],
  },
];

export function roleSummary(role: UserRole, roleGuides: Record<UserRole, RoleGuide> = ROLE_GUIDES): string {
  return roleGuides[role]?.roleSummary ?? ROLE_GUIDES[role].roleSummary;
}

export function getWorkflowFlowStagesForRole(role: UserRole, flowStages: WorkflowFlowStage[] = WORKFLOW_FLOW_STAGES): WorkflowFlowStage[] {
  if (role === 'tester' || role === 'photographer') {
    return flowStages.filter((stage) => (
      stage.title === 'Arrival And Routing'
      || stage.title === 'Testing Handoff'
      || stage.title === 'Photography Handoff'
      || stage.title === 'Pre-List And Publish'
    ));
  }

  return flowStages;
}

export function shouldShowWorkflowTrashPath(role: UserRole): boolean {
  return role !== 'tester' && role !== 'photographer';
}

const PAGE_GUIDE_CARDS: PageGuideCard[] = [
  {
    title: 'Dashboard',
    pages: ['dashboard'],
    summary: 'Use Dashboard as the summary and routing surface when you need to see pressure points across intake, workflow, listings, and follow-through.',
    modules: [
      'Overview: high-level workflow and commerce KPIs.',
      'Actions: role-aware shortcuts into the exact queue, bucket, or handoff that needs work.',
      'Insights: alert-style prompts that explain backlog, stale follow-up, and publish blockers.',
      'Workflow snapshot reporting: post-sale exception counts, refund exposure, and disposition gaps derived from the approved workflow row without creating a separate post-sale workflow.',
    ],
    workflows: [
      'Start here when you do not yet know which queue owns the problem.',
      'Use the dashboard to jump into Parking Lot, Workflow Hub, Listings, or Post-Publish rather than working records directly here.',
      'Use dashboard post-sale reporting for visibility only; Post-Publish and Archive remain the operational surfaces for follow-through and shipped lookup.',
    ],
  },
  {
    title: 'JotForm',
    pages: ['jotform', 'jotform-audit'],
    summary: 'Use JotForm as the editable directory for webhooked intake rows, and use JotForm Audit as the raw source-feed reference page for incoming submissions.',
    modules: [
      'JotForm directory: searchable list of webhooked intake rows that are still in intake-stage Parking Lot statuses and do not have a SKU yet.',
      'JotForm Audit: read-only submission feed with raw seller answers and source timestamps.',
    ],
    workflows: [
      'Use JotForm to open the editable intake record that came from a webhooked submission.',
      'Use JotForm Audit to verify raw source intake data before or during Parking Lot review.',
    ],
  },
  {
    title: 'Manual Intake',
    pages: ['manual-intake', 'create-intake-item'],
    summary: 'Use Manual Intake as the directory for staff-created intake rows, and use Create Intake Item when staff needs to create a new row inside the app.',
    modules: [
      'Manual intake directory: searchable list of staff-created intake rows that are still in intake-stage Parking Lot statuses and do not have a SKU yet, with short-id item labels and direct access into the intake editor.',
      'Create Intake Item: staff-facing intake form for seller reference, condition context, grouping IDs, and route selection.',
    ],
    workflows: [
      'Use it for phone deals, repeat-customer intake, or accepted arrivals that were assembled outside the quote-request flow.',
      'Keep naming, customer-facing notes, and grouping IDs clean here because they flow into downstream workflow and listing work.',
    ],
  },
  {
    title: 'Parking Lot',
    pages: ['parking-lot'],
    summary: 'Parking Lot is the single intake page for new used-gear review and accepted arrival-stage handling.',
    modules: [
      'Parking Lot queue: review Pending Review, Awaiting Arrival, Awaiting SKU, and Awaiting Missing Item rows in one place.',
      'Grouped review flow: shared submission handling for multi-item intake.',
      'Selected record and group pages: deeper review for grouped intake decisions and accepted arrival-stage handoff work.',
    ],
    workflows: [
      'Start here when a new intake row still needs qualification review.',
      'Accept qualified rows into arrival-stage statuses inside Parking Lot or route unqualified rows into Trash Review with a reason.',
    ],
  },
  {
    title: 'Arrival-stage work inside Parking Lot',
    pages: ['parking-lot'],
    summary: 'Accepted arrival-stage rows stay inside Parking Lot until intake handoff is complete.',
    modules: [
      'Arrival-stage review pages: accepted rows, missing item follow-up, and grouped arrivals.',
      'Group handoff page: coordinated review for one pickup or submission set.',
      'Record actions: open Intake or the current operational record.',
    ],
    workflows: [
      'Use these review pages for arrival handling, SKU assignment, grouped handoff work, and missing-item follow-up.',
      'Move rows forward into Manual Intake, Workflow Hub, or specialist work instead of leaving accepted items parked in Parking Lot.',
    ],
  },
  {
    title: 'Trash Review',
    pages: ['trash-review'],
    summary: 'Trash Review is the exception lane for rows that were rejected during intake review.',
    modules: [
      'Trash queue: active rejected rows waiting for recovery or removal.',
      'Trash record page: restore, re-qualify, or permanently delete one row with context.',
    ],
    workflows: [
      'Use it when a previously rejected row needs audit, recovery, or final deletion.',
      'Restore rows back to pending review or re-qualify them into the accepted workflow when appropriate.',
    ],
  },
  {
    title: 'Workflow Hub',
    pages: ['inventory'],
    summary: 'Workflow Hub is the accepted-workflow directory and snapshot surface for operational rows that are still active.',
    modules: [
      'Record directory: searchable operational rows with status filtering.',
      'Workflow snapshot links: open the read-only workflow overview for one row.',
      'Directory actions: jump into the relevant record surface from the selected workflow row.',
    ],
    workflows: [
      'Use it to look up accepted workflow rows, confirm current state, and open the right downstream working surface.',
      'Use Post-Publish instead of the Workflow Hub when the work is already in live listing follow-through.',
    ],
  },
  {
    title: 'Testing Queue',
    pages: ['testing-queue'],
    summary: 'Testing Queue is the specialist discovery page for rows that are ready for hands-on bench verification.',
    modules: [
      'Testing queue list: triage, filter, sort, and share one exact workset.',
      'Queue actions: open the Testing form or current operational record.',
    ],
    workflows: [
      'Start here to find what is actually ready for testing work.',
      'Use the queue for triage only; move into the Testing form for the real work details and signoff.',
    ],
  },
  {
    title: 'Testing',
    pages: ['testing'],
    summary: 'Testing is the record-specific form where hands-on findings and testing signoff are captured.',
    modules: [
      'Testing form fields: working condition, issue notes, and signoff state.',
      'Record-level workflow context: enough detail to understand the item while completing testing work.',
    ],
    workflows: [
      'Use it when you are doing the actual testing work on one row.',
      'Finish the testing signoff here so workflow can route the row onward with clean notes.',
    ],
  },
  {
    title: 'Photography Queue',
    pages: ['photography-queue'],
    summary: 'Photography Queue is the specialist discovery page for rows that are ready for image work.',
    modules: [
      'Photography queue list: grouped submissions, image-ready rows, and filterable worksets.',
      'Queue actions: open the Photos form or operational context when needed.',
    ],
    workflows: [
      'Start here to see which rows are ready for photography.',
      'Use the queue for work discovery and handoff, then use the Photos form for the actual image task and notes.',
    ],
  },
  {
    title: 'Photos',
    pages: ['photos'],
    summary: 'Photos is the record-specific form where image work, readiness notes, and handoff details are completed.',
    modules: [
      'Photos form fields: photo completion state, notes, and related listing-facing image context.',
      'Record-level handoff context: testing notes, grouped submission context, and readiness cues.',
    ],
    workflows: [
      'Use it when you are doing the actual image work on one row.',
      'Finish the photography signoff here so the item can move cleanly into Listings review.',
    ],
  },
  {
    title: 'Listings',
    pages: ['listings'],
    summary: 'Listings is the final review and publish-readiness workspace for combined listing records.',
    modules: [
      'Combined listings queue: ready-for-publishing, active-listings, and needs-further-work sections with shared search and filters.',
      'Selected record page: shared, Shopify, and eBay sections with workflow summary, actions, and payload visibility.',
      'Record detail workflow shell: final approve-for-publish work and listing-phase context once the item reaches Listings ownership.',
    ],
    workflows: [
      'Use it for Awaiting Pre-Listing Review and Approved for Publish rows, and for quick verification of already-listed rows before handing active follow-through to Post-Publish. Listing review starts here, and sold-ready, shipped, and post-sale handling should stay out of Listings.',
      'Confirm title, price, notes, signoffs, and publish decisions here before any channel-facing action. After publish, treat this page as record context, not the owning post-sale workflow surface.',
    ],
  },
  {
    title: 'Post-Publish',
    pages: ['post-publish'],
    summary: 'Post-Publish is the dedicated lifecycle and active post-sale follow-through page for live listings after publish.',
    modules: [
      'Overview and bucket sections: Active Listings, Stale Listings, and Sold Ready To Ship.',
      'Shared search and sort toolbar: filter one lifecycle workset instead of scanning the full history.',
      'Per-row actions: mark stale, mark sold ready, mark shipped, and open the listing or operational record for the approved post-sale fields.',
    ],
    workflows: [
      'Use it once the item is live and the work is now stale follow-up, payment-to-shipping handoff, shipment completion, or post-sale exception handling such as Cancelled, Refunded, Returned, or Partial Refund.',
      'Treat it as the active ownership page for listing lifecycle follow-through. Record post-sale outcome, refund or partial-refund, return, dispute notes, and restock-disposition work on the same authoritative row, and do not auto-relist returned or refunded items.',
    ],
  },
  {
    title: 'Archive',
    pages: ['archive'],
    summary: 'Archive is the shipped lookup and completed post-sale reference page for used-gear workflow rows.',
    modules: [
      'Shipped section: completed shipments retained for lookup after fulfillment is done.',
      'Shared search and sort toolbar: quickly find completed shipped items by SKU, model, status, or lifecycle dates.',
    ],
    workflows: [
      'Use it after shipment completion when the work is done and the team needs referenceable history instead of an active queue.',
      'Keep Post-Publish focused on active follow-through and use Archive for completed shipped outcomes, returned-item lookup, and manual restock-disposition reference.',
    ],
  },
  {
    title: 'Shopify Products',
    pages: ['shopify'],
    summary: 'Shopify Products is the read-only store-side snapshot page for Shopify product visibility.',
    modules: [
      'Service summary panel: store domain plus active, draft, and archived counts.',
      'Snapshot directory and record pages: open read-only Shopify product snapshots for inspection.',
    ],
    workflows: [
      'Use it to verify Shopify-side state after listing work has already been prepared in Listings.',
      'Do not use this page for approvals, intake routing, or workflow decisions.',
    ],
  },
  {
    title: 'eBay',
    pages: ['ebay'],
    summary: 'eBay is the read-only channel snapshot page for inventory, offers, and connection visibility.',
    modules: [
      'Service summary panel: live offers, draft offers, tracked inventory, and connection or snapshot status.',
      'Inventory and offer directory: read-only eBay snapshot browsing.',
      'Snapshot record page: inventory item, offer, and recent listing detail for one SKU.',
    ],
    workflows: [
      'Use it to verify eBay-side visibility after Listings review has already prepared the row.',
      'Do not use this page for approvals, stage routing, or intake decisions.',
    ],
  },
  {
    title: 'Market Prices',
    pages: ['market'],
    summary: 'Market Prices is the research page for HiFiShark lookup and price context.',
    modules: [
      'Model slug search: direct HiFiShark lookup by slug.',
      'Market listings table: comparable listing source, country, price, and age.',
    ],
    workflows: [
      'Use it when pricing or market context is needed before or during Listings review.',
      'Treat it as research support, not as the authoritative workflow or listing record.',
    ],
  },
  {
    title: 'Image Lab',
    pages: ['imagelab'],
    summary: 'Image Lab is the image utility page for AI identification, processing, and upload prep.',
    modules: [
      'Options panel: processing settings and AI-provider context.',
      'Drop zone and bulk actions: stage image batches and run identify/process actions.',
      'Image cards: per-item results, copy actions, and upload actions.',
    ],
    workflows: [
      'Use it when the job is image processing or AI-assisted identification rather than queue workflow routing.',
      'Treat it as a utility page that supports listing assets, not as a workflow decision page.',
    ],
  },
  {
    title: 'User Management',
    pages: ['users'],
    summary: 'User Management is the admin page for account provisioning, role access, and workflow alert defaults.',
    modules: [
      'User Directory: search, filter, sort, and open user profiles.',
      'Create User: add a user with default page access and a temporary password.',
      'Role Alert Defaults: baseline workflow notification defaults by role.',
      'Selected user detail view: role, page access, password reset, and workflow notification settings for one user.',
    ],
    workflows: [
      'Use it when the work is account administration instead of operational workflow handling.',
      'Keep role access and workflow alert defaults aligned with how each team is expected to work.',
    ],
  },
  {
    title: 'Settings',
    pages: ['settings'],
    summary: 'Settings is the account self-service page for profile, password, preferences, runtime diagnostics, and session controls.',
    modules: [
      'Profile: email and account identity.',
      'Password: sign-in credential changes.',
      'Notifications: user-level preference and workflow event toggles.',
      'Runtime: developer-facing runtime and local proxy diagnostics when available.',
      'Session: sign-out controls.',
    ],
    workflows: [
      'Use it when the current signed-in user needs account maintenance or preference changes.',
      'Treat it as self-service account control, not as a team-wide admin page.',
    ],
  },
  {
    title: 'Notifications',
    pages: ['notifications'],
    summary: 'Notifications is the personal notification inbox for workflow and system events.',
    modules: [
      'Search and filter toolbar: tone, seen status, and sort controls.',
      'Notification list: unread state, actions, and per-notification dismissal.',
      'Bulk actions: mark all seen and clear all notifications.',
    ],
    workflows: [
      'Use it to triage workflow alerts and recent system messages for the current login.',
      'Pair it with Settings or User Management when notification behavior itself needs to change.',
    ],
  },
];

const RECORD_GUIDE_CARDS: RecordGuideCard[] = [
  {
    title: 'Pending Review Record And Group Pages',
    pages: ['parking-lot'],
    summary: 'These pages are the deeper intake decision surfaces when the queue row alone is not enough, especially for grouped submissions.',
    surfaces: [
      'Selected record page: one intake row with qualification, routing, and next-step context.',
      'Group review page: shared submission review, submission group ID, and allocation decisions for multi-item intake.',
    ],
    workflows: [
      'Use them when a single queue row needs deeper qualification work or a grouped submission needs one coordinated decision.',
      'Finish the acceptance or trash decision here before the item stays in Parking Lot for arrival-stage handling or moves into Trash Review.',
    ],
  },
  {
    title: 'Parking Lot Group Handoff Page',
    pages: ['parking-lot'],
    summary: 'This page keeps one accepted pickup or submission set together during arrival-stage handoff work.',
    surfaces: [
      'Group handoff page: batch arrival-date and SKU review for the full set, plus direct actions into Manual Intake and the operational record for each row.',
    ],
    workflows: [
      'Use it when multiple accepted rows need coordinated arrival-stage work and the handoff fields can be updated together.',
      'Save the batch here, move every ready row into processing together, or route the full set into Trash Review when the whole handoff should stop.',
    ],
  },
  {
    title: 'Trash Record Page',
    pages: ['trash-review'],
    summary: 'The trash record page is the row-level audit and recovery surface for one rejected intake item.',
    surfaces: [
      'Trash record page: restore, re-qualify, or permanently delete with grouped context and workflow history visible.',
    ],
    workflows: [
      'Use it when a trash row needs more context than the queue shows before making the recovery decision.',
      'Make the final restore, re-qualify, or permanent delete action here.',
    ],
  },
  {
    title: 'Manual Intake Record Work',
    pages: ['manual-intake'],
    summary: 'Manual Intake also acts as the row-level edit surface when accepted arrival-stage items need intake-side corrections.',
    surfaces: [
      'Manual intake editor: row-level intake corrections, route changes, and grouped context updates.',
    ],
    workflows: [
      'Use it when the accepted row needs intake-detail correction rather than a new queue-level decision.',
      'Keep intake-side notes and route selections aligned before the row continues downstream.',
    ],
  },
  {
    title: 'Workflow Snapshot And Record Pages',
    pages: ['inventory'],
    summary: 'These are the deeper workflow surfaces linked from the Workflow Hub directory and snapshot views when a row needs more than lookup context.',
    surfaces: [
      'Workflow snapshot page: read-only timeline and linked workflow context for one row.',
      'Workflow record pages: row-level workflow fields, readiness context, and targeted pricing edits when needed.',
    ],
    workflows: [
      'Open these when the Workflow Hub directory shows that a row needs either a read-only workflow overview or a deeper workflow correction.',
      'Use them for operational fixes, not for final listing approval decisions.',
    ],
  },
  {
    title: 'Testing Record Page',
    pages: ['testing'],
    summary: 'This page is the single-row working surface for hands-on testing and signoff.',
    surfaces: [
      'Testing form page: condition findings, issue notes, and testing completion state.',
    ],
    workflows: [
      'Use it for the actual work on one testing row after the queue tells you what is ready.',
      'Leave enough clear detail here for the next team to understand the outcome without reopening bench work.',
    ],
  },
  {
    title: 'Photos Record Page',
    pages: ['photos'],
    summary: 'This page is the single-row working surface for photography completion and image-related handoff notes.',
    surfaces: [
      'Photos form page: image completion state, related notes, and listing-facing image context.',
    ],
    workflows: [
      'Use it for the actual image work on one row after the queue tells you what is ready.',
      'Finish photography here so Listings receives a clean handoff.',
    ],
  },
  {
    title: 'Listings Record Page',
    pages: ['listings'],
    summary: 'The Listings record page is now the main detailed review surface for one combined listing row.',
    surfaces: [
      'Workflow summary and blocker state.',
      'Shared, Shopify, and eBay section editors with section nav.',
      'Record actions and payload previews where applicable.',
    ],
    workflows: [
      'Use it when one listing row needs final readiness work, approve-for-publish action, or listing-phase audit context.',
      'Treat it as the detailed home for listing review once the item reaches Listings ownership, but use Post-Publish and Archive for active post-sale workflow and shipped lookup.',
    ],
  },
  {
    title: 'Shopify Snapshot Record Page',
    pages: ['shopify'],
    summary: 'The Shopify snapshot record page is the row-level read-only reference view for one store product snapshot.',
    surfaces: [
      'Workflow match summary.',
      'Shopify product details, HTML preview, and raw JSON preview.',
    ],
    workflows: [
      'Use it to inspect how a published or draft Shopify product currently looks in the store-side snapshot.',
      'Do not use it for approvals or routing; go back to Listings for that work.',
    ],
  },
  {
    title: 'eBay Snapshot Record Page',
    pages: ['ebay'],
    summary: 'The eBay snapshot record page is the row-level read-only reference view for one inventory item and offer snapshot.',
    surfaces: [
      'Workflow match summary.',
      'Offer setup, inventory details, HTML preview, and raw JSON preview.',
    ],
    workflows: [
      'Use it to inspect how a live or draft eBay listing currently looks in the snapshot data.',
      'Do not use it for approvals or routing; go back to Listings for publish decisions.',
    ],
  },
];

const ROLE_START_POINTS: Record<UserRole, RoleStartPoint[]> = {
  admin: [
    { page: 'dashboard', title: 'Check overall pressure first', detail: 'Open Dashboard when you need to spot the queue, stage, or publish issue that deserves attention first.' },
    { page: 'parking-lot', title: 'Start intake cleanup here', detail: 'Open Parking Lot when the front door is backing up or new submissions need qualification decisions.' },
    { page: 'listings', title: 'Open final review here', detail: 'Open Listings when the work is publish readiness, channel prep, or listing-phase blockers.' },
  ],
  owner: [
    { page: 'dashboard', title: 'Start with the operation view', detail: 'Open Dashboard to see where throughput, aging work, or follow-through needs intervention.' },
    { page: 'post-publish', title: 'Check live listing follow-through', detail: 'Open Post-Publish when the question is stale listings, sold-ready handoff, shipment completion, or active post-sale exception handling.' },
    { page: 'listings', title: 'Review publish readiness here', detail: 'Open Listings when an item is nearing release or channel detail needs review.' },
  ],
  processor: [
    { page: 'parking-lot', title: 'Start fresh intake here', detail: 'Open Parking Lot first when you are qualifying new used-gear intake.' },
    { page: 'inventory', title: 'Look up accepted work here', detail: 'Open Workflow Hub when the item is accepted and you need its current workflow snapshot or the next owning page.' },
    { page: 'post-publish', title: 'Work live follow-through here', detail: 'Open Post-Publish once the item is already live and now needs stale, sold-ready, shipping, or active post-sale follow-through.' },
  ],
  tester: [
    { page: 'testing-queue', title: 'Start ready work here', detail: 'Open Testing Queue to find the rows that are actually ready for hands-on bench work.' },
    { page: 'testing', title: 'Do the hands-on work here', detail: 'Open the Testing page when you are completing findings, issue notes, and signoff on one row.' },
  ],
  photographer: [
    { page: 'photography-queue', title: 'Start image work here', detail: 'Open Photography Queue to find the rows that are ready for image work.' },
    { page: 'photos', title: 'Finish the image handoff here', detail: 'Open the Photos page when you are doing the actual image work and completion notes.' },
  ],
  developer: [
    { page: 'dashboard', title: 'Start with the app map', detail: 'Open Dashboard when you need the fastest read on which operational surface or backlog is relevant to the code you are changing.' },
    { page: 'workflow-guide', title: 'Use the guide as glossary', detail: 'Open User Guide when you need plain-language workflow context for a label, route, or role-specific behavior.' },
    { page: 'market', title: 'Use research support here', detail: 'Open Market Prices when you are tracing pricing support or external market context behavior.' },
  ],
};

export function getVisiblePageLabels(accessiblePages: AppPage[]): string[] {
  return accessiblePages
    .filter((page) => page !== 'workflow-guide')
    .map((page) => PAGE_DEFINITIONS[page]?.label)
    .filter((label): label is string => Boolean(label));
}

export function getVisiblePageCards(accessiblePages: AppPage[], pageCards: PageGuideCard[] = PAGE_GUIDE_CARDS): PageGuideCard[] {
  const accessiblePageSet = new Set(accessiblePages);
  return pageCards.filter((card) => card.pages.some((page) => accessiblePageSet.has(page)));
}

export function getVisibleRecordCards(accessiblePages: AppPage[], recordCards: RecordGuideCard[] = RECORD_GUIDE_CARDS): RecordGuideCard[] {
  const accessiblePageSet = new Set(accessiblePages);
  return recordCards.filter((card) => card.pages.some((page) => accessiblePageSet.has(page)));
}

export function getRoleStartPoints(
  role: UserRole,
  accessiblePages: AppPage[],
  roleStartPoints: Record<UserRole, RoleStartPoint[]> = ROLE_START_POINTS,
): RoleStartPoint[] {
  const accessiblePageSet = new Set(accessiblePages);
  const matchingStarts = roleStartPoints[role].filter((item) => accessiblePageSet.has(item.page));

  if (matchingStarts.length > 0) {
    return matchingStarts;
  }

  return accessiblePages
    .filter((page) => page !== 'workflow-guide')
    .slice(0, 3)
    .map((page) => ({
      page,
      title: `Open ${PAGE_DEFINITIONS[page]?.label ?? page} first`,
      detail: 'This is one of the pages currently available to this login and is the safest starting point when role-specific shortcuts are not available.',
    }));
}

export const DEFAULT_WORKFLOW_GUIDE_CONTENT: WorkflowGuideContent = {
  roleGuides: ROLE_GUIDES,
  advancementRules: WORKFLOW_ADVANCEMENT_RULES,
  flowStages: WORKFLOW_FLOW_STAGES,
  pageCards: PAGE_GUIDE_CARDS,
  recordCards: RECORD_GUIDE_CARDS,
  roleStartPoints: ROLE_START_POINTS,
};