# Todo Edit Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a dedicated edit page for todo items with full editing capabilities, matching capture page features.

**Architecture:** Create a new route at `/app/edit.tsx` that receives todo data via navigation params. Extract shared form components from capture page. Modify TodoItem to navigate on tap instead of opening swipe menu.

**Tech Stack:** React Native, Expo Router, React Native Paper, existing components (StatePicker, PriorityPicker, RepeaterPicker)

---

### Task 1: Add deleteTodo API method

**Files:**

- Modify: `services/api.ts:266-280`

**Step 1: Add DeleteTodoResponse interface**

Add after `UpdateTodoResponse` interface (around line 73):

```typescript
export interface DeleteTodoResponse {
  status: string;
  title?: string;
  message?: string;
}
```

**Step 2: Add deleteTodo method**

Add after `updateTodo` method (around line 280):

```typescript
async deleteTodo(todo: Todo): Promise<DeleteTodoResponse> {
  return this.request<DeleteTodoResponse>("/delete", {
    method: "POST",
    body: JSON.stringify({
      id: todo.id,
      file: todo.file,
      pos: todo.pos,
      title: todo.title,
    }),
  });
}
```

**Step 3: Commit**

```bash
git add services/api.ts
git commit -m "feat(api): add deleteTodo method"
```

---

### Task 2: Extract DateFieldWithQuickActions to shared component

**Files:**

- Create: `components/todoForm/DateFieldWithQuickActions.tsx`
- Modify: `app/(tabs)/capture.tsx`

**Step 1: Create the shared component file**

Create `components/todoForm/DateFieldWithQuickActions.tsx`:

```typescript
import { useColorPalette } from "@/context/ColorPaletteContext";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import React, { useCallback, useState } from "react";
import {
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Button,
  IconButton,
  Text,
} from "react-native-paper";

function formatDateForApi(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatDateForDisplay(dateString: string): string {
  if (dateString.includes("T") || dateString.includes(" ")) {
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTimeForApi(date: Date, includeTime: boolean): string {
  if (includeTime) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }
  return formatDateForApi(date);
}

export interface DateFieldWithQuickActionsProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  colorKey: "schedule" | "deadline";
  includeTime: boolean;
}

export function DateFieldWithQuickActions({
  label,
  value,
  onChange,
  colorKey,
  includeTime,
}: DateFieldWithQuickActionsProps) {
  const { getActionColor } = useColorPalette();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());

  const handleToday = useCallback(() => {
    const today = new Date();
    if (includeTime) {
      const minutes = Math.ceil(today.getMinutes() / 15) * 15;
      today.setMinutes(minutes, 0, 0);
      if (Platform.OS === "web") {
        onChange(formatDateTimeForApi(today, true));
      } else {
        setTempDate(today);
        setShowTimePicker(true);
      }
    } else {
      onChange(formatDateTimeForApi(today, false));
    }
  }, [includeTime, onChange]);

  const handleTomorrow = useCallback(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (includeTime) {
      tomorrow.setHours(9, 0, 0, 0);
      if (Platform.OS === "web") {
        onChange(formatDateTimeForApi(tomorrow, true));
      } else {
        setTempDate(tomorrow);
        setShowTimePicker(true);
      }
    } else {
      onChange(formatDateTimeForApi(tomorrow, false));
    }
  }, [includeTime, onChange]);

  const handleDateChange = useCallback(
    (event: DateTimePickerEvent, date?: Date) => {
      setShowDatePicker(false);
      if (event.type === "dismissed") {
        return;
      }
      if (date) {
        if (includeTime) {
          setTempDate(date);
          setShowTimePicker(true);
        } else {
          onChange(formatDateTimeForApi(date, false));
        }
      }
    },
    [includeTime, onChange],
  );

  const handleTimeChange = useCallback(
    (event: DateTimePickerEvent, date?: Date) => {
      setShowTimePicker(false);
      if (event.type === "dismissed") {
        return;
      }
      if (date) {
        const combined = new Date(tempDate);
        combined.setHours(date.getHours(), date.getMinutes(), 0, 0);
        onChange(formatDateTimeForApi(combined, true));
      }
    },
    [tempDate, onChange],
  );

  const handleClear = useCallback(() => {
    onChange("");
  }, [onChange]);

  const handleOpenPicker = useCallback(() => {
    if (value) {
      const date =
        value.includes("T") || value.includes(" ")
          ? new Date(value.replace(" ", "T"))
          : new Date(value + "T00:00:00");
      setTempDate(date);
    } else {
      setTempDate(new Date());
    }
    setShowDatePicker(true);
  }, [value]);

  const todayColor = getActionColor("today");
  const tomorrowColor = getActionColor("tomorrow");
  const fieldColor = getActionColor(colorKey);

  if (Platform.OS === "web") {
    return (
      <View style={styles.fieldContainer}>
        <Text variant="bodySmall" style={styles.fieldLabel}>
          {label}
        </Text>
        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            style={[styles.quickActionButton, { backgroundColor: todayColor }]}
            onPress={handleToday}
          >
            <Text style={styles.quickActionText}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.quickActionButton,
              { backgroundColor: tomorrowColor },
            ]}
            onPress={handleTomorrow}
          >
            <Text style={styles.quickActionText}>Tomorrow</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.dateInputRow}>
          <input
            type={includeTime ? "datetime-local" : "date"}
            value={
              includeTime && value
                ? value.replace(" ", "T")
                : value.split(" ")[0] || ""
            }
            onChange={(e) => {
              if (e.target.value) {
                const newValue = includeTime
                  ? e.target.value.replace("T", " ")
                  : e.target.value;
                onChange(newValue);
              }
            }}
            style={{
              flex: 1,
              padding: 12,
              fontSize: 16,
              borderRadius: 4,
              border: `1px solid ${fieldColor}`,
              backgroundColor: "transparent",
            }}
          />
          {value && <IconButton icon="close" size={20} onPress={handleClear} />}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fieldContainer}>
      <Text variant="bodySmall" style={styles.fieldLabel}>
        {label}
      </Text>
      <View style={styles.quickActionsRow}>
        <TouchableOpacity
          style={[styles.quickActionButton, { backgroundColor: todayColor }]}
          onPress={handleToday}
        >
          <Text style={styles.quickActionText}>Today</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickActionButton, { backgroundColor: tomorrowColor }]}
          onPress={handleTomorrow}
        >
          <Text style={styles.quickActionText}>Tomorrow</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.dateButtonRow}>
        <Button
          mode="outlined"
          onPress={handleOpenPicker}
          style={[styles.dateButton, { borderColor: fieldColor }]}
          icon="calendar"
        >
          {value ? formatDateForDisplay(value) : `Select ${label}`}
        </Button>
        {value && (
          <IconButton
            icon="close"
            size={20}
            onPress={handleClear}
            style={styles.clearButtonInline}
          />
        )}
      </View>
      {showDatePicker && (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleDateChange}
        />
      )}
      {showTimePicker && (
        <DateTimePicker
          value={tempDate}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleTimeChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    marginBottom: 8,
    opacity: 0.7,
  },
  quickActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  quickActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  quickActionText: {
    color: "white",
    fontSize: 13,
    fontWeight: "600",
  },
  dateInputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dateButtonRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dateButton: {
    flex: 1,
  },
  clearButtonInline: {
    marginLeft: -8,
  },
});
```

**Step 2: Create index.ts for todoForm**

Create `components/todoForm/index.ts`:

```typescript
export { DateFieldWithQuickActions } from "./DateFieldWithQuickActions";
```

**Step 3: Update capture.tsx to use shared component**

In `app/(tabs)/capture.tsx`, replace the import section at the top (add new import):

```typescript
import { DateFieldWithQuickActions } from "@/components/todoForm";
```

Remove the entire `DateFieldWithQuickActions` function definition (lines ~75-298) and its helper functions (`formatDateForApi`, `formatDateForDisplay`, `formatDateTimeForApi` - lines ~39-73).

Also remove these styles from the StyleSheet at the bottom:

- `quickActionsRow`
- `quickActionButton`
- `quickActionText`
- `dateButtonRow`
- `clearButtonInline`

Keep only: `dateInputRow` (used by PromptField).

**Step 4: Commit**

```bash
git add components/todoForm/DateFieldWithQuickActions.tsx components/todoForm/index.ts app/\(tabs\)/capture.tsx
git commit -m "refactor: extract DateFieldWithQuickActions to shared component"
```

---

### Task 3: Create the Edit page

**Files:**

- Create: `app/edit.tsx`

**Step 1: Create the edit page**

Create `app/edit.tsx`:

```typescript
import { BodyEditor } from "@/components/BodyEditor";
import { PriorityPicker, StatePicker } from "@/components/capture";
import { RepeaterPicker } from "@/components/RepeaterPicker";
import { DateFieldWithQuickActions } from "@/components/todoForm";
import { useMutation } from "@/context/MutationContext";
import { useSettings } from "@/context/SettingsContext";
import { useTemplates } from "@/context/TemplatesContext";
import { api, Repeater, Todo, TodoUpdates } from "@/services/api";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  Appbar,
  Button,
  Chip,
  Dialog,
  Portal,
  Snackbar,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

export default function EditScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { triggerRefresh } = useMutation();
  const { quickScheduleIncludeTime } = useSettings();
  const { todoStates } = useTemplates();

  const params = useLocalSearchParams<{
    todo: string;
  }>();

  // Parse todo from params
  const originalTodo: Todo = useMemo(() => {
    if (params.todo) {
      try {
        return JSON.parse(params.todo);
      } catch {
        console.error("Failed to parse todo from params");
      }
    }
    return {
      id: null,
      file: null,
      pos: null,
      title: "",
      todo: "TODO",
      tags: null,
      level: 1,
      scheduled: null,
      scheduledRepeater: null,
      deadline: null,
      deadlineRepeater: null,
      priority: null,
      olpath: null,
      notifyBefore: null,
      body: null,
    };
  }, [params.todo]);

  // Form state
  const [title, setTitle] = useState(originalTodo.title);
  const [todoState, setTodoState] = useState(originalTodo.todo || "TODO");
  const [priority, setPriority] = useState<string | null>(originalTodo.priority);
  const [scheduled, setScheduled] = useState(originalTodo.scheduled || "");
  const [scheduledRepeater, setScheduledRepeater] = useState<Repeater | null>(
    originalTodo.scheduledRepeater
  );
  const [deadline, setDeadline] = useState(originalTodo.deadline || "");
  const [deadlineRepeater, setDeadlineRepeater] = useState<Repeater | null>(
    originalTodo.deadlineRepeater
  );
  const [tags, setTags] = useState(originalTodo.tags?.join(", ") || "");
  const [body, setBody] = useState(originalTodo.body || "");
  const [bodyExpanded, setBodyExpanded] = useState(!!originalTodo.body);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [snackbar, setSnackbar] = useState({ visible: false, message: "", isError: false });

  const bodyRef = useRef(body);
  bodyRef.current = body;

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      setSnackbar({ visible: true, message: "Title is required", isError: true });
      return;
    }

    setIsSaving(true);
    try {
      // Check if state changed
      const stateChanged = todoState !== originalTodo.todo;

      // Build updates object
      const updates: TodoUpdates = {};

      if (scheduled !== (originalTodo.scheduled || "")) {
        updates.scheduled = scheduled || null;
      }
      if (JSON.stringify(scheduledRepeater) !== JSON.stringify(originalTodo.scheduledRepeater)) {
        updates.scheduledRepeater = scheduledRepeater;
      }
      if (deadline !== (originalTodo.deadline || "")) {
        updates.deadline = deadline || null;
      }
      if (JSON.stringify(deadlineRepeater) !== JSON.stringify(originalTodo.deadlineRepeater)) {
        updates.deadlineRepeater = deadlineRepeater;
      }
      if (priority !== originalTodo.priority) {
        updates.priority = priority;
      }
      if (body !== (originalTodo.body || "")) {
        updates.body = body || null;
      }

      // Apply updates if any
      if (Object.keys(updates).length > 0) {
        const result = await api.updateTodo(originalTodo, updates);
        if (result.status !== "updated") {
          setSnackbar({
            visible: true,
            message: result.message || "Failed to update",
            isError: true,
          });
          setIsSaving(false);
          return;
        }
      }

      // Handle state change separately
      if (stateChanged) {
        const stateResult = await api.setTodoState(originalTodo, todoState);
        if (stateResult.status !== "completed") {
          setSnackbar({
            visible: true,
            message: stateResult.message || "Failed to change state",
            isError: true,
          });
          setIsSaving(false);
          return;
        }
      }

      triggerRefresh();
      setSnackbar({ visible: true, message: "Saved", isError: false });

      // Navigate back after brief delay to show success
      setTimeout(() => router.back(), 500);
    } catch (err) {
      console.error("Failed to save:", err);
      setSnackbar({ visible: true, message: "Failed to save", isError: true });
    } finally {
      setIsSaving(false);
    }
  }, [
    title,
    todoState,
    priority,
    scheduled,
    scheduledRepeater,
    deadline,
    deadlineRepeater,
    body,
    originalTodo,
    triggerRefresh,
    router,
  ]);

  const handleDelete = useCallback(async () => {
    setDeleteDialogVisible(false);
    setIsDeleting(true);
    try {
      const result = await api.deleteTodo(originalTodo);
      if (result.status === "deleted") {
        triggerRefresh();
        router.back();
      } else {
        setSnackbar({
          visible: true,
          message: result.message || "Failed to delete",
          isError: true,
        });
      }
    } catch (err) {
      console.error("Failed to delete:", err);
      setSnackbar({ visible: true, message: "Failed to delete", isError: true });
    } finally {
      setIsDeleting(false);
    }
  }, [originalTodo, triggerRefresh, router]);

  const handleRemind = useCallback(() => {
    // Navigate to set reminder - reuse existing remind modal logic
    // For now, we can show a snackbar indicating this feature
    setSnackbar({ visible: true, message: "Reminder feature coming soon", isError: false });
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} testID="back-button" />
        <Appbar.Content title="Edit Todo" />
        <Appbar.Action
          icon="delete"
          onPress={() => setDeleteDialogVisible(true)}
          disabled={isDeleting}
          iconColor={theme.colors.error}
          testID="delete-button"
        />
      </Appbar.Header>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Read-only category display */}
        {originalTodo.file && (
          <View style={styles.categoryContainer}>
            <Text variant="bodySmall" style={[styles.categoryLabel, { color: theme.colors.outline }]}>
              {originalTodo.file}
            </Text>
          </View>
        )}

        {/* Title */}
        <TextInput
          label="Title *"
          value={title}
          onChangeText={setTitle}
          mode="outlined"
          style={styles.input}
          multiline
          numberOfLines={2}
        />

        {/* State */}
        <StatePicker
          value={todoState}
          onChange={setTodoState}
        />

        {/* Priority */}
        <PriorityPicker
          value={priority}
          onChange={setPriority}
        />

        {/* Scheduled */}
        <DateFieldWithQuickActions
          label="Schedule"
          value={scheduled}
          onChange={setScheduled}
          colorKey="schedule"
          includeTime={quickScheduleIncludeTime}
        />

        <RepeaterPicker
          value={scheduledRepeater}
          onChange={setScheduledRepeater}
          label="Schedule Repeater"
        />

        {/* Deadline */}
        <DateFieldWithQuickActions
          label="Deadline"
          value={deadline}
          onChange={setDeadline}
          colorKey="deadline"
          includeTime={quickScheduleIncludeTime}
        />

        <RepeaterPicker
          value={deadlineRepeater}
          onChange={setDeadlineRepeater}
          label="Deadline Repeater"
        />

        {/* Tags */}
        <TextInput
          label="Tags (comma-separated)"
          value={tags}
          onChangeText={setTags}
          mode="outlined"
          style={styles.input}
        />

        {/* Body - Collapsible */}
        {bodyExpanded ? (
          <View style={styles.bodyContainer}>
            <Text variant="bodySmall" style={styles.fieldLabel}>Body</Text>
            <TextInput
              value={body}
              onChangeText={setBody}
              mode="outlined"
              multiline
              numberOfLines={6}
              style={styles.bodyInput}
            />
          </View>
        ) : (
          <Button
            mode="outlined"
            onPress={() => setBodyExpanded(true)}
            style={styles.addBodyButton}
            icon="text"
          >
            Add Body
          </Button>
        )}

        {/* Remind button */}
        <Button
          mode="outlined"
          onPress={handleRemind}
          style={styles.remindButton}
          icon="bell"
        >
          Set Reminder
        </Button>

        {/* Save button */}
        <Button
          mode="contained"
          onPress={handleSave}
          loading={isSaving}
          disabled={isSaving || isDeleting}
          style={styles.saveButton}
          icon="content-save"
        >
          Save
        </Button>
      </ScrollView>

      {/* Delete confirmation dialog */}
      <Portal>
        <Dialog visible={deleteDialogVisible} onDismiss={() => setDeleteDialogVisible(false)}>
          <Dialog.Title>Delete Todo?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{originalTodo.title}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleDelete} textColor={theme.colors.error}>Delete</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar((s) => ({ ...s, visible: false }))}
        duration={2000}
        style={snackbar.isError ? { backgroundColor: theme.colors.error } : undefined}
      >
        {snackbar.message}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  categoryContainer: {
    marginBottom: 16,
  },
  categoryLabel: {
    fontFamily: "monospace",
  },
  input: {
    marginBottom: 16,
  },
  fieldLabel: {
    marginBottom: 8,
    opacity: 0.7,
  },
  bodyContainer: {
    marginBottom: 16,
  },
  bodyInput: {
    minHeight: 120,
  },
  addBodyButton: {
    marginBottom: 16,
  },
  remindButton: {
    marginBottom: 16,
  },
  saveButton: {
    marginTop: 8,
  },
});
```

**Step 2: Commit**

```bash
git add app/edit.tsx
git commit -m "feat: add todo edit page"
```

---

### Task 4: Update TodoItem to navigate to edit page

**Files:**

- Modify: `components/TodoItem.tsx`

**Step 1: Add navigation import and update press handler**

In `components/TodoItem.tsx`, add router import at the top:

```typescript
import { useRouter } from "expo-router";
```

**Step 2: Update TodoItem component**

Inside the `TodoItem` function, add router:

```typescript
const router = useRouter();
```

**Step 3: Replace handleBodyPress with handlePress**

Replace the `handleBodyPress` callback with a new `handlePress` that navigates:

```typescript
const handlePress = useCallback(() => {
  router.push({
    pathname: "/edit",
    params: {
      todo: JSON.stringify(todo),
    },
  });
}, [router, todo]);
```

**Step 4: Update the Pressable onPress**

Change `onPress={handleBodyPress}` to `onPress={handlePress}` in the Pressable component.

**Step 5: Remove openSwipeable from the callback**

Since we no longer need to open swipeable on press, remove `openSwipeable` from the destructured context if it's no longer used elsewhere in TodoItem.

**Step 6: Commit**

```bash
git add components/TodoItem.tsx
git commit -m "feat(TodoItem): navigate to edit page on press"
```

---

### Task 5: Update swipe actions (remove Body/Remind, add Delete)

**Files:**

- Modify: `components/TodoItem.tsx`
- Modify: `hooks/useTodoEditing.tsx`

**Step 1: Add delete functionality to useTodoEditing**

In `hooks/useTodoEditing.tsx`, add delete-related state and functions.

Add after line ~119 (after updatingIds state):

```typescript
const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
const [deleteConfirmTodo, setDeleteConfirmTodo] = useState<Todo | null>(null);
```

Add delete handler after `handleStateChange` function:

```typescript
const handleDeleteTodo = useCallback(
  async (todo: Todo) => {
    const key = getTodoKey(todo);
    setDeletingIds((prev) => new Set(prev).add(key));
    setDeleteConfirmTodo(null);

    try {
      const result = await api.deleteTodo(todo);
      if (result.status === "deleted") {
        setSnackbar({
          visible: true,
          message: `Deleted: ${todo.title}`,
          isError: false,
        });
        triggerRefresh();
      } else {
        setSnackbar({
          visible: true,
          message: result.message || "Failed to delete",
          isError: true,
        });
      }
    } catch (err) {
      console.error("Failed to delete todo:", err);
      setSnackbar({
        visible: true,
        message: "Failed to delete todo",
        isError: true,
      });
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  },
  [triggerRefresh],
);

const openDeleteConfirm = useCallback((todo: Todo) => {
  const key = getTodoKey(todo);
  swipeableRefs.current.get(key)?.close();
  setDeleteConfirmTodo(todo);
}, []);

const closeDeleteConfirm = useCallback(() => {
  setDeleteConfirmTodo(null);
}, []);
```

**Step 2: Add delete confirmation modal to EditModals**

In the `EditModals` callback, add the delete confirmation dialog inside the `<Portal>`:

```typescript
{/* Delete Confirmation Dialog */}
<Dialog visible={!!deleteConfirmTodo} onDismiss={closeDeleteConfirm}>
  <Dialog.Title>Delete Todo?</Dialog.Title>
  <Dialog.Content>
    <Text variant="bodyMedium">{deleteConfirmTodo?.title}</Text>
  </Dialog.Content>
  <Dialog.Actions>
    <Button onPress={closeDeleteConfirm}>Cancel</Button>
    <Button
      onPress={() => deleteConfirmTodo && handleDeleteTodo(deleteConfirmTodo)}
      textColor={theme.colors.error}
    >
      Delete
    </Button>
  </Dialog.Actions>
</Dialog>
```

Add `Dialog` to the react-native-paper imports.

**Step 3: Export delete functions**

Update the return statement and interface to include:

```typescript
// In UseTodoEditingResult interface:
deletingIds: Set<string>;
openDeleteConfirm: (todo: Todo) => void;

// In return statement:
deletingIds,
openDeleteConfirm,
```

**Step 4: Update TodoItem swipe actions**

In `components/TodoItem.tsx`, update the `renderRightActions` to remove Body and Remind, add Delete:

```typescript
const renderRightActions = useCallback(() => {
  return (
    <View style={styles.swipeActions}>
      <TouchableOpacity
        testID={`tomorrowActionButton_${testIdSuffix}`}
        style={[
          styles.swipeAction,
          { backgroundColor: getActionColor("tomorrow") },
        ]}
        onPress={() => scheduleTomorrow(todo)}
      >
        <Text style={styles.swipeActionText}>Tomorrow</Text>
      </TouchableOpacity>
      <TouchableOpacity
        testID={`scheduleActionButton_${testIdSuffix}`}
        style={[
          styles.swipeAction,
          { backgroundColor: getActionColor("schedule") },
        ]}
        onPress={() => openScheduleModal(todo)}
      >
        <Text style={styles.swipeActionText}>Schedule</Text>
      </TouchableOpacity>
      <TouchableOpacity
        testID={`deadlineActionButton_${testIdSuffix}`}
        style={[
          styles.swipeAction,
          { backgroundColor: getActionColor("deadline") },
        ]}
        onPress={() => openDeadlineModal(todo)}
      >
        <Text style={styles.swipeActionText}>Deadline</Text>
      </TouchableOpacity>
      <TouchableOpacity
        testID={`todayActionButton_${testIdSuffix}`}
        style={[
          styles.swipeAction,
          { backgroundColor: getActionColor("today") },
        ]}
        onPress={() => scheduleToday(todo)}
      >
        <Text style={styles.swipeActionText}>Today</Text>
      </TouchableOpacity>
      <TouchableOpacity
        testID={`deleteActionButton_${testIdSuffix}`}
        style={[
          styles.swipeAction,
          { backgroundColor: theme.colors.error },
        ]}
        onPress={() => openDeleteConfirm(todo)}
      >
        <Text style={styles.swipeActionText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );
}, [
  testIdSuffix,
  getActionColor,
  theme.colors.error,
  todo,
  scheduleToday,
  scheduleTomorrow,
  openScheduleModal,
  openDeadlineModal,
  openDeleteConfirm,
]);
```

Update the destructured values from `useTodoEditingContext`:

```typescript
const {
  completingIds,
  updatingIds,
  swipeableRefs,
  handleTodoPress,
  scheduleToday,
  scheduleTomorrow,
  openScheduleModal,
  openDeadlineModal,
  openDeleteConfirm,
} = useTodoEditingContext();
```

Remove `openRemindModal`, `openBodyEditor`, `openSwipeable` since they're no longer needed.

**Step 5: Commit**

```bash
git add components/TodoItem.tsx hooks/useTodoEditing.tsx
git commit -m "feat: update swipe actions - remove Body/Remind, add Delete"
```

---

### Task 6: Integrate reminder functionality in edit page

**Files:**

- Modify: `app/edit.tsx`

**Step 1: Import notification service**

Add import:

```typescript
import { scheduleCustomNotification } from "@/services/notifications";
```

**Step 2: Add reminder state**

Add state for reminder modal:

```typescript
const [remindDialogVisible, setRemindDialogVisible] = useState(false);
const [remindDateTime, setRemindDateTime] = useState<Date>(() => {
  const date = new Date();
  date.setHours(date.getHours() + 1);
  date.setMinutes(0, 0, 0);
  return date;
});
```

**Step 3: Update handleRemind**

```typescript
const handleRemind = useCallback(() => {
  setRemindDialogVisible(true);
}, []);

const handleScheduleReminder = useCallback(async () => {
  const now = new Date();
  if (remindDateTime <= now) {
    setSnackbar({
      visible: true,
      message: "Please select a future time",
      isError: true,
    });
    return;
  }

  const result = await scheduleCustomNotification(originalTodo, remindDateTime);
  if (result) {
    setSnackbar({
      visible: true,
      message: `Reminder set for ${remindDateTime.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}`,
      isError: false,
    });
    setRemindDialogVisible(false);
  } else {
    setSnackbar({
      visible: true,
      message: "Failed to schedule reminder",
      isError: true,
    });
  }
}, [originalTodo, remindDateTime]);
```

**Step 4: Add reminder dialog to Portal**

Add after the delete dialog:

```typescript
<Dialog visible={remindDialogVisible} onDismiss={() => setRemindDialogVisible(false)}>
  <Dialog.Title>Set Reminder</Dialog.Title>
  <Dialog.Content>
    <Text variant="bodyMedium" style={{ marginBottom: 16 }}>{originalTodo.title}</Text>
    {Platform.OS === "web" ? (
      <input
        type="datetime-local"
        value={`${remindDateTime.getFullYear()}-${String(remindDateTime.getMonth() + 1).padStart(2, "0")}-${String(remindDateTime.getDate()).padStart(2, "0")}T${String(remindDateTime.getHours()).padStart(2, "0")}:${String(remindDateTime.getMinutes()).padStart(2, "0")}`}
        onChange={(e) => {
          const parsed = new Date(e.target.value);
          if (!isNaN(parsed.getTime())) {
            setRemindDateTime(parsed);
          }
        }}
        style={{
          padding: 12,
          fontSize: 16,
          borderRadius: 8,
          border: `1px solid ${theme.colors.outline}`,
        }}
      />
    ) : (
      <Text variant="bodySmall">
        {remindDateTime.toLocaleString([], {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </Text>
    )}
  </Dialog.Content>
  <Dialog.Actions>
    <Button onPress={() => setRemindDialogVisible(false)}>Cancel</Button>
    <Button onPress={handleScheduleReminder}>Set Reminder</Button>
  </Dialog.Actions>
</Dialog>
```

Add `Platform` to the imports from "react-native".

**Step 5: Commit**

```bash
git add app/edit.tsx
git commit -m "feat(edit): integrate reminder functionality"
```

---

### Task 7: Clean up unused code

**Files:**

- Modify: `hooks/useTodoEditing.tsx`

**Step 1: Remove openBodyEditor since it's no longer used**

Remove the `openBodyEditor` function and its export from the interface and return statement. It's no longer needed since the edit page handles body editing.

Also remove `openSwipeable` if no longer needed.

**Step 2: Commit**

```bash
git add hooks/useTodoEditing.tsx
git commit -m "refactor: remove unused openBodyEditor function"
```

---

### Task 8: Test the implementation

**Step 1: Run the app**

```bash
cd /home/imalison/Projects/mova && npx expo start
```

**Step 2: Manual testing checklist**

- [ ] Tap on a todo item → navigates to edit page
- [ ] Edit page shows correct todo data pre-populated
- [ ] File path shown as read-only at top
- [ ] Can edit title, state, priority, scheduled, deadline, tags
- [ ] Repeaters work for both scheduled and deadline
- [ ] Body section is collapsed if empty, expanded if has content
- [ ] "Add Body" button expands body section
- [ ] "Set Reminder" button opens reminder dialog
- [ ] Save button updates the todo
- [ ] Delete button (header) shows confirmation, deletes on confirm
- [ ] Back button returns to previous screen
- [ ] Swipe actions work: Today, Tomorrow, Schedule, Deadline, Delete
- [ ] Delete in swipe shows confirmation dialog
- [ ] Body and Remind no longer in swipe actions

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete todo edit page implementation"
```
