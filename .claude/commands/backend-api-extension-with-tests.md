---
name: backend-api-extension-with-tests
description: Workflow command scaffold for backend-api-extension-with-tests in knx-yaml-to-ui.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /backend-api-extension-with-tests

Use this workflow when working on **backend-api-extension-with-tests** in `knx-yaml-to-ui`.

## Goal

Adds or extends a backend API endpoint, including implementation, schema/type changes, and automated tests.

## Common Files

- `addon/app/routers/*.py`
- `addon/app/schemas.py`
- `addon/app/tests/test_routers_*.py`
- `addon/web/src/api/types.ts`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Implement or update endpoint in addon/app/routers/*.py
- Update or create schema in addon/app/schemas.py if needed
- Add or update automated tests in addon/app/tests/test_routers_*.py
- Update API types in addon/web/src/api/types.ts if frontend uses the endpoint

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.