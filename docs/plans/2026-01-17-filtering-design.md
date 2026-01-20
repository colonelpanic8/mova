# Filtering Support Design

## Overview

Add comprehensive filtering/narrowing support across agenda, search, and custom views using a filter bar with chips UI.

## Filter Types

- **By tag** - Show/exclude items with specific tags (e.g., `:work:`, `:home:`)
- **By file/category** - Filter to items from specific org files
- **By TODO state** - Filter by state (TODO, NEXT, WAITING, DONE, etc.)
- **By priority** - Filter by priority level ([#A], [#B], [#C])
- **By date range** - Filter to specific date ranges (today, next 7 days, overdue, etc.)

## API Changes (org-agenda-api)

### Add Tag Support

Currently the API does not return tags. Modify `/get-all-todos` response to include tags:

```json
{
  "title": "Meeting with Bob",
  "todo": "TODO",
  "scheduled": "2024-01-12T14:00:00Z",
  "tags": ["work", "meetings"],
  "category": "projects",
  "file": "~/org/projects.org",
  ...
}
```

### Implementation

1. Extract tags from org headlines using `org-get-tags`
2. Include `category` from org file or `#+CATEGORY` directive
3. Include `file` path (relative to org-directory)

## Mobile App Changes

### UI Components

#### FilterBar Component

Horizontal scrollable bar below the header showing active filters as chips:

```
┌─────────────────────────────────────────────────────┐
│ [+ Add Filter]  [work ×]  [Priority: A ×]  [TODO ×] │
└─────────────────────────────────────────────────────┘
```

- Tapping a chip removes that filter
- Tapping "+ Add Filter" opens filter selection modal
- Chips are color-coded by filter type

#### FilterModal Component

Modal for selecting/configuring filters:

```
┌─────────────────────────────────────────┐
│ Add Filter                          [×] │
├─────────────────────────────────────────┤
│ Tag           [work] [home] [errands]   │
│ State         [TODO] [NEXT] [WAITING]   │
│ Priority      [A] [B] [C]               │
│ Date Range    [Today] [Week] [Custom]   │
│ File          [projects.org] [inbox.org]│
└─────────────────────────────────────────┘
```

- Options populated dynamically from fetched todos
- Multi-select within each category
- Include/exclude toggle for tags

### State Management

Create `FilterContext` or add to existing context:

```typescript
interface FilterState {
  tags: { include: string[]; exclude: string[] };
  states: string[];
  priorities: string[];
  dateRange:
    | { start: Date | null; end: Date | null }
    | "today"
    | "week"
    | "overdue";
  files: string[];
}
```

### Filter Application

- Filters applied client-side after fetching todos
- Same filter state shared across agenda, search, and views tabs
- Filters persist across navigation (stored in context)
- Optional: persist filters to AsyncStorage for session persistence

### File Structure

```
components/
├── FilterBar.tsx          # Horizontal chip bar
├── FilterChip.tsx         # Individual filter chip
├── FilterModal.tsx        # Filter selection modal
context/
├── FilterContext.tsx      # Filter state management
utils/
├── filterTodos.ts         # Filter logic functions
```

## Implementation Order

1. Add tag/category/file support to org-agenda-api
2. Create FilterContext with filter state
3. Build FilterBar and FilterChip components
4. Build FilterModal component
5. Implement filterTodos utility
6. Integrate FilterBar into agenda, search, and views screens
7. Add persistence (optional)
