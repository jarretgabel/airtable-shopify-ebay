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

export function roleSummary(role: UserRole): string {
  if (role === 'processor') {
    return 'Start with Parking Lot 1, the Workflow Hub, and the specialist queues. Use Post-Publish once a live listing needs stale, sold-ready, or shipment follow-through.';
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
      'Use Parking Lot 1, the Workflow Hub, and Post-Publish to resolve stalled intake, routing, or live-listing follow-through issues.',
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
        detail: 'Parking Lot 1 and the Workflow Hub are where missing notes, routing problems, and active-stage blockers get cleaned up before listing work can move again.',
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
      'Use workflow and queue pages to remove blockers before they delay listings, stale follow-up, or shipping.',
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
        detail: 'Post-Publish and listing record detail pages matter because sold items still need clean stale follow-up, shipment completion, and history.',
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
      'Start in Parking Lot 1 for fresh intake, the Workflow Hub for active operational items, or Post-Publish for live listing follow-through.',
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
        detail: 'Once a row is accepted, use the Workflow Hub to track stage status, next team, and operational notes. Use Post-Publish later for live listing follow-through; neither page is the listing review page.',
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
    detail: 'Accepted items move through Parking Lot 2 for arrival handling and then into the specialist queues, while the Workflow Hub stays focused on record lookup and workflow snapshots.',
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
    detail: 'Post-Publish handles stale listings, sold-ready work, and shipment completion after publish, while Listings stays focused on listing-phase review and publish decisions.',
    pages: ['post-publish', 'listings', 'dashboard'],
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
    summary: 'Use Dashboard as the summary and routing surface when you need to see pressure points across intake, workflow, listings, and follow-through.',
    modules: [
      'Overview: high-level workflow and commerce KPIs.',
      'Actions: role-aware shortcuts into the exact queue, bucket, or handoff that needs work.',
      'Insights: alert-style prompts that explain backlog, stale follow-up, and publish blockers.',
    ],
    workflows: [
      'Start here when you do not yet know which queue owns the problem.',
      'Use the dashboard to jump into Parking Lot 1, Workflow Hub, Listings, or Post-Publish rather than working records directly here.',
    ],
  },
  {
    title: 'JotForm',
    pages: ['jotform'],
    summary: 'Use JotForm as the raw source-feed reference page for incoming quote and intake submissions.',
    modules: [
      'Live submission feed: read-only list of active submissions.',
      'Expanded submission detail: raw seller answers and source timestamps.',
    ],
    workflows: [
      'Use it to verify source intake data before or during Parking Lot 1 review.',
      'Treat it as reference only; do not use it as the operational decision surface.',
    ],
  },
  {
    title: 'Manual Intake',
    pages: ['manual-intake'],
    summary: 'Use Manual Intake when staff is creating a used-gear row inside the app instead of waiting for a JotForm submission.',
    modules: [
      'Manual intake form: seller reference, condition context, grouping IDs, and route selection.',
      'Route controls: send the row into Parking Lot 1 or directly into an accepted arrival-stage bucket when appropriate.',
    ],
    workflows: [
      'Use it for phone deals, repeat-customer intake, or accepted arrivals that were assembled outside the quote-request flow.',
      'Keep naming, customer-facing notes, and grouping IDs clean here because they flow into downstream workflow and listing work.',
    ],
  },
  {
    title: 'Parking Lot 1',
    pages: ['parking-lot-1'],
    summary: 'Parking Lot 1 is the front-door review page for new used-gear intake.',
    modules: [
      'Pending review queue: qualify, accept, or trash new rows.',
      'Grouped review flow: shared submission handling for multi-item intake.',
      'Selected record and group pages: deeper review for grouped intake decisions.',
    ],
    workflows: [
      'Start here when a new intake row still needs qualification review.',
      'Accept qualified rows into Parking Lot 2 or route unqualified rows into Trash Review with a reason.',
    ],
  },
  {
    title: 'Parking Lot 2',
    pages: ['parking-lot-2'],
    summary: 'Parking Lot 2 is the accepted arrival-stage page for rows that are in workflow but not yet through early routing and handoff.',
    modules: [
      'Arrival-stage queue buckets: accepted rows, missing item follow-up, and grouped arrivals.',
      'Group handoff page: coordinated review for one pickup or submission set.',
      'Record actions: open Intake or the current operational record.',
    ],
    workflows: [
      'Use it for arrival handling, SKU assignment, grouped handoff work, and missing-item follow-up.',
      'Move rows forward into Manual Intake, Workflow Hub, or specialist work instead of leaving accepted items parked here.',
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
      'Combined listings queue: ready-for-publishing and needs-further-work sections with shared search and filters.',
      'Selected record page: shared, Shopify, and eBay sections with workflow summary, actions, and payload visibility.',
      'Record detail workflow shell: final approve-for-publish work and post-publish context once the item reaches listing-phase ownership.',
    ],
    workflows: [
      'Use it for Awaiting Pre-Listing Review and Approved for Publish rows.',
      'Confirm title, price, notes, signoffs, and publish decisions here before any channel-facing action.',
    ],
  },
  {
    title: 'Post-Publish',
    pages: ['post-publish'],
    summary: 'Post-Publish is the dedicated lifecycle follow-through page for live listings after publish.',
    modules: [
      'Overview and bucket sections: Active Listings, Stale Listings, Sold Ready To Ship, and Shipped History.',
      'Shared search and sort toolbar: filter one lifecycle workset instead of scanning the full history.',
      'Per-row actions: mark stale, mark sold ready, mark shipped, and open the listing or operational record.',
    ],
    workflows: [
      'Use it once the item is live and the work is now stale follow-up, payment-to-shipping handoff, or shipment completion.',
      'Treat it as the active ownership page for listing lifecycle follow-through, not as part of the Workflow Hub.',
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
    pages: ['parking-lot-1'],
    summary: 'These pages are the deeper intake decision surfaces when the queue row alone is not enough, especially for grouped submissions.',
    surfaces: [
      'Selected record page: one intake row with qualification, routing, and next-step context.',
      'Group review page: shared submission review, submission group ID, and allocation decisions for multi-item intake.',
    ],
    workflows: [
      'Use them when a single queue row needs deeper qualification work or a grouped submission needs one coordinated decision.',
      'Finish the acceptance or trash decision here before the item moves into Parking Lot 2 or Trash Review.',
    ],
  },
  {
    title: 'Parking Lot 2 Group Handoff Page',
    pages: ['parking-lot-2'],
    summary: 'This page keeps one accepted pickup or submission set together during arrival-stage handoff work.',
    surfaces: [
      'Group handoff page: shared set summary plus direct actions into Manual Intake and the operational record for each row.',
    ],
    workflows: [
      'Use it when multiple accepted rows need coordinated arrival-stage work and shared context should stay visible.',
      'Hand off each row into the next real working page instead of leaving the set parked in the queue.',
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
    title: 'Workflow Operational Record Editors',
    pages: ['inventory'],
    summary: 'These workflow record surfaces are the deeper operational pages linked from the Workflow Hub directory and snapshot views.',
    surfaces: [
      'Operational record editor: row-level workflow fields and readiness context.',
      'Inventory price editor: targeted pricing edits for workflow rows.',
    ],
    workflows: [
      'Open these when the Workflow Hub directory or workflow snapshot shows that a row needs deeper editing or pricing correction.',
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
      'Treat it as the detailed home for listing review once the item reaches Listings ownership.',
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
    { page: 'parking-lot-1', title: 'Start intake cleanup here', detail: 'Open Parking Lot 1 when the front door is backing up or new submissions need qualification decisions.' },
    { page: 'listings', title: 'Open final review here', detail: 'Open Listings when the work is publish readiness, channel prep, or listing-phase blockers.' },
  ],
  owner: [
    { page: 'dashboard', title: 'Start with the operation view', detail: 'Open Dashboard to see where throughput, aging work, or follow-through needs intervention.' },
    { page: 'post-publish', title: 'Check live listing follow-through', detail: 'Open Post-Publish when the question is stale listings, sold-ready handoff, or shipment completion.' },
    { page: 'listings', title: 'Review publish readiness here', detail: 'Open Listings when an item is nearing release or channel detail needs review.' },
  ],
  processor: [
    { page: 'parking-lot-1', title: 'Start fresh intake here', detail: 'Open Parking Lot 1 first when you are qualifying new used-gear intake.' },
    { page: 'inventory', title: 'Route active work here', detail: 'Open Workflow Hub when the item is accepted and needs routing, triage, or blocker cleanup.' },
    { page: 'post-publish', title: 'Work live follow-through here', detail: 'Open Post-Publish once the item is already live and now needs stale, sold-ready, or shipping follow-through.' },
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

export function getVisiblePageCards(accessiblePages: AppPage[]): PageGuideCard[] {
  const accessiblePageSet = new Set(accessiblePages);
  return PAGE_GUIDE_CARDS.filter((card) => card.pages.some((page) => accessiblePageSet.has(page)));
}

export function getVisibleRecordCards(accessiblePages: AppPage[]): RecordGuideCard[] {
  const accessiblePageSet = new Set(accessiblePages);
  return RECORD_GUIDE_CARDS.filter((card) => card.pages.some((page) => accessiblePageSet.has(page)));
}

export function getRoleStartPoints(role: UserRole, accessiblePages: AppPage[]): RoleStartPoint[] {
  const accessiblePageSet = new Set(accessiblePages);
  const matchingStarts = ROLE_START_POINTS[role].filter((item) => accessiblePageSet.has(item.page));

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