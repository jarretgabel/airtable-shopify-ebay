# Copilot Instructions

Canonical source: docs/PROJECT_REFERENCE_SUMMARY.md.

Do not break contracts, auth gating, or local /api validation workflows.

## Issue Tracking

For major feature changes, plans, and adjustments, file an issue in the app's Issues tracker (`/issues`) so the work is tracked. Skip small fixes. Use `node --env-file=.env.local --import tsx scripts/create-issue.ts --kind feature|bug|question --title "..." --description "..." --priority low|normal|high|urgent --area "..."` (or `--file items.json` for several). File it when a plan is agreed or work is deferred, and note remaining or deferred items as issues instead of leaving them only in chat. The script writes to the database in `.env.local` (staging).

## Work Log
- After each work session, update the day's row in docs/WORK_LOG.md: a short summary of the major things done, and hours.
- Hours: use the user's number if given; otherwise estimate from commit timestamps (sessions = commits <2h apart, first-to-last + 30 min, rounded to 0.25h) and mark with `~`.
- Add a new row only when the date has none; never invent work that was not done.
