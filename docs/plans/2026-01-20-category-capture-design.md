# Category Capture Support Design

## Overview

Add support for `org-category-capture` and `org-project-capture` features from org-agenda-api. Category types allow capturing to specific contexts (like projects) with a parameterized capture template.

## API Endpoints

### GET /category-types

Returns list of registered category strategy types with prompts:

```json
{
  "types": [
    {
      "name": "projects",
      "hasCategories": true,
      "captureTemplate": "* TODO %?\n",
      "prompts": [
        { "name": "Title", "type": "string", "required": true },
        { "name": "Scheduled", "type": "date", "required": false },
        { "name": "Deadline", "type": "date", "required": false },
        { "name": "Priority", "type": "string", "required": false },
        { "name": "Tags", "type": "tags", "required": false }
      ]
    }
  ]
}
```

### GET /categories?type=NAME

Returns categories for a strategy type:

```json
{
  "type": "projects",
  "categories": ["alpha", "beta", "gamma"],
  "todoFiles": ["/path/to/file.org"]
}
```

### POST /category-capture

Capture to a specific category:

```json
{
  "type": "projects",
  "category": "alpha",
  "title": "New task",
  "todo": "TODO",
  "scheduled": "2026-01-20",
  "deadline": "2026-01-25",
  "priority": "A",
  "tags": ["urgent"]
}
```

## UI Design

### Capture Menu Structure

```
[Template A]
[Template B]
─────────────
[Projects]        ← category type (with folder icon)
[Other Type]      ← category type
```

Category types appear after a divider, visually distinguished from regular templates.

### Category Type Selection Flow

When a category type is selected:

1. **Category field** (combo input) - First field
   - Shows dropdown of existing categories
   - Allows typing new category name directly
   - Autocomplete/filter as user types
   - Shows "Create 'NewName'" option when typing non-existing value

2. **Template prompts** - From category type definition (Title, Scheduled, etc.)

3. **Universal org fields** - State, priority, schedule, deadline, tags (skip duplicates already in prompts)

### CategoryField Component

Combo input behavior:

- Text input with dropdown indicator
- On focus: shows dropdown of existing categories
- As user types: filters dropdown list
- Can select from list OR submit typed value as new category
- Visual feedback for new vs existing category

## Implementation

### 1. services/api.ts

Add types:

```typescript
export interface CategoryType {
  name: string;
  hasCategories: boolean;
  captureTemplate: string;
  prompts: TemplatePrompt[];
}

export interface CategoryTypesResponse {
  types: CategoryType[];
}

export interface CategoriesResponse {
  type: string;
  categories: string[];
  todoFiles: string[];
}
```

Add methods:

```typescript
async getCategoryTypes(): Promise<CategoryTypesResponse>
async getCategories(type: string): Promise<CategoriesResponse>
async categoryCapture(
  type: string,
  category: string,
  values: Record<string, string | string[]>
): Promise<CaptureResponse>
```

### 2. context/TemplatesContext.tsx

- Add `categoryTypes: CategoryType[] | null` to state
- Fetch from `/category-types` in `reloadTemplates()`
- Expose in context

### 3. app/(tabs)/capture.tsx

- Extend menu to show category types after divider
- Track selection type: `{ type: 'template', key: string } | { type: 'category', name: string }`
- When category type selected:
  - Fetch categories from `/categories?type=NAME`
  - Show CategoryField before prompts
- Route capture to `/category-capture` for category types

### 4. components/CategoryField.tsx

New component:

```typescript
interface CategoryFieldProps {
  categories: string[];
  value: string;
  onChange: (value: string) => void;
  loading?: boolean;
}
```

Implementation:

- TextInput + Menu combo
- Filter categories as user types
- Show filtered existing categories
- Show "Create 'X'" option when value doesn't match existing

## Files to Change

| File                           | Changes                                      |
| ------------------------------ | -------------------------------------------- |
| `services/api.ts`              | Add 3 new API methods + types                |
| `context/TemplatesContext.tsx` | Fetch & expose `categoryTypes`               |
| `app/(tabs)/capture.tsx`       | Extended menu, routing logic, category state |
| `components/CategoryField.tsx` | New combo input component                    |

## Testing

- Verify category types appear in menu after templates
- Test selecting existing category from dropdown
- Test typing new category name
- Test autocomplete filtering
- Verify capture posts to correct endpoint
- Test with no category types configured (graceful fallback)
