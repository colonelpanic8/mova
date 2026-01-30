# Category UI Features Design

## Overview

Add two category-related UI features:

1. Toggle to group agenda items by category (with collapsible sub-headers)
2. Category colors with auto-assignment and user overrides

## Feature 1: Category Grouping

### Behavior

When enabled, items within each agenda section (Active/Completed) are grouped by category with collapsible sub-headers:

```
Active
  └─ Work (collapsible header)
      └─ Task 1
      └─ Task 2
  └─ Personal (collapsible header)
      └─ Task 3
  └─ Uncategorized (collapsible header)
      └─ Task 4
Completed
  └─ Work
      └─ Done task 1
```

### Collapsible Headers

- Tappable row with category name + item count + chevron icon
- Left border/accent using the category's color
- Collapsed state stored in component state (not persisted across sessions)
- Default: all categories expanded

### Implementation Approach

Flatten the structure rather than nested SectionList:

- Category headers become regular list items with `type: 'category-header'`
- Items belonging to collapsed categories are filtered out from render
- Simpler than nested lists and matches common React Native patterns

### Storage

New setting in `services/settings.ts`:

- Key: `mova_group_by_category`
- Default: `false`
- Exposed via `SettingsContext` as `groupByCategory` / `setGroupByCategory`

### Settings UI

Toggle added to main Settings screen under "Display" section.

## Feature 2: Category Colors

### Auto-Assignment

Predefined palette of 10-12 visually distinct colors:

```typescript
const CATEGORY_COLOR_PALETTE = [
  "#4A90D9", // blue
  "#50C878", // green
  "#E57373", // red
  "#FFB74D", // orange
  "#9575CD", // purple
  "#4DB6AC", // teal
  "#F06292", // pink
  "#7986CB", // indigo
  "#AED581", // light green
  "#FFD54F", // amber
];
```

Hash-based assignment ensures same category always gets same color:

```typescript
function getAutoColorForCategory(category: string): string {
  const hash = category
    .toLowerCase()
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return CATEGORY_COLOR_PALETTE[hash % CATEGORY_COLOR_PALETTE.length];
}
```

### User Overrides

Users can override specific category colors in the Colors settings screen. Overrides stored in `ColorPaletteConfig`:

```typescript
interface ColorPaletteConfig {
  // ... existing fields
  categoryColors: Record<string, ColorValue>; // category name → color override
}
```

### Resolution Logic

```typescript
function getCategoryColor(
  category: string,
  overrides: Record<string, ColorValue>,
  theme,
): string {
  if (overrides[category]) {
    return resolveColor(overrides[category], theme);
  }
  return getAutoColorForCategory(category);
}
```

### Colors Settings UI

New "Category Colors" section in `settings/colors.tsx`:

- List populated from categories discovered via `/filter-options` API
- Shows current color (auto or override) with colored square
- Tapping opens color picker (same as other color settings)
- User selections become overrides stored in `categoryColors`

## Files to Modify

### New Files

- `utils/categoryColors.ts` - palette, hash function, resolution logic

### Modified Files

- `types/colors.ts` - add `categoryColors` to `ColorPaletteConfig`
- `context/ColorPaletteContext.tsx` - handle `categoryColors` in load/save/defaults
- `services/settings.ts` - add `groupByCategory` storage functions
- `context/SettingsContext.tsx` - expose `groupByCategory` setting
- `app/(tabs)/index.tsx` - category grouping logic with collapsible headers
- `app/(tabs)/settings/index.tsx` - add grouping toggle
- `app/(tabs)/settings/colors.tsx` - add Category Colors section

## Dependencies

- Categories list from existing `/filter-options` API (available via `FilterContext`)

## Default Behavior

- Grouping: off
- Colors: auto-assigned from palette, no user overrides
