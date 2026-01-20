# Enhanced Capture Design

## Overview

Extend the capture UI to support all fields that the update endpoint supports, presented in an expandable/collapsible section to keep quick capture simple.

## Dependencies

This feature depends on tag support being added to org-agenda-api first. See `2026-01-17-filtering-design.md` for tag API details.

## API Requirements

Ensure `/create` endpoint accepts all fields that `/update` supports:

- `scheduled` - Schedule date/time
- `deadline` - Deadline date/time
- `todo` - TODO state (TODO, NEXT, WAITING, etc.)
- `priority` - Priority level (A, B, C)
- `tags` - List of tags
- `file` - Target file for capture
- `heading` - Target heading to refile under (optional)
- Custom properties (if supported by update)

## Mobile App Changes

### Capture Screen Layout

```
┌─────────────────────────────────────────┐
│ What needs to be done?                  │
│ ┌─────────────────────────────────────┐ │
│ │ Buy groceries                       │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [▼ More options]                        │
│                                         │
│              [Capture]                  │
└─────────────────────────────────────────┘
```

Expanded state:

```
┌─────────────────────────────────────────┐
│ What needs to be done?                  │
│ ┌─────────────────────────────────────┐ │
│ │ Buy groceries                       │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [▲ More options]                        │
│ ┌─────────────────────────────────────┐ │
│ │ State:    [TODO ▼]                  │ │
│ │ Priority: [None] [A] [B] [C]        │ │
│ │ Schedule: [Select date]             │ │
│ │ Deadline: [Select date]             │ │
│ │ Tags:     [+ Add tag]               │ │
│ │ File:     [inbox.org ▼]             │ │
│ └─────────────────────────────────────┘ │
│                                         │
│              [Capture]                  │
└─────────────────────────────────────────┘
```

### Components

#### ExpandableOptions Component

Collapsible section containing all additional fields:

- Animated expand/collapse
- Remember expansion state within session
- Clear visual indicator of collapsed content

#### Field Components

Reuse existing components where possible:

- `StatePicker` - Dropdown for TODO states
- `PriorityPicker` - Chip selection for priorities (reuse from TodoItem)
- `DateTimePicker` - For schedule/deadline (reuse existing)
- `TagPicker` - Multi-select for tags (new component, also used in filtering)
- `FilePicker` - Dropdown for target file

### State Management

Extend capture state to include all optional fields:

```typescript
interface CaptureState {
  title: string;
  todo?: string; // defaults to TODO or configured default
  priority?: string; // A, B, C, or null
  scheduled?: Date;
  deadline?: Date;
  tags?: string[];
  file?: string; // defaults to inbox or configured default
}
```

### Tag Picker Component

New reusable component for tag selection:

- Shows tags used in existing todos (fetched from API)
- Allows adding new tags
- Multi-select with chips
- Autocomplete/filter as you type

### Default Values

- Load available TODO states from API (or config)
- Load available files from API
- Load commonly used tags from API
- Default TODO state: configurable in settings
- Default file: configurable in settings

### File Structure

```
components/
├── capture/
│   ├── ExpandableOptions.tsx   # Collapsible container
│   ├── StatePicker.tsx         # TODO state dropdown
│   ├── TagPicker.tsx           # Tag multi-select
│   ├── FilePicker.tsx          # Target file dropdown
app/(tabs)/
├── capture.tsx                 # Updated capture screen
```

## Implementation Order

1. **API first**: Ensure tag support is in org-agenda-api
2. **API second**: Ensure `/create` accepts all update fields
3. Build TagPicker component
4. Build FilePicker component (fetch available files from API)
5. Build StatePicker component
6. Build ExpandableOptions container
7. Integrate into capture screen
8. Add default value configuration to settings
