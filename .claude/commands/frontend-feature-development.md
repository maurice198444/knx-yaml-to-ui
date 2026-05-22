---
name: frontend-feature-development
description: Workflow command scaffold for frontend-feature-development in knx-yaml-to-ui.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /frontend-feature-development

Use this workflow when working on **frontend-feature-development** in `knx-yaml-to-ui`.

## Goal

Implements a new frontend feature or major UI flow, often corresponding to a Plan phase (e.g., Convert flow, Entities view, History view). Typically involves creating or updating multiple files under addon/web/src/views/, addon/web/src/components/, and related state/api files.

## Common Files

- `addon/web/src/views/*.ts`
- `addon/web/src/components/**/*.ts`
- `addon/web/src/state/store.ts`
- `addon/web/src/api/types.ts`
- `addon/web/src/api/client.ts`
- `addon/web/src/styles/*.css`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Create or update view component(s) in addon/web/src/views/
- Add or update supporting UI components in addon/web/src/components/ or addon/web/src/components/ui/
- Update or create state management in addon/web/src/state/store.ts if needed
- Update or create API types/client in addon/web/src/api/types.ts and addon/web/src/api/client.ts if needed
- Update styles or theme files in addon/web/src/styles/ or addon/web/src/theme.ts if needed

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.