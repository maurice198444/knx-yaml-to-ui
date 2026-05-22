```markdown
# knx-yaml-to-ui Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill teaches you how to contribute to the `knx-yaml-to-ui` project, a TypeScript-based codebase (no framework detected) for converting KNX YAML configurations into a user interface. You'll learn the project's coding conventions, how to implement new features or polish the UI, extend backend APIs, and update documentation. The guide also covers testing patterns and provides command suggestions for common workflows.

## Coding Conventions

**File Naming**
- Use camelCase for file names.
  - Example: `convertFlow.ts`, `entityList.ts`

**Import Style**
- Mixed usage of default and named imports.
  - Example:
    ```typescript
    import React from 'react';
    import { useStore } from '../state/store';
    ```

**Export Style**
- Prefer named exports.
  - Example:
    ```typescript
    export function EntityList() { ... }
    export const ENTITY_TYPES = ['sensor', 'switch'];
    ```

**Commit Messages**
- Use [Conventional Commits](https://www.conventionalcommits.org/).
  - Prefixes: `feat`, `fix`, `docs`, `chore`
  - Example: `feat: add history view for entity tracking`

## Workflows

### Frontend Feature Development
**Trigger:** When adding a new user-facing feature or major UI section to the frontend  
**Command:** `/new-frontend-feature`

1. Create or update view component(s) in `addon/web/src/views/`
2. Add or update supporting UI components in `addon/web/src/components/` or `addon/web/src/components/ui/`
3. Update or create state management in `addon/web/src/state/store.ts` if needed
4. Update or create API types/client in `addon/web/src/api/types.ts` and `addon/web/src/api/client.ts` if needed
5. Update styles or theme files in `addon/web/src/styles/` or `addon/web/src/theme.ts` if needed
6. Test integration with backend if necessary

**Example:**
```typescript
// addon/web/src/views/HistoryView.ts
import { useHistory } from '../state/store';
import { HistoryList } from '../components/HistoryList';

export function HistoryView() {
  const history = useHistory();
  return <HistoryList data={history} />;
}
```

---

### Backend API Extension with Tests
**Trigger:** When adding or extending a backend API endpoint  
**Command:** `/new-api-endpoint`

1. Implement or update endpoint in `addon/app/routers/*.py`
2. Update or create schema in `addon/app/schemas.py` if needed
3. Add or update automated tests in `addon/app/tests/test_routers_*.py`
4. Update API types in `addon/web/src/api/types.ts` if frontend uses the endpoint

**Example:**
```python
# addon/app/routers/entities.py
from fastapi import APIRouter

router = APIRouter()

@router.get("/entities")
def list_entities():
    return [{"id": 1, "name": "Sensor"}]
```
```typescript
// addon/web/src/api/types.ts
export interface Entity {
  id: number;
  name: string;
}
```

---

### Frontend UI Polish or Redesign
**Trigger:** When improving the look, usability, or localization of an existing UI feature  
**Command:** `/ui-polish`

1. Update view/component files in `addon/web/src/views/` or `addon/web/src/components/`
2. Update supporting UI elements in `addon/web/src/components/ui/` if needed
3. Adjust styles in `addon/web/src/styles/` if needed
4. Update translations or state logic if needed

**Example:**
```typescript
// addon/web/src/components/ui/Button.ts
export function Button({ children, ...props }) {
  return <button className="primary-btn" {...props}>{children}</button>;
}

/* addon/web/src/styles/button.css */
.primary-btn {
  background-color: #007bff;
  color: #fff;
}
```

---

### Documentation and Planning Update
**Trigger:** When documenting a new feature, design, or release process  
**Command:** `/add-docs`

1. Create or update markdown files in `docs/active/webapp/`
2. Add or update mockup HTML files in `docs/active/webapp/plan-03-mockups/`
3. Document smoke test procedures or plans

**Example:**
```markdown
<!-- docs/active/webapp/history-view.md -->
# History View
This document describes the design and usage of the History View feature.
```

## Testing Patterns

- Test files use the pattern `*.test.*` (e.g., `entityList.test.ts`)
- Testing framework is not explicitly detected; check existing test files for conventions.
- Place tests alongside implementation or in dedicated test directories.

**Example:**
```typescript
// addon/web/src/components/entityList.test.ts
import { render } from '@testing-library/react';
import { EntityList } from './EntityList';

test('renders entity list', () => {
  const { getByText } = render(<EntityList entities={[{ id: 1, name: 'Sensor' }]} />);
  expect(getByText('Sensor')).toBeInTheDocument();
});
```

## Commands

| Command               | Purpose                                           |
|-----------------------|--------------------------------------------------|
| /new-frontend-feature | Start a new frontend feature or major UI flow    |
| /new-api-endpoint     | Add or extend a backend API endpoint with tests  |
| /ui-polish            | Refine, redesign, or localize existing UI        |
| /add-docs             | Add or update documentation or planning files    |
```