# Documentation Index

Welcome to the Airtable-Shopify-eBay project documentation! This index will help you find the right guide for your task.

## 📋 Choose Your Starting Point

**I'm starting a new feature or component** 
→ Start with [Naming & Organization](./naming-and-organization.md) for folder structure, then check [Quick Decisions](./quick-decisions.md) for where code lives.

**I'm reviewing a PR or writing code**
→ Use [Code Review Checklist](./code-review-checklist.md) as your pre-flight checklist.

**I need to decide where something goes**
→ [Quick Decisions](./quick-decisions.md#where-should-i-put-this-code) has a flowchart.

**I'm writing a Zustand store**
→ [State Management](./state-management.md#zustand-store-architecture) shows the three-file pattern.

**I'm building a service/API integration**
→ [Service Organization](./service-organization.md) covers structure, request builders, and mappers.

**I'm updating the Lambda/app-api migration seam or local validation workflow**
→ Use [AWS Lambda Write Validation](../docs/migrations/aws-lambda-write-validation.md) for the no-Docker local API pattern, guarded probes, and validation checklists.

**I'm building a React hook with side effects**
→ [State Management § Hook-Based State](./state-management.md#hook-based-state-for-complex-logic) shows the pattern.

**I'm updating the Incoming Gear or Testing forms**
→ Use [Inventory Processing Forms](../docs/forms/README.md), then the specific form instruction doc.

**I need naming conventions**
→ [Naming & Organization](./naming-and-organization.md#naming-conventions) covers all naming rules.

**Quick 2-minute question**
→ [Quick Decisions](./quick-decisions.md) has tables and flowcharts for common decisions.

---

## 📚 Documentation Files

### [Naming & Organization](./naming-and-organization.md)
**What it covers:** File naming (PascalCase, camelCase, UPPER_SNAKE_CASE), folder structure patterns, when to split files, import conventions.

**Sections:**
- Naming Conventions (components, hooks, stores, services, types)
- Folder Structure Patterns
- Import Path Conventions
- Environment Variables
- File Size Guidelines
- Data Flow Patterns

**When to use:** Starting a new file or refactoring — tells you exactly where it goes and what to name it.

### [State Management](./state-management.md)
**What it covers:** Zustand stores, React hooks with side effects, selectors, Context patterns, avoiding infinite loops.

**Sections:**
- Zustand Store Architecture (three-file pattern: `*Store.ts`, `*StoreTypes.ts`, `*StoreConstants.ts`)
- Selector Patterns (why primitives are better than objects)
- Hook-Based State for Complex Logic
- Auth Context Pattern
- Avoiding Infinite Loops
- Environment Variable Defaults
- Testing Stores

**When to use:** Building state management, data fetching hooks, or debugging re-render issues.

### [Service Organization](./service-organization.md)
**What it covers:** API integration patterns, request builders, response mappers, environment configuration, error handling.

**Sections:**
- Service Organization Structure (five-file pattern: `*{feature}.ts`, `*Config.ts`, `*Request.ts`, `*Mappers.ts`, `*Types.ts`)
- Main Entry Point Pattern
- Config File Pattern
- Request Builder Pattern
- Mappers Pattern
- Types File Pattern
- Compatibility Wrapper Pattern
- Error Handling Pattern
- Testing Pattern for Services

**When to use:** Building a new service, integrating with an API, or refactoring existing services.

### [AWS Lambda Write Validation](../docs/migrations/aws-lambda-write-validation.md)
**What it covers:** No-Docker local `/api/*` validation, guarded Airtable/Shopify write probes, and the exact UI flows that must stay aligned with the Lambda seam.

**Sections:**
- Automated Write Probe
- Shopify Mutation Probe
- UI Flows To Validate
- Exit Criteria

**When to use:** Updating `src/services/app-api/*`, AWS handlers/providers, approval publish flows, or the local migration workflow.

### [Code Review Checklist](./code-review-checklist.md)
**What it covers:** Comprehensive PR review checklist organized by concern area (architecture, types, state, code quality, UI, services, auth, testing, build).

**Sections:**
- Architecture & Organization
- Type Safety
- State Management
- Code Quality
- UI & Styling
- Services & External Integration
- Auth & Permissions
- Testing
- Build & Quality Gates
- Behavioral Preservation
- PR Template Self-Check
- Review Priorities

**When to use:** Before posting a PR (self-review) or during PR review (peer review).

### [Quick Decisions](./quick-decisions.md)
**What it covers:** Decision flowcharts and quick tables for common architectural questions (where code goes, naming, types, testing).

**Sections:**
- "Where should I put this code?" (with decision tree)
- "How should I organize this so it fits the patterns?"
- "When should I create/split/merge something?"
- "What naming should I use?" (examples and anti-patterns)
- "Type, interface, or something else?" (decision table)
- "How much should I test?"
- "Should I use Zustand, useState, Context, or useReducer?" (decision table)
- "What's the import path convention?"
- "How do I know if my code is production-ready?"

**When to use:** Quick 2-minute questions while coding. References other docs for deeper dives.

### [Architecture Conventions](../docs/architecture-conventions.md)
**What it covers:** App shell design, service entry points, UI organization, testing strategy, accessibility requirements.

**Sections:**
- App Shell
- Services
- UI
- Testing
- Accessibility

**When to use:** Understanding high-level architecture and conventions across the app.

### [Inventory Processing Forms](../docs/forms/README.md)
**What it covers:** Overview of the local `Incoming Gear`, `Testing`, and `Photos` forms, shared Airtable target, route keys, implementation files, and change checklist.

**Related docs:**
- [Incoming Gear Instructions](../docs/forms/incoming-gear.instructions.md)
- [Testing Instructions](../docs/forms/testing.instructions.md)
- [Photos Instructions](../docs/forms/photos.instructions.md)
- [Inventory Processing Form Pattern](./inventory-processing-forms.instructions.md)
- [Inventory Processing Routing Pattern](./inventory-processing-routing.instructions.md)

**When to use:** Updating field order, changing form copy, adjusting Airtable mappings, or tracing where these forms are implemented.

### [Engineering Rules](./engineering-rules.md)
**What it covers:** Refactor safety, code organization, API contracts, auth protection, validation checklist.

**Sections:**
- Refactor Safety
- Code Organization
- API/Service Safety
- Auth and Permissions
- Validation Checklist for PRs

**When to use:** Refactoring code or ensuring you don't break existing contracts. Focus on what NOT to change.

### [UI Style Rules](./ui-style-rules.md)
**What it covers:** Tailwind v4 standards, dark mode defaults, responsive design, accessibility standards.

**Sections:**
- Visual Direction (dark mode, high-contrast aesthetic)
- Tailwind v4 Standards
- Interaction Standards
- Responsive Standards
- Accessibility Standards

**When to use:** Building or styling UI components.

### [Contributing Standards](./CONTRIBUTING.md)
**What it covers:** Required standards for all contributors (UI, theme, architecture, accessibility, validation before merge).

**Sections:**
- Required UI and Theme Rules
- Architecture and Behavior Rules
- Accessibility Requirements
- Validation Before Merge
- Pull Request Guidance

**When to use:** Getting oriented as a new contributor or refreshing on project standards.

### [Pull Request Template](./pull_request_template.md)
**What it covers:** PR template with structured sections and standards checklist.

**Sections:**
- Summary (what changed, why)
- Standards Checklist (UI, behavior, auth, business logic)
- Validation (build, screens, auth flows)
- Notes (risks, follow-up tasks)

**When to use:** Creating a pull request.

### [CI/CD Workflow](./workflows/ci.yml)
**What it covers:** GitHub Actions pipeline: typecheck, lint, test, build.

**Runs on:** All PRs and pushes to main.

**When to check:** If CI fails — see what step broke and consult appropriate docs.

---

## 🎯 Decision Matrix

Use this matrix to find the right doc for your task:

| Question | Doc | Specific Section |
|----------|-----|------------------|
| Where should I put component X? | [Naming & Organization](./naming-and-organization.md) | [Folder Structure Patterns](./naming-and-organization.md#folder-structure-patterns) |
| What should I name this file? | [Naming & Organization](./naming-and-organization.md) | [Naming Conventions](./naming-and-organization.md#naming-conventions) |
| How do I split a large file? | [Naming & Organization](./naming-and-organization.md) | [File Size Guidelines](./naming-and-organization.md#file-size-guidelines) |
| How do I build a Zustand store? | [State Management](./state-management.md) | [Zustand Store Architecture](./state-management.md#zustand-store-architecture) |
| How do I avoid infinite re-renders? | [State Management](./state-management.md) | [Avoiding Infinite Loops](./state-management.md#avoiding-infinite-loops-and-re-renders) |
| When should I use useState vs Zustand? | [Quick Decisions](./quick-decisions.md) | [Pattern Comparison](./quick-decisions.md#should-i-use-zustand-usestate-context-or-usereducer) |
| How do I organize a large service? | [Service Organization](./service-organization.md) | [Service Organization Structure](./service-organization.md#service-organization-structure) |
| How do I build request payloads? | [Service Organization](./service-organization.md) | [Request Builder Pattern](./service-organization.md#request-builder-pattern) |
| How do I transform API responses? | [Service Organization](./service-organization.md) | [Mappers Pattern](./service-organization.md#mappers-pattern) |
| Where are the local inventory-processing forms documented? | [Inventory Processing Forms](../docs/forms/README.md) | Full overview and per-form instruction docs |
| What checklist before posting a PR? | [Code Review Checklist](./code-review-checklist.md) | Full checklist |
| Where's the decision flowchart? | [Quick Decisions](./quick-decisions.md) | [Decision flowcharts](./quick-decisions.md) |
| What Tailwind standards apply? | [UI Style Rules](./ui-style-rules.md) | [Tailwind v4 Standards](./ui-style-rules.md#tailwind-v4-standards) |
| Dark mode or light mode? | [UI Style Rules](./ui-style-rules.md) | [Visual Direction](./ui-style-rules.md#visual-direction) |
| Is my change accessible? | [Code Review Checklist](./code-review-checklist.md) | [Accessibility](#ui--styling) |
| Is my component keyboard-navigable? | [Architecture Conventions](../docs/architecture-conventions.md) | [Accessibility](../docs/architecture-conventions.md#accessibility) |
| Should I refactor or add features? | [Engineering Rules](./engineering-rules.md) | [Refactor Safety](./engineering-rules.md#refactor-safety) |
| What breaks if I change this API? | [Engineering Rules](./engineering-rules.md) | [Code Organization](./engineering-rules.md#code-organization), [API/Service Safety](./engineering-rules.md#apiservice-safety) |

---

## 🚀 Workflows by Role

### Frontend Developer (New Feature)
1. [Quick Decisions](./quick-decisions.md#where-should-i-put-this-code) → Decide file placement
2. [Naming & Organization](./naming-and-organization.md) → Confirm naming and structure
3. [State Management](./state-management.md) → If state needed
4. [Code Review Checklist](./code-review-checklist.md) → Self-review before PR
5. Use [pull_request_template.md](./pull_request_template.md) → Create PR

### API Integration
1. [Service Organization](./service-organization.md) → Learn the pattern
2. [Engineering Rules](./engineering-rules.md) → Understand API contracts
3. [Code Review Checklist](./code-review-checklist.md#services--external-integration) → Review services section
4. Use [pull_request_template.md](./pull_request_template.md) → Create PR

### PR Reviewer
1. [Code Review Checklist](./code-review-checklist.md) → Use as review guide
2. [Naming & Organization](./naming-and-organization.md) → For structure questions
3. [State Management](./state-management.md) → For state logic review
4. [Service Organization](./service-organization.md) → For API/service review
5. Reference docs in comments to guide author

### Refactoring
1. [Engineering Rules](./engineering-rules.md) → What NOT to change
2. [Naming & Organization](./naming-and-organization.md) → Should I split files?
3. [State Management](./state-management.md) → Extract to Zustand?
4. [Service Organization](./service-organization.md) → Extract to helpers?
5. [Code Review Checklist](./code-review-checklist.md) → Self-review before PR

### Onboarding New Team Member
1. [Contributing Standards](./CONTRIBUTING.md) → Start here
2. [Architecture Conventions](../docs/architecture-conventions.md) → Understand structure
3. [Naming & Organization](./naming-and-organization.md) → Learn conventions
4. [Quick Decisions](./quick-decisions.md) → Get decision flowcharts bookmarked
5. [Code Review Checklist](./code-review-checklist.md) → Save as reference

---

## 📖 Reading Order by Depth

### Quick Onramp (< 30 minutes)
1. [Contributing Standards](./CONTRIBUTING.md) (5 min)
2. [Quick Decisions](./quick-decisions.md) (15 min)
3. [Code Review Checklist](./code-review-checklist.md) (10 min)

### Comprehensive Orientation (1-2 hours)
1. [Contributing Standards](./CONTRIBUTING.md)
2. [Architecture Conventions](../docs/architecture-conventions.md)
3. [Naming & Organization](./naming-and-organization.md)
4. [Quick Decisions](./quick-decisions.md)
5. [Code Review Checklist](./code-review-checklist.md)

### Deep Dive by Specialty (30 min each after onboarding)
- **State Management specialist** → [State Management](./state-management.md)
- **API/Service specialist** → [Service Organization](./service-organization.md)
- **UI specialist** → [UI Style Rules](./ui-style-rules.md) + [Naming & Organization](./naming-and-organization.md)
- **Architecture lead** → [Architecture Conventions](../docs/architecture-conventions.md) + [Engineering Rules](./engineering-rules.md)

---

## 🆘 Troubleshooting

**"My code has the right logic but tests are failing"**
→ Check [Code Review Checklist § Type Safety](./code-review-checklist.md#type-safety) and [State Management § Selectors](./state-management.md#selector-patterns)

**"Build passes but I get runtime errors"**
→ Check [Service Organization § Error Handling](./service-organization.md#error-handling-pattern)

**"Component re-renders too much"**
→ See [State Management § Avoiding Infinite Loops](./state-management.md#avoiding-infinite-loops-and-re-renders)

**"I don't know where this file should go"**
→ Go to [Quick Decisions § Where should I put this code?](./quick-decisions.md#where-should-i-put-this-code)

**"What's the right name for this?"**
→ See [Quick Decisions § What naming should I use?](./quick-decisions.md#what-naming-should-i-use)

**"This will take 5 minutes and I don't know how"**
→ Open [Quick Decisions](./quick-decisions.md) and search for your scenario

**"I'm about to post a PR, what's the checklist?"**
→ Go through [Code Review Checklist](./code-review-checklist.md) from top to bottom

---

## 💡 Pro Tips

- **Bookmark [Quick Decisions](./quick-decisions.md)** — You'll use it constantly for "where does X go?"
- **Reference [Code Review Checklist](./code-review-checklist.md)** in PR comments when suggesting patterns
- **Copy the checklist** into your development workflow (run it before committing)
- **Link to specific docs** in code comments when explaining architectural decisions
- **Keep all files in `.github/`** so they're easy to find and stay in sync with code

---

## 🔗 Quick Links

| Most Used | Link |
|-----------|------|
| Where should code go? | [Quick Decisions § Flowchart](./quick-decisions.md#where-should-i-put-this-code) |
| Pre-PR checklist | [Code Review Checklist](./code-review-checklist.md) |
| File naming | [Naming & Organization § Naming Conventions](./naming-and-organization.md#naming-conventions) |
| Zustand pattern | [State Management § Store Architecture](./state-management.md#zustand-store-architecture) |
| Service pattern | [Service Organization § Structure](./service-organization.md#service-organization-structure) |
| Quick decisions | [Quick Decisions](./quick-decisions.md) |

---

**Last updated:** March 2026
**Documentation version:** 1.0
**Coverage:** Naming, state management, services, architecture, code review, quick decisions
