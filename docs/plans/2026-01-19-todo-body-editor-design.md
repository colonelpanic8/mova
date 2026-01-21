# Todo Body Editor Design

## Overview

Add support for editing the body (notes/content below the heading) of a todo item, including interactive checklist support with org-mode syntax.

## User Experience

### Access

- New swipe action button ("Body" or "Edit") in TodoItem alongside existing actions
- Uses note/document icon (e.g., `note-edit-outline`)

### Editor UI

- Full screen editor for ample editing space
- Header with back button, todo title, and Save button
- Scrollable content area with interactive elements
- Bottom toolbar for formatting actions

```
┌─────────────────────────────────┐
│ ← Back          Todo Title   Save│
├─────────────────────────────────┤
│                                 │
│  - [ ] Buy milk                 │
│  - [X] Call dentist             │
│  - [ ] Review PR                │
│                                 │
│  Some notes here about the      │
│  task details...                │
│                                 │
├─────────────────────────────────┤
│ ☐  •  1.  ←  →                  │
└─────────────────────────────────┘
```

### Toolbar Actions

- **Checklist** (☐): Insert `- [ ] ` at cursor or new line
- **Bullet** (•): Insert `- ` at cursor or new line
- **Numbered** (1.): Insert `1. ` (auto-increment based on context)
- **Outdent** (←): Remove 2 spaces of indentation
- **Indent** (→): Add 2 spaces of indentation

### Checklist Interaction

- Tappable checkboxes that toggle between `[ ]` and `[X]`
- Editable text content next to each checkbox
- Visual distinction between checked and unchecked items

### Saving

- Explicit "Save" button in header
- Auto-save when exiting the editor screen
- Track dirty state to avoid unnecessary saves

## Data Model

### API Changes (`services/api.ts`)

```typescript
interface Todo {
  // ... existing fields
  body?: string | null; // org-mode formatted body text
}

interface TodoUpdates {
  // ... existing fields
  body?: string | null; // update body content
}
```

The backend `/update` endpoint must accept a `body` field.

## Technical Design

### Org-Mode Parsing (`utils/orgBody.ts`)

```typescript
type BlockType = "paragraph" | "checklist" | "bullet" | "numbered";

interface Block {
  id: string; // Unique ID for React keys
  type: BlockType;
  indent: number; // Number of leading spaces (for nesting)
  checked?: boolean; // For checklists: [ ] = false, [X] = true
  content: string; // The text content
}

function parseOrgBody(text: string): Block[];
function serializeBlocks(blocks: Block[]): string;
```

**Parsing rules:**

- `- [ ] text` → checklist, checked=false
- `- [X] text` or `- [x] text` → checklist, checked=true
- `- text` (no checkbox) → bullet
- `1. text`, `2. text` etc → numbered
- Everything else → paragraph
- Leading spaces determine `indent` level (count spaces, divide by 2)

### State Management

```typescript
// In body-editor.tsx
const [blocks, setBlocks] = useState<Block[]>([]);
const [isDirty, setIsDirty] = useState(false);
const [isSaving, setIsSaving] = useState(false);

// Load on mount
useEffect(() => {
  const parsed = parseOrgBody(todo.body ?? "");
  setBlocks(parsed);
}, []);

// Track changes
const updateBlock = (id: string, updates: Partial<Block>) => {
  setBlocks((prev) =>
    prev.map((b) => (b.id === id ? { ...b, ...updates } : b)),
  );
  setIsDirty(true);
};

// Save
const save = async () => {
  const body = serializeBlocks(blocks);
  await api.updateTodo(todo, { body });
  setIsDirty(false);
  triggerRefresh(); // From MutationContext
};
```

### Navigation Flow

1. User swipes todo item, taps "Body" button
2. Navigate to `body-editor.tsx` with todo data as route params
3. Editor loads and parses existing body (if any)
4. User edits content, toggles checkboxes, uses toolbar
5. User taps Save or navigates back
6. `api.updateTodo()` called with serialized body
7. MutationContext triggers refresh, navigate back to list

## File Structure

### New Files

- `app/body-editor.tsx` - Full screen editor screen
- `components/BodyEditor/index.tsx` - Main editor component
- `components/BodyEditor/Toolbar.tsx` - Formatting toolbar
- `components/BodyEditor/ChecklistItem.tsx` - Interactive checkbox row
- `utils/orgBody.ts` - Parsing and serialization logic

### Modified Files

- `services/api.ts` - Add `body` to `Todo` and `TodoUpdates` interfaces
- `hooks/useTodoEditing.tsx` - Add `openBodyEditor` action
- `components/TodoItem.tsx` - Add "Body" swipe action button

## Implementation Order

1. Update data model (`api.ts`)
2. Create org parser/serializer (`utils/orgBody.ts`)
3. Build editor components (Toolbar, ChecklistItem, BodyEditor)
4. Create editor screen (`body-editor.tsx`)
5. Wire up swipe action in TodoItem
6. Add tests
