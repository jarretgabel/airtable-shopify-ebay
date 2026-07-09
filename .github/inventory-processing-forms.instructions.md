---
description: Compact rules for Inventory Processing local Airtable-backed forms.
applyTo: src/components/tabs/**,src/services/*Form.ts,docs/forms/**
---

# Inventory Processing Form Pattern (Compact)

Use 3-way split: component, schema, service.

Keep Airtable transforms in service, field order in schema, and run npm run build.