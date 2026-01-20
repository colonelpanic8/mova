# Todo Edit Page Design

## Overview

Add a dedicated edit page for todo items that provides full editing capabilities, matching the capture page features. Clicking on a todo item navigates to this edit page instead of opening a swipe menu.

## Navigation & Routing

**New Route**: `/app/(tabs)/edit/[id].tsx`

The edit page is a dynamic route taking the todo's ID as a parameter.

**TodoItem behavior changes**:
- All taps (except swipe gestures) navigate to `/edit/{todoId}`
- State chip no longer toggles inline - tapping it also navigates to edit
- Swipe gestures continue to reveal quick actions

**Updated swipe actions**:
- Today
- Tomorrow
- Schedule
- Deadline
- Delete (with confirmation modal)

**Removed from swipe** (moved to edit page):
- Body
- Remind

**Back navigation**: Standard back button/gesture returning to previous screen.

## Edit Page Layout

**Header**:
- Back button (left)
- "Edit Todo" title (center)
- Delete button (right, red) - triggers confirmation modal

**Read-only context** (top):
- Display file/category path as muted text (e.g., "work/projects.org")

**Form fields** (matching capture page order):
1. **Title** - Text input, pre-populated
2. **State** - StatePicker component (reused)
3. **Priority** - PriorityPicker component (reused)
4. **Scheduled** - Date picker with repeater support (reused)
5. **Deadline** - Date picker with repeater support (reused)
6. **Tags** - Text input for comma-separated tags
7. **Body** - Collapsible text area (expanded if content exists, collapsed if empty)
8. **Remind** - "Set Reminder" button opening existing picker

**Footer**:
- "Save" button - submits all changes via API

## Data Flow & API

**Passing data via navigation** (preferred):
- TodoItem passes full todo object as route param when navigating
- Avoids extra API call since data is already loaded
- Example: `router.push({ pathname: '/edit/[id]', params: { id: todo.id, todo: JSON.stringify(todo) } })`

**Saving changes**:
- Use existing `updateTodo` API method
- On success: trigger mutation context, navigate back
- On error: show error snackbar, stay on page

**Delete flow**:
- Confirmation modal: "Delete this todo?" with Cancel/Delete buttons
- Use `deleteTodo` API method
- On success: trigger mutation, navigate back
- On error: show error snackbar

## Code Sharing & Refactoring

**Already reusable components**:
- `StatePicker`
- `PriorityPicker`
- `RepeaterPicker`

**Extract from capture.tsx**:
- Date/time picker logic with "Today"/"Tomorrow" quick actions
- Scheduled/deadline field group (date + optional repeater)
- Tags input field

**Shared component approach**:
Create `components/todoForm/TodoFormFields.tsx` containing common fields. Both capture and edit pages import this, passing:
- `values` - current form values
- `onChange` - handler for field changes
- `showCategory` - boolean (capture: editable, edit: read-only)

**Capture-specific** (stays in capture.tsx):
- Template selector dropdown
- Category field (editable)
- Template prompts handling

**Edit-specific** (new edit page):
- Read-only category display
- Delete button/confirmation
- Remind button

## UX Details

**Loading states**:
- Save button shows loading state during API call
- Delete confirmation shows loading during deletion

**Validation**:
- Title required (match capture behavior)
- Other fields optional
- Show error if saving with empty title

**Body field collapsible behavior**:
- Has content: starts expanded
- Empty/null: starts collapsed with "Add body" tap target
- Tapping collapsed section expands with text area focused

**Delete confirmation modal**:
- Title: "Delete Todo?"
- Message: Shows todo title for clarity
- Buttons: "Cancel" (secondary) | "Delete" (destructive/red)

**Keyboard handling**:
- Dismiss keyboard on scroll
- "Done" button on keyboard to dismiss
- Save button accessible when keyboard is open

## Files to Create/Modify

**New files**:
- `/app/(tabs)/edit/[id].tsx` - Edit page
- `/components/todoForm/TodoFormFields.tsx` - Shared form fields

**Modify**:
- `/components/TodoItem.tsx` - Change click to navigate, update swipe actions (remove Body/Remind, add Delete)
- `/app/(tabs)/capture.tsx` - Extract shared fields to use TodoFormFields
- `/services/api.ts` - Add `deleteTodo` if not present
