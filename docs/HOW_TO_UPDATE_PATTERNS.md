# How to Update Patterns and Workflows

Whenever you update or introduce new patterns, workflows, or conventions, follow this checklist:

1. Review the change:
   - Is it architectural, workflow, UI, or data model related?
   - Does it affect how contributors or agents should work?
2. Update `docs/PROJECT_REFERENCE_SUMMARY.md` with the new or changed pattern.
3. Update or add to any relevant instruction files in `.github/` or `docs/`.
4. If the change is significant, add a note to the main `README.md`.
5. Reference the change in your PR description and checklist.
6. If you add a new workflow, form, or integration, follow the onboarding guides and update all relevant docs.

**Flowchart:**

```
Change planned/merged
      ↓
Is it a pattern/workflow/convention? → No → Done
      ↓ Yes
Update PROJECT_REFERENCE_SUMMARY.md
      ↓
Update other docs/instructions as needed
      ↓
Reference in PR
      ↓
Done
```
