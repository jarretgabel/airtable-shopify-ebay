# Used Gear Workflow Operator Guide

This guide is the day-to-day reference for operators using the in-app used-gear workflow. It is organized page first, then by the major modules on that page, so the fastest question stays clear: which page owns the job you are trying to do?

## Primary Navigation Order

- Workflow surfaces follow `Intake > Processing > Listings` in the app shell.
- Use Intake for qualification, trash decisions, arrival routing, and manual-entry creation.
- Use Processing for the Workflow Hub plus dedicated Testing and Photography work discovery and form completion.
- Use Listings for final readiness review, approve-for-publish work, channel visibility, and post-publish record context once the item reaches listing-phase ownership.
- Use Post-Publish for live listing lifecycle follow-through after the item is already published.
- Utility pages such as User Guide, Market Research, JotForm, Image Lab, Settings, Notifications, and User Management sit outside the main operational lane.

## End-To-End Workflow

1. Intake arrives through JotForm or Manual Intake.
2. Parking Lot decides whether the row qualifies into workflow or moves to Trash Review.
3. Parking Lot handles accepted arrival-stage work, grouped handoffs, and early routing inside the same intake surface.
4. Workflow Hub handles active-stage triage, shared routing, and blocker cleanup.
5. Testing Queue plus the Testing record page complete hands-on signoff.
6. Photography Queue plus the Photos record page complete image work and handoff.
7. Listings handles final pricing, note review, approve-for-publish work, and listing-phase record context.
8. Shopify Products and eBay are read-only snapshot views after listing work is prepared.
9. Post-Publish handles stale listings, sold-ready follow-through, shipment completion, and shipped history.

## Page And Module Reference

### Dashboard
- Purpose:
  - see backlog, pressure points, and action shortcuts across the operation
- Modules:
  - Overview KPIs
  - Actions shortcuts
  - Insights cards
- Use it for:
  - deciding which queue or workflow page owns the next intervention
  - spotting intake, workflow, listings, or post-publish pressure before opening a record

### User Guide
- Purpose:
  - explain the workflow by role, page, and module without adding extra chrome to the operational pages
- Modules:
  - workflow lane map
  - role quick start
  - page-by-page reference cards
  - quick answers
- Use it for:
  - figuring out where a job belongs before you open a queue or record
  - clarifying ownership between intake, workflow, listings, and post-publish pages

### JotForm
- Purpose:
  - show the raw source-feed intake submissions as reference data
- Modules:
  - live submissions list
  - expanded answer detail
- Use it for:
  - verifying seller-provided source data before or during Parking Lot review
  - checking the original intake context without turning JotForm into the operational decision page

### Manual Intake
- Purpose:
  - create or correct intake rows inside the app when the work did not start from JotForm
- Modules:
  - manual intake form
  - route selection into Parking Lot review or accepted Parking Lot arrival-stage work
- Use it for:
  - phone deals, repeat customers, or accepted arrival-stage edits
  - capturing seller-reference notes, grouping IDs, and qualification context cleanly before downstream work

### Parking Lot
- Purpose:
  - qualify new intake and decide whether it continues or stops
- Modules:
  - pending review queue
  - grouped review flow
  - selected record and group review pages
- Use it for:
  - accepting qualified rows into Parking Lot arrival-stage handling
  - routing unqualified rows into Trash Review with a reason
  - handling grouped submission allocation and shared intake decisions

### Trash Review
- Purpose:
  - manage rows that were rejected during intake review
- Modules:
  - trash queue
  - trash record page
- Use it for:
  - restore
  - re-qualify
  - permanent delete

### Parking Lot Arrival-Stage Work
- Purpose:
  - handle accepted arrival-stage work before the item settles into active workflow or specialist queues
- Modules:
  - arrival-stage buckets
  - grouped handoff page
  - row actions into Manual Intake or operational context
- Use it for:
  - arrival routing
  - grouped pickup and submission handoff
  - missing-item follow-up

### Workflow Hub
- Purpose:
  - triage active operational rows that still belong to workflow rather than listing follow-through
- Modules:
  - workflow bar with filters and saved views
  - progress queue
  - record links into deeper operational pages
- Use it for:
  - active-stage routing
  - blocker cleanup
  - cross-stage handoff visibility
- Do not use it for:
  - final publish review
  - live listing stale or shipping follow-through

### Testing Queue
- Purpose:
  - discover rows that are ready for hands-on testing work
- Modules:
  - filterable queue list
  - handoff actions into Testing or operational context
- Use it for:
  - triage and work discovery
  - sharing one exact testing workset through the URL

### Testing
- Purpose:
  - complete the actual hands-on testing work for one row
- Modules:
  - testing form fields
  - record-level workflow context
- Use it for:
  - capturing findings, issue notes, and testing signoff
  - sending the item forward with clear usable notes

### Photography Queue
- Purpose:
  - discover rows that are ready for image work
- Modules:
  - filterable queue list
  - grouped submission visibility
  - handoff actions into Photos or operational context
- Use it for:
  - planning image work
  - keeping grouped items together while handing off a specific filtered workset

### Photos
- Purpose:
  - complete the actual image work for one row
- Modules:
  - photos form fields
  - record-level handoff context
- Use it for:
  - marking photography complete
  - leaving clean handoff notes before Listings review

### Listings
- Purpose:
  - own final listing review, approve-for-publish work, and listing-phase record context
- Modules:
  - combined listings queue with shared search and filters
  - selected record page with Shared, Shopify, and eBay sections
  - workflow summary, actions, blocker state, and payload visibility
- Use it for:
  - `Awaiting Pre-Listing Review`
  - `Approved for Publish`
  - final pricing and note review before publish
  - listing-phase audit and post-publish record context once the item reaches Listings ownership

### Post-Publish
- Purpose:
  - own live listing lifecycle follow-through after publish
- Modules:
  - bucket sections for Active Listings, Stale Listings, Sold Ready To Ship, and Shipped History
  - shared search and sort toolbar
  - per-row lifecycle actions
- Use it for:
  - stale follow-up
  - sold-ready handoff
  - shipment completion
  - shipped history lookup
- Note:
  - the page no longer uses top-level stats cards; work directly from the section buckets and toolbar

### Shopify Products
- Purpose:
  - show read-only Shopify store-side visibility after listing work is prepared
- Modules:
  - service summary panel
  - product snapshot directory
  - snapshot record page
- Use it for:
  - checking Shopify-side status and representation
  - store visibility only, not approvals or workflow routing

### eBay
- Purpose:
  - show read-only eBay inventory, offer, and connection visibility after listing work is prepared
- Modules:
  - service summary panel
  - snapshot directory
  - snapshot record page
- Use it for:
  - checking eBay-side status and representation
  - connection or snapshot visibility only, not approvals or workflow routing

### Market Research
- Purpose:
  - provide HiFiShark market context when pricing work needs outside reference
- Modules:
  - model slug search
  - comparable listings table
- Use it for:
  - price research before or during Listings review
  - quick outside-market context without changing the workflow record itself

### Image Lab
- Purpose:
  - handle AI-assisted image processing and utility work outside the queue flow
- Modules:
  - options panel
  - session stats and drop zone
  - bulk actions
  - per-image result cards
- Use it for:
  - image processing and AI identification support work
  - utility tasks that help listings without becoming workflow decision surfaces

### Notifications
- Purpose:
  - keep one inbox for personal workflow and system notifications
- Modules:
  - search and filter toolbar
  - notification list
  - bulk actions
- Use it for:
  - triaging unread alerts
  - clearing or marking seen notifications after the real work is handled elsewhere

### Settings
- Purpose:
  - let the current signed-in user manage their own account settings
- Modules:
  - Profile
  - Password
  - Notifications
  - Runtime diagnostics for eligible roles
  - Session controls
- Use it for:
  - self-service account maintenance
  - personal notification preferences
  - developer runtime diagnostics when the role allows it

### User Management
- Purpose:
  - manage user accounts, role access, and workflow alert defaults
- Modules:
  - User Directory
  - Create User
  - Role Workflow Alert Defaults
  - selected user detail page
- Use it for:
  - provisioning accounts
  - adjusting role access
  - applying role-level workflow notification defaults

## Suggested Daily Flow

1. Start in Parking Lot for new intake.
2. Move accepted rows through Parking Lot arrival-stage handling and into active workflow handling.
3. Use Workflow Hub for routing and blocker cleanup.
4. Work specialist signoffs from Testing Queue and Photography Queue, then complete details in the Testing and Photos pages.
5. Use Listings for final review and approve-for-publish work.
6. Use Shopify Products and eBay only for read-only channel visibility after listing work is prepared.
7. Use Post-Publish for stale listings, sold-ready handoff, shipment completion, and shipped history.