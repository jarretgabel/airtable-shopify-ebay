# Copilot Senior Engineer Principles

**Audience:** All AI agents and contributors. This file encodes senior-level engineering standards for this codebase. Always follow these rules when coding, reviewing, or generating documentation.

---

## 1. Code Cleanliness & Structure
- Write clear, concise, and maintainable code. Avoid cleverness that reduces readability.
- Use expressive variable, function, and component names. Follow the naming conventions in `docs/PROJECT_REFERENCE_SUMMARY.md`.
- Keep files focused and under 220 lines when practical. Extract helpers/types as needed.
- Remove dead code and unused imports immediately.

## 2. Consistency & Patterns
- Always follow the patterns, architecture, and workflow rules in `docs/PROJECT_REFERENCE_SUMMARY.md`.
- When adding or changing a workflow, integration, or convention, update `PROJECT_REFERENCE_SUMMARY.md` and reference the change in your PR.
- Use the provided example data and diagrams in `docs/examples/` for tests, UI, and payloads.

## 3. Documentation & Process
- Update all relevant docs when changing workflows, architecture, or conventions.
- Reference the doc update in your PR and code review checklist.
- Use the PR template and code review checklist in `.github/`.

## 4. Integration & Error Handling
- Use the exact payload shapes and integration flows for Airtable, Shopify, eBay, and Google Drive as documented.
- Handle errors explicitly and log actionable messages.
- Add troubleshooting steps for new error scenarios to `docs/TROUBLESHOOTING.md`.

## 5. Testing & Validation
- Write or update tests for all new features and bug fixes.
- Use real-world and edge-case data from `docs/examples/`.
- Validate all changes with `npm run build` and local testing before PR.

---

**Reminder:** This codebase is held to a senior engineering standard. Prioritize clarity, maintainability, and documentation in every change.
