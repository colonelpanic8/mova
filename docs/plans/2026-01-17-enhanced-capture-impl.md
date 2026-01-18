# Enhanced Capture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend Quick Capture to support all update fields (scheduled, deadline, priority, tags, todo state) in a collapsible options section.

**Architecture:** API-first approach - extend org-agenda-api's `/create-todo` endpoint to accept optional fields, then add collapsible UI to mova's capture screen using existing PromptField components.

**Tech Stack:** Emacs Lisp (org-agenda-api), React Native + TypeScript (mova), react-native-paper components

---

## Phase 1: API Changes (org-agenda-api)

> **Note:** This phase works in `/home/imalison/Projects/org-agenda-api`, not the mova worktree.

### Task 1.1: Extend create-todo endpoint to accept optional fields

**Files:**

- Modify: `/home/imalison/Projects/org-agenda-api/org-agenda-api.el` (lines 907-925)

**Step 1: Update the create-todo servlet to parse additional fields**

Find the `defservlet create-todo` around line 907 and update it:

```elisp
(defservlet create-todo application/json (_path _query headers)
  "Endpoint: Create a new TODO item from JSON body.
Accepts:
  - title: (required) The TODO title
  - scheduled: (optional) ISO date string YYYY-MM-DD
  - deadline: (optional) ISO date string YYYY-MM-DD
  - priority: (optional) A, B, or C
  - tags: (optional) array of tag strings
  - todo: (optional) TODO state, defaults to TODO"
  (org-agenda-api--log-request "/create-todo" "POST")
  (let ((start-time (current-time)))
    (condition-case err
        (let* ((content-header (cadr (assoc "Content" headers)))
               (json-data (json-parse-string content-header))
               (title (gethash "title" json-data))
               (scheduled (gethash "scheduled" json-data))
               (deadline (gethash "deadline" json-data))
               (priority (gethash "priority" json-data))
               (tags (gethash "tags" json-data))
               (todo-state (or (gethash "todo" json-data) "TODO")))
          (org-agenda-api--log 'debug "Creating todo: %s (scheduled=%s deadline=%s priority=%s tags=%s state=%s)"
                               title scheduled deadline priority tags todo-state)
          (org-agenda-api--capture-extended title scheduled deadline priority tags todo-state)
          (let ((duration-ms (round (* 1000 (float-time (time-subtract (current-time) start-time))))))
            (org-agenda-api--log-response "/create-todo" "created" duration-ms))
          (insert (json-encode `(("status" . "created")
                                 ("title" . ,title)))))
      (error
       (org-agenda-api--log-error-with-backtrace "/create-todo" err)
       (insert (json-encode `(("status" . "error")
                              ("message" . ,(error-message-string err))))))))
  (org-agenda-api--track-request))
```

**Step 2: Create the capture-extended function**

Add this new function after `org-agenda-api--capture` (around line 682):

```elisp
(defun org-agenda-api--capture-extended (title &optional scheduled deadline priority tags todo-state)
  "Capture a new TODO with TITLE and optional fields.
SCHEDULED and DEADLINE are ISO date strings.
PRIORITY is A, B, or C.
TAGS is a list/vector of tag strings.
TODO-STATE defaults to TODO."
  (org-agenda-api--log 'debug "Starting extended capture for: %s" title)
  (org-agenda-api--cleanup-emacs-state)
  (let* ((todo-state (or todo-state "TODO"))
         (tags-str (when tags
                     (let ((tag-list (if (vectorp tags) (append tags nil) tags)))
                       (when (> (length tag-list) 0)
                         (concat " :" (mapconcat #'identity tag-list ":") ":")))))
         (priority-str (when (and priority (member priority '("A" "B" "C")))
                         (format " [#%s]" priority)))
         (headline (format "* %s%s %s%s"
                           todo-state
                           (or priority-str "")
                           title
                           (or tags-str "")))
         (planning-line (concat
                         (when scheduled
                           (format "SCHEDULED: <%s>" scheduled))
                         (when (and scheduled deadline) " ")
                         (when deadline
                           (format "DEADLINE: <%s>" deadline)))))
    (with-current-buffer (find-file-noselect org-agenda-api-inbox-file)
      (goto-char (point-max))
      (unless (bolp) (insert "\n"))
      (insert headline "\n")
      (when (not (string-empty-p planning-line))
        (insert planning-line "\n"))
      (save-buffer))
    (org-agenda-api--invalidate-cache)
    (org-agenda-api--log 'debug "Extended capture complete")))
```

**Step 3: Test the API manually**

```bash
# Test basic create (should still work)
curl -X POST http://localhost:2025/create-todo \
  -H "Content-Type: application/json" \
  -d '{"title": "Test basic todo"}'

# Test with all fields
curl -X POST http://localhost:2025/create-todo \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test extended todo",
    "scheduled": "2026-01-20",
    "deadline": "2026-01-25",
    "priority": "A",
    "tags": ["work", "urgent"],
    "todo": "NEXT"
  }'
```

**Step 4: Commit**

```bash
cd /home/imalison/Projects/org-agenda-api
git add org-agenda-api.el
git commit -m "$(cat <<'EOF'
feat: extend /create-todo to accept optional fields

Add support for scheduled, deadline, priority, tags, and todo state
when creating new TODOs via the API.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2: Update mova API Client

### Task 2.1: Extend createTodo type and method

**Files:**

- Modify: `services/api.ts`
- Test: `tests/unit/api.test.ts`

**Step 1: Write the failing test**

Add to `tests/unit/api.test.ts`:

```typescript
describe("createTodo", () => {
  it("should make POST request to /create-todo with title", async () => {
    // ... existing test
  });

  it("should make POST request with optional fields", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "created", title: "Test" }),
    });
    global.fetch = mockFetch;

    api.configure("http://test.com", "user", "pass");
    await api.createTodo("Test todo", {
      scheduled: "2026-01-20",
      deadline: "2026-01-25",
      priority: "A",
      tags: ["work", "urgent"],
      todo: "NEXT",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "http://test.com/create-todo",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          title: "Test todo",
          scheduled: "2026-01-20",
          deadline: "2026-01-25",
          priority: "A",
          tags: ["work", "urgent"],
          todo: "NEXT",
        }),
      }),
    );
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /home/imalison/Projects/mova/.worktrees/enhanced-capture
npm run test:unit -- --testNamePattern="createTodo.*optional"
```

Expected: FAIL - createTodo doesn't accept second argument

**Step 3: Add CreateTodoOptions interface and update createTodo**

In `services/api.ts`, add the interface after `TodoUpdates`:

```typescript
export interface CreateTodoOptions {
  scheduled?: string;
  deadline?: string;
  priority?: string;
  tags?: string[];
  todo?: string;
}
```

Update the `createTodo` method:

```typescript
async createTodo(
  title: string,
  options?: CreateTodoOptions
): Promise<CreateTodoResponse> {
  return this.request<CreateTodoResponse>("/create-todo", {
    method: "POST",
    body: JSON.stringify({ title, ...options }),
  });
}
```

**Step 4: Run test to verify it passes**

```bash
npm run test:unit -- --testNamePattern="createTodo"
```

Expected: PASS

**Step 5: Commit**

```bash
git add services/api.ts tests/unit/api.test.ts
git commit -m "$(cat <<'EOF'
feat(api): extend createTodo to accept optional fields

Add CreateTodoOptions interface for scheduled, deadline, priority,
tags, and todo state when creating new TODOs.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3: Build Capture UI Components

### Task 3.1: Create StatePicker component

**Files:**

- Create: `components/capture/StatePicker.tsx`
- Test: (visual testing for now)

**Step 1: Create the StatePicker component**

```typescript
// components/capture/StatePicker.tsx
import { api, TodoStatesResponse } from "@/services/api";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Chip, Text } from "react-native-paper";

interface StatePickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function StatePicker({ value, onChange }: StatePickerProps) {
  const [states, setStates] = useState<TodoStatesResponse | null>(null);

  useEffect(() => {
    api.getTodoStates().then(setStates).catch(console.error);
  }, []);

  const allStates = states
    ? [...states.active, ...states.done]
    : ["TODO", "NEXT", "WAITING", "DONE"];

  return (
    <View style={styles.container}>
      <Text variant="bodySmall" style={styles.label}>
        State
      </Text>
      <View style={styles.chips}>
        {allStates.slice(0, 4).map((state) => (
          <Chip
            key={state}
            selected={value === state}
            onPress={() => onChange(state)}
            style={styles.chip}
            compact
          >
            {state}
          </Chip>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
    opacity: 0.7,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    marginRight: 4,
  },
});
```

**Step 2: Commit**

```bash
mkdir -p components/capture
git add components/capture/StatePicker.tsx
git commit -m "$(cat <<'EOF'
feat: add StatePicker component for capture

Chip-based state selector that fetches available states from API.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

### Task 3.2: Create PriorityPicker component

**Files:**

- Create: `components/capture/PriorityPicker.tsx`

**Step 1: Create the PriorityPicker component**

```typescript
// components/capture/PriorityPicker.tsx
import React from "react";
import { StyleSheet, View } from "react-native";
import { Chip, Text } from "react-native-paper";

interface PriorityPickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

const PRIORITIES = [
  { value: null, label: "None" },
  { value: "A", label: "A" },
  { value: "B", label: "B" },
  { value: "C", label: "C" },
];

export function PriorityPicker({ value, onChange }: PriorityPickerProps) {
  return (
    <View style={styles.container}>
      <Text variant="bodySmall" style={styles.label}>
        Priority
      </Text>
      <View style={styles.chips}>
        {PRIORITIES.map((p) => (
          <Chip
            key={p.label}
            selected={value === p.value}
            onPress={() => onChange(p.value)}
            style={styles.chip}
            compact
          >
            {p.label}
          </Chip>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
    opacity: 0.7,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    marginRight: 4,
  },
});
```

**Step 2: Commit**

```bash
git add components/capture/PriorityPicker.tsx
git commit -m "$(cat <<'EOF'
feat: add PriorityPicker component for capture

Chip-based priority selector (None, A, B, C).

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

### Task 3.3: Create ExpandableOptions component

**Files:**

- Create: `components/capture/ExpandableOptions.tsx`

**Step 1: Create the ExpandableOptions component**

```typescript
// components/capture/ExpandableOptions.tsx
import React, { useState } from "react";
import { LayoutAnimation, Platform, StyleSheet, UIManager, View } from "react-native";
import { Button, Divider } from "react-native-paper";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface ExpandableOptionsProps {
  children: React.ReactNode;
}

export function ExpandableOptions({ children }: ExpandableOptionsProps) {
  const [expanded, setExpanded] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  return (
    <View style={styles.container}>
      <Button
        mode="text"
        onPress={toggle}
        icon={expanded ? "chevron-up" : "chevron-down"}
        contentStyle={styles.buttonContent}
        style={styles.button}
      >
        {expanded ? "Less options" : "More options"}
      </Button>

      {expanded && (
        <>
          <Divider style={styles.divider} />
          <View style={styles.optionsContainer}>{children}</View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  button: {
    alignSelf: "flex-start",
  },
  buttonContent: {
    flexDirection: "row-reverse",
  },
  divider: {
    marginVertical: 8,
  },
  optionsContainer: {
    paddingTop: 8,
  },
});
```

**Step 2: Commit**

```bash
git add components/capture/ExpandableOptions.tsx
git commit -m "$(cat <<'EOF'
feat: add ExpandableOptions component for capture

Collapsible container with animated expand/collapse.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

### Task 3.4: Create index export for capture components

**Files:**

- Create: `components/capture/index.ts`

**Step 1: Create the index file**

```typescript
// components/capture/index.ts
export { ExpandableOptions } from "./ExpandableOptions";
export { PriorityPicker } from "./PriorityPicker";
export { StatePicker } from "./StatePicker";
```

**Step 2: Commit**

```bash
git add components/capture/index.ts
git commit -m "$(cat <<'EOF'
chore: add index exports for capture components

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4: Integrate into Capture Screen

### Task 4.1: Update Quick Capture to use new components

**Files:**

- Modify: `app/(tabs)/capture.tsx`

**Step 1: Add imports for new components**

At the top of `capture.tsx`, add:

```typescript
import {
  ExpandableOptions,
  PriorityPicker,
  StatePicker,
} from "@/components/capture";
```

**Step 2: Add state for optional fields**

Inside `CaptureScreen`, after the existing `useState` calls, add:

```typescript
const [optionalFields, setOptionalFields] = useState<{
  scheduled?: string;
  deadline?: string;
  priority?: string | null;
  tags?: string[];
  todo?: string;
}>({});
```

**Step 3: Create helper to update optional fields**

Add this helper function:

```typescript
const handleOptionalFieldChange = <K extends keyof typeof optionalFields>(
  field: K,
  value: (typeof optionalFields)[K],
) => {
  setOptionalFields((prev) => ({ ...prev, [field]: value }));
};
```

**Step 4: Update the Quick Capture handleCapture to pass optional fields**

In the `handleCapture` function, update the Quick Capture branch (around line 250):

```typescript
if (isQuickCapture) {
  const title =
    typeof values["title"] === "string" ? values["title"].trim() : "";
  if (!title) {
    setMessage({ text: "Please enter a title", isError: true });
    setSubmitting(false);
    return;
  }

  // Build options from optional fields, filtering out empty values
  const options: Record<string, string | string[] | undefined> = {};
  if (optionalFields.scheduled) options.scheduled = optionalFields.scheduled;
  if (optionalFields.deadline) options.deadline = optionalFields.deadline;
  if (optionalFields.priority) options.priority = optionalFields.priority;
  if (optionalFields.tags?.length) options.tags = optionalFields.tags;
  if (optionalFields.todo) options.todo = optionalFields.todo;

  const result = await api.createTodo(
    title,
    Object.keys(options).length > 0 ? options : undefined,
  );
  if (result.status === "created") {
    setMessage({ text: "Captured!", isError: false });
    setValues({});
    setOptionalFields({});
  } else {
    setMessage({ text: "Capture failed", isError: true });
  }
}
```

**Step 5: Add ExpandableOptions UI after the title input**

In the JSX, after the title TextInput for Quick Capture (around line 362-372), add:

```tsx
{isQuickCapture ? (
  <>
    <TextInput
      label="Title *"
      value={typeof values["title"] === "string" ? values["title"] : ""}
      onChangeText={(text) => handleValueChange("title", text)}
      mode="outlined"
      style={styles.input}
      multiline
      numberOfLines={2}
      autoFocus
    />

    <ExpandableOptions>
      <StatePicker
        value={optionalFields.todo || "TODO"}
        onChange={(v) => handleOptionalFieldChange("todo", v)}
      />

      <PriorityPicker
        value={optionalFields.priority || null}
        onChange={(v) => handleOptionalFieldChange("priority", v)}
      />

      <PromptField
        prompt={{ name: "Schedule", type: "date", required: false }}
        value={optionalFields.scheduled || ""}
        onChange={(v) =>
          handleOptionalFieldChange("scheduled", v as string)
        }
      />

      <PromptField
        prompt={{ name: "Deadline", type: "date", required: false }}
        value={optionalFields.deadline || ""}
        onChange={(v) =>
          handleOptionalFieldChange("deadline", v as string)
        }
      />

      <PromptField
        prompt={{ name: "Tags", type: "tags", required: false }}
        value={optionalFields.tags || []}
        onChange={(v) =>
          handleOptionalFieldChange("tags", v as string[])
        }
      />
    </ExpandableOptions>
  </>
) : (
  // ... existing template-based prompts
)}
```

**Step 6: Reset optional fields when template changes**

Update the useEffect that resets values to also reset optionalFields:

```typescript
useEffect(() => {
  setValues({});
  setOptionalFields({});
}, [selectedTemplateKey]);
```

**Step 7: Run the app and test manually**

```bash
npm start
# Press 'a' for Android or 'i' for iOS
```

Test:

1. Open Capture tab
2. Enter a title
3. Tap "More options"
4. Set schedule, deadline, priority, tags, state
5. Tap Capture
6. Verify todo is created with all fields

**Step 8: Commit**

```bash
git add app/\(tabs\)/capture.tsx
git commit -m "$(cat <<'EOF'
feat: add expandable options to Quick Capture

Quick Capture now has a collapsible "More options" section with:
- TODO state picker
- Priority picker (A, B, C)
- Schedule date picker
- Deadline date picker
- Tags input

All fields are optional and sent to the extended /create-todo API.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5: Final Verification

### Task 5.1: Run all tests

```bash
npm run test:unit
npm run typecheck
npm run lint
```

### Task 5.2: Manual E2E test

1. Start the app with a running org-agenda-api
2. Create a Quick Capture with:
   - Title: "Test enhanced capture"
   - State: NEXT
   - Priority: A
   - Schedule: tomorrow
   - Tags: ["test", "enhanced"]
3. Verify the todo appears correctly in the agenda
4. Verify all fields are set correctly in the org file

### Task 5.3: Final commit and PR

```bash
git log --oneline feature/enhanced-capture ^master
# Review all commits

# Push and create PR
git push -u origin feature/enhanced-capture
gh pr create --title "feat: enhanced capture with optional fields" --body "$(cat <<'EOF'
## Summary
- Extends Quick Capture with collapsible options section
- Adds state, priority, schedule, deadline, and tags to capture
- Creates reusable StatePicker, PriorityPicker, ExpandableOptions components

## Dependencies
Requires org-agenda-api changes to /create-todo endpoint (separate PR)

## Test plan
- [x] Unit tests for API client
- [x] Manual test of capture flow
- [x] Verify todos created with all fields

Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
