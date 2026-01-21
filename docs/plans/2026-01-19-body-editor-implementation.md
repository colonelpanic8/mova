# Todo Body Editor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a full-screen body editor accessed via swipe action, supporting interactive org-mode checklists, bullets, and numbered lists.

**Architecture:** Parser converts org text to Block[] for interactive editing; toolbar inserts list items; save serializes back to org format and calls API.

**Tech Stack:** React Native, Expo Router, react-native-paper, TypeScript

---

## Task 1: Add body field to API types

**Files:**

- Modify: `services/api.ts:4-17` (Todo interface)
- Modify: `services/api.ts:46-50` (TodoUpdates interface)

**Step 1: Add body field to Todo interface**

In `services/api.ts`, add `body` field to the `Todo` interface:

```typescript
export interface Todo {
  todo: string;
  title: string;
  tags: string[] | null;
  level: number;
  scheduled: string | null;
  deadline: string | null;
  priority: string | null;
  file: string | null;
  pos: number | null;
  id: string | null;
  olpath: string[] | null;
  notifyBefore: number[] | null;
  body?: string | null; // Add this line
}
```

**Step 2: Add body field to TodoUpdates interface**

```typescript
export interface TodoUpdates {
  scheduled?: string | null;
  deadline?: string | null;
  priority?: string | null;
  body?: string | null; // Add this line
}
```

**Step 3: Commit**

```bash
git add services/api.ts
git commit -m "feat(api): add body field to Todo and TodoUpdates interfaces"
```

---

## Task 2: Create org body parser utility

**Files:**

- Create: `utils/orgBody.ts`
- Create: `tests/unit/orgBody.test.ts`

**Step 1: Write tests for the parser**

Create `tests/unit/orgBody.test.ts`:

```typescript
import { parseOrgBody, serializeBlocks, Block } from "../../utils/orgBody";

describe("parseOrgBody", () => {
  it("should parse empty string to empty array", () => {
    expect(parseOrgBody("")).toEqual([]);
  });

  it("should parse plain paragraph", () => {
    const result = parseOrgBody("Some text here");
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("paragraph");
    expect(result[0].content).toBe("Some text here");
    expect(result[0].indent).toBe(0);
  });

  it("should parse unchecked checklist item", () => {
    const result = parseOrgBody("- [ ] Buy milk");
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("checklist");
    expect(result[0].checked).toBe(false);
    expect(result[0].content).toBe("Buy milk");
  });

  it("should parse checked checklist item", () => {
    const result = parseOrgBody("- [X] Done task");
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("checklist");
    expect(result[0].checked).toBe(true);
    expect(result[0].content).toBe("Done task");
  });

  it("should parse lowercase x as checked", () => {
    const result = parseOrgBody("- [x] Done task");
    expect(result[0].checked).toBe(true);
  });

  it("should parse bullet item", () => {
    const result = parseOrgBody("- Item without checkbox");
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("bullet");
    expect(result[0].content).toBe("Item without checkbox");
  });

  it("should parse numbered list item", () => {
    const result = parseOrgBody("1. First item");
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("numbered");
    expect(result[0].content).toBe("First item");
  });

  it("should parse indented items", () => {
    const result = parseOrgBody("  - [ ] Indented item");
    expect(result[0].indent).toBe(1);
    expect(result[0].content).toBe("Indented item");
  });

  it("should parse multiple lines", () => {
    const input = `- [ ] Task 1
- [X] Task 2
Some notes`;
    const result = parseOrgBody(input);
    expect(result).toHaveLength(3);
    expect(result[0].type).toBe("checklist");
    expect(result[1].type).toBe("checklist");
    expect(result[2].type).toBe("paragraph");
  });
});

describe("serializeBlocks", () => {
  it("should serialize empty array to empty string", () => {
    expect(serializeBlocks([])).toBe("");
  });

  it("should serialize paragraph", () => {
    const blocks: Block[] = [
      { id: "1", type: "paragraph", indent: 0, content: "Hello world" },
    ];
    expect(serializeBlocks(blocks)).toBe("Hello world");
  });

  it("should serialize unchecked checklist", () => {
    const blocks: Block[] = [
      {
        id: "1",
        type: "checklist",
        indent: 0,
        checked: false,
        content: "Task",
      },
    ];
    expect(serializeBlocks(blocks)).toBe("- [ ] Task");
  });

  it("should serialize checked checklist", () => {
    const blocks: Block[] = [
      { id: "1", type: "checklist", indent: 0, checked: true, content: "Done" },
    ];
    expect(serializeBlocks(blocks)).toBe("- [X] Done");
  });

  it("should serialize bullet", () => {
    const blocks: Block[] = [
      { id: "1", type: "bullet", indent: 0, content: "Item" },
    ];
    expect(serializeBlocks(blocks)).toBe("- Item");
  });

  it("should serialize numbered list", () => {
    const blocks: Block[] = [
      { id: "1", type: "numbered", indent: 0, content: "First" },
    ];
    expect(serializeBlocks(blocks)).toBe("1. First");
  });

  it("should serialize with indentation", () => {
    const blocks: Block[] = [
      {
        id: "1",
        type: "checklist",
        indent: 2,
        checked: false,
        content: "Nested",
      },
    ];
    expect(serializeBlocks(blocks)).toBe("    - [ ] Nested");
  });

  it("should round-trip parse and serialize", () => {
    const original = `- [ ] Task 1
- [X] Task 2
  - [ ] Subtask
Some notes`;
    const blocks = parseOrgBody(original);
    const serialized = serializeBlocks(blocks);
    expect(serialized).toBe(original);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npm test -- tests/unit/orgBody.test.ts
```

Expected: FAIL - module not found

**Step 3: Implement the parser**

Create `utils/orgBody.ts`:

```typescript
export type BlockType = "paragraph" | "checklist" | "bullet" | "numbered";

export interface Block {
  id: string;
  type: BlockType;
  indent: number;
  checked?: boolean;
  content: string;
}

let idCounter = 0;

function generateId(): string {
  return `block-${Date.now()}-${idCounter++}`;
}

export function parseOrgBody(text: string): Block[] {
  if (!text || text.trim() === "") {
    return [];
  }

  const lines = text.split("\n");
  const blocks: Block[] = [];

  for (const line of lines) {
    // Count leading spaces for indentation (2 spaces = 1 indent level)
    const leadingSpaces = line.match(/^(\s*)/)?.[1].length || 0;
    const indent = Math.floor(leadingSpaces / 2);
    const trimmedLine = line.trimStart();

    // Checklist: - [ ] or - [X] or - [x]
    const checklistMatch = trimmedLine.match(/^- \[([ Xx])\] (.*)$/);
    if (checklistMatch) {
      blocks.push({
        id: generateId(),
        type: "checklist",
        indent,
        checked: checklistMatch[1].toLowerCase() === "x",
        content: checklistMatch[2],
      });
      continue;
    }

    // Bullet: - text (but not checkbox)
    const bulletMatch = trimmedLine.match(/^- (.+)$/);
    if (bulletMatch) {
      blocks.push({
        id: generateId(),
        type: "bullet",
        indent,
        content: bulletMatch[1],
      });
      continue;
    }

    // Numbered: 1. text, 2. text, etc.
    const numberedMatch = trimmedLine.match(/^\d+\. (.+)$/);
    if (numberedMatch) {
      blocks.push({
        id: generateId(),
        type: "numbered",
        indent,
        content: numberedMatch[1],
      });
      continue;
    }

    // Paragraph (anything else)
    blocks.push({
      id: generateId(),
      type: "paragraph",
      indent,
      content: trimmedLine,
    });
  }

  return blocks;
}

export function serializeBlocks(blocks: Block[]): string {
  if (blocks.length === 0) {
    return "";
  }

  let numberedCounter = 1;
  let lastType: BlockType | null = null;

  return blocks
    .map((block) => {
      const indentStr = "  ".repeat(block.indent);

      // Reset numbered counter when switching away from numbered
      if (block.type !== "numbered" && lastType === "numbered") {
        numberedCounter = 1;
      }
      lastType = block.type;

      switch (block.type) {
        case "checklist":
          return `${indentStr}- [${block.checked ? "X" : " "}] ${block.content}`;
        case "bullet":
          return `${indentStr}- ${block.content}`;
        case "numbered":
          return `${indentStr}${numberedCounter++}. ${block.content}`;
        case "paragraph":
        default:
          return `${indentStr}${block.content}`;
      }
    })
    .join("\n");
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test -- tests/unit/orgBody.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add utils/orgBody.ts tests/unit/orgBody.test.ts
git commit -m "feat(utils): add org body parser and serializer"
```

---

## Task 3: Create Toolbar component

**Files:**

- Create: `components/BodyEditor/Toolbar.tsx`

**Step 1: Create the Toolbar component**

Create `components/BodyEditor/Toolbar.tsx`:

```typescript
import React from "react";
import { StyleSheet, View } from "react-native";
import { IconButton, useTheme } from "react-native-paper";

export interface ToolbarProps {
  onAddChecklist: () => void;
  onAddBullet: () => void;
  onAddNumbered: () => void;
  onIndent: () => void;
  onOutdent: () => void;
}

export function Toolbar({
  onAddChecklist,
  onAddBullet,
  onAddNumbered,
  onIndent,
  onOutdent,
}: ToolbarProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.toolbar,
        { backgroundColor: theme.colors.surfaceVariant },
      ]}
    >
      <IconButton
        icon="checkbox-marked-outline"
        onPress={onAddChecklist}
        testID="toolbar-checklist"
      />
      <IconButton
        icon="format-list-bulleted"
        onPress={onAddBullet}
        testID="toolbar-bullet"
      />
      <IconButton
        icon="format-list-numbered"
        onPress={onAddNumbered}
        testID="toolbar-numbered"
      />
      <View style={styles.separator} />
      <IconButton
        icon="format-indent-decrease"
        onPress={onOutdent}
        testID="toolbar-outdent"
      />
      <IconButton
        icon="format-indent-increase"
        onPress={onIndent}
        testID="toolbar-indent"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  separator: {
    flex: 1,
  },
});

export default Toolbar;
```

**Step 2: Commit**

```bash
git add components/BodyEditor/Toolbar.tsx
git commit -m "feat(components): add Toolbar for body editor"
```

---

## Task 4: Create ChecklistItem component

**Files:**

- Create: `components/BodyEditor/ChecklistItem.tsx`

**Step 1: Create the ChecklistItem component**

Create `components/BodyEditor/ChecklistItem.tsx`:

```typescript
import { Block } from "@/utils/orgBody";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Checkbox, TextInput, useTheme } from "react-native-paper";

export interface ChecklistItemProps {
  block: Block;
  onToggle: (id: string) => void;
  onChangeContent: (id: string, content: string) => void;
  onSubmit: (id: string) => void;
}

export function ChecklistItem({
  block,
  onToggle,
  onChangeContent,
  onSubmit,
}: ChecklistItemProps) {
  const theme = useTheme();
  const indentPadding = block.indent * 24;

  return (
    <View style={[styles.row, { paddingLeft: indentPadding }]}>
      <Checkbox
        status={block.checked ? "checked" : "unchecked"}
        onPress={() => onToggle(block.id)}
        testID={`checkbox-${block.id}`}
      />
      <TextInput
        value={block.content}
        onChangeText={(text) => onChangeContent(block.id, text)}
        onSubmitEditing={() => onSubmit(block.id)}
        style={[
          styles.input,
          block.checked && styles.checkedText,
          { color: theme.colors.onSurface },
        ]}
        mode="flat"
        dense
        underlineColor="transparent"
        activeUnderlineColor="transparent"
        testID={`input-${block.id}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
  },
  input: {
    flex: 1,
    backgroundColor: "transparent",
  },
  checkedText: {
    textDecorationLine: "line-through",
    opacity: 0.6,
  },
});

export default ChecklistItem;
```

**Step 2: Commit**

```bash
git add components/BodyEditor/ChecklistItem.tsx
git commit -m "feat(components): add ChecklistItem for body editor"
```

---

## Task 5: Create BulletItem component

**Files:**

- Create: `components/BodyEditor/BulletItem.tsx`

**Step 1: Create the BulletItem component**

Create `components/BodyEditor/BulletItem.tsx`:

```typescript
import { Block } from "@/utils/orgBody";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Text, TextInput, useTheme } from "react-native-paper";

export interface BulletItemProps {
  block: Block;
  index?: number; // For numbered lists
  onChangeContent: (id: string, content: string) => void;
  onSubmit: (id: string) => void;
}

export function BulletItem({
  block,
  index,
  onChangeContent,
  onSubmit,
}: BulletItemProps) {
  const theme = useTheme();
  const indentPadding = block.indent * 24;

  const prefix =
    block.type === "numbered" ? `${(index ?? 0) + 1}.` : "\u2022";

  return (
    <View style={[styles.row, { paddingLeft: indentPadding }]}>
      <Text style={[styles.prefix, { color: theme.colors.onSurfaceVariant }]}>
        {prefix}
      </Text>
      <TextInput
        value={block.content}
        onChangeText={(text) => onChangeContent(block.id, text)}
        onSubmitEditing={() => onSubmit(block.id)}
        style={[styles.input, { color: theme.colors.onSurface }]}
        mode="flat"
        dense
        underlineColor="transparent"
        activeUnderlineColor="transparent"
        testID={`input-${block.id}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
  },
  prefix: {
    width: 24,
    textAlign: "center",
    fontSize: 16,
  },
  input: {
    flex: 1,
    backgroundColor: "transparent",
  },
});

export default BulletItem;
```

**Step 2: Commit**

```bash
git add components/BodyEditor/BulletItem.tsx
git commit -m "feat(components): add BulletItem for body editor"
```

---

## Task 6: Create ParagraphItem component

**Files:**

- Create: `components/BodyEditor/ParagraphItem.tsx`

**Step 1: Create the ParagraphItem component**

Create `components/BodyEditor/ParagraphItem.tsx`:

```typescript
import { Block } from "@/utils/orgBody";
import React from "react";
import { StyleSheet, View } from "react-native";
import { TextInput, useTheme } from "react-native-paper";

export interface ParagraphItemProps {
  block: Block;
  onChangeContent: (id: string, content: string) => void;
}

export function ParagraphItem({ block, onChangeContent }: ParagraphItemProps) {
  const theme = useTheme();
  const indentPadding = block.indent * 24;

  return (
    <View style={[styles.row, { paddingLeft: indentPadding }]}>
      <TextInput
        value={block.content}
        onChangeText={(text) => onChangeContent(block.id, text)}
        style={[styles.input, { color: theme.colors.onSurface }]}
        mode="flat"
        multiline
        dense
        underlineColor="transparent"
        activeUnderlineColor="transparent"
        testID={`input-${block.id}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 48,
  },
  input: {
    flex: 1,
    backgroundColor: "transparent",
  },
});

export default ParagraphItem;
```

**Step 2: Commit**

```bash
git add components/BodyEditor/ParagraphItem.tsx
git commit -m "feat(components): add ParagraphItem for body editor"
```

---

## Task 7: Create main BodyEditor component

**Files:**

- Create: `components/BodyEditor/index.tsx`

**Step 1: Create the BodyEditor component**

Create `components/BodyEditor/index.tsx`:

```typescript
import { Block, parseOrgBody, serializeBlocks } from "@/utils/orgBody";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useTheme } from "react-native-paper";
import { BulletItem } from "./BulletItem";
import { ChecklistItem } from "./ChecklistItem";
import { ParagraphItem } from "./ParagraphItem";
import { Toolbar } from "./Toolbar";

export interface BodyEditorProps {
  initialBody: string;
  onBodyChange: (body: string) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

export function BodyEditor({
  initialBody,
  onBodyChange,
  onDirtyChange,
}: BodyEditorProps) {
  const theme = useTheme();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const initializedRef = useRef(false);

  // Parse initial body on mount
  useEffect(() => {
    if (!initializedRef.current) {
      const parsed = parseOrgBody(initialBody || "");
      setBlocks(parsed);
      initializedRef.current = true;
    }
  }, [initialBody]);

  // Notify parent of changes
  useEffect(() => {
    if (initializedRef.current) {
      const serialized = serializeBlocks(blocks);
      onBodyChange(serialized);
    }
  }, [blocks, onBodyChange]);

  const updateBlock = useCallback(
    (id: string, updates: Partial<Block>) => {
      setBlocks((prev) =>
        prev.map((b) => (b.id === id ? { ...b, ...updates } : b))
      );
      onDirtyChange?.(true);
    },
    [onDirtyChange]
  );

  const toggleChecklist = useCallback(
    (id: string) => {
      setBlocks((prev) =>
        prev.map((b) =>
          b.id === id ? { ...b, checked: !b.checked } : b
        )
      );
      onDirtyChange?.(true);
    },
    [onDirtyChange]
  );

  const handleChangeContent = useCallback(
    (id: string, content: string) => {
      updateBlock(id, { content });
    },
    [updateBlock]
  );

  const addBlockAfter = useCallback(
    (afterId: string | null, type: Block["type"]) => {
      const newBlock: Block = {
        id: `block-${Date.now()}-${Math.random()}`,
        type,
        indent: 0,
        content: "",
        checked: type === "checklist" ? false : undefined,
      };

      setBlocks((prev) => {
        if (afterId === null) {
          return [...prev, newBlock];
        }
        const index = prev.findIndex((b) => b.id === afterId);
        if (index === -1) {
          return [...prev, newBlock];
        }
        // Inherit indent from previous block
        newBlock.indent = prev[index].indent;
        const next = [...prev];
        next.splice(index + 1, 0, newBlock);
        return next;
      });
      setFocusedId(newBlock.id);
      onDirtyChange?.(true);
    },
    [onDirtyChange]
  );

  const handleSubmit = useCallback(
    (id: string) => {
      const block = blocks.find((b) => b.id === id);
      if (block && (block.type === "checklist" || block.type === "bullet" || block.type === "numbered")) {
        addBlockAfter(id, block.type);
      }
    },
    [blocks, addBlockAfter]
  );

  const handleIndent = useCallback(() => {
    if (focusedId) {
      setBlocks((prev) =>
        prev.map((b) =>
          b.id === focusedId ? { ...b, indent: b.indent + 1 } : b
        )
      );
      onDirtyChange?.(true);
    }
  }, [focusedId, onDirtyChange]);

  const handleOutdent = useCallback(() => {
    if (focusedId) {
      setBlocks((prev) =>
        prev.map((b) =>
          b.id === focusedId ? { ...b, indent: Math.max(0, b.indent - 1) } : b
        )
      );
      onDirtyChange?.(true);
    }
  }, [focusedId, onDirtyChange]);

  const handleAddChecklist = useCallback(() => {
    addBlockAfter(focusedId, "checklist");
  }, [focusedId, addBlockAfter]);

  const handleAddBullet = useCallback(() => {
    addBlockAfter(focusedId, "bullet");
  }, [focusedId, addBlockAfter]);

  const handleAddNumbered = useCallback(() => {
    addBlockAfter(focusedId, "numbered");
  }, [focusedId, addBlockAfter]);

  // Track numbered list indices
  let numberedIndex = 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        style={[styles.scrollView, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {blocks.map((block) => {
          if (block.type === "checklist") {
            return (
              <ChecklistItem
                key={block.id}
                block={block}
                onToggle={toggleChecklist}
                onChangeContent={handleChangeContent}
                onSubmit={handleSubmit}
              />
            );
          }
          if (block.type === "bullet") {
            return (
              <BulletItem
                key={block.id}
                block={block}
                onChangeContent={handleChangeContent}
                onSubmit={handleSubmit}
              />
            );
          }
          if (block.type === "numbered") {
            const idx = numberedIndex++;
            return (
              <BulletItem
                key={block.id}
                block={block}
                index={idx}
                onChangeContent={handleChangeContent}
                onSubmit={handleSubmit}
              />
            );
          }
          return (
            <ParagraphItem
              key={block.id}
              block={block}
              onChangeContent={handleChangeContent}
            />
          );
        })}
        {blocks.length === 0 && (
          <View style={styles.emptyState} />
        )}
      </ScrollView>
      <Toolbar
        onAddChecklist={handleAddChecklist}
        onAddBullet={handleAddBullet}
        onAddNumbered={handleAddNumbered}
        onIndent={handleIndent}
        onOutdent={handleOutdent}
      />
    </KeyboardAvoidingView>
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
    paddingBottom: 100,
  },
  emptyState: {
    height: 200,
  },
});

export default BodyEditor;
```

**Step 2: Commit**

```bash
git add components/BodyEditor/index.tsx
git commit -m "feat(components): add main BodyEditor component"
```

---

## Task 8: Create body-editor screen

**Files:**

- Create: `app/body-editor.tsx`
- Modify: `app/_layout.tsx`

**Step 1: Create the body-editor screen**

Create `app/body-editor.tsx`:

```typescript
import { BodyEditor } from "@/components/BodyEditor";
import { useMutation } from "@/context/MutationContext";
import { api, Todo } from "@/services/api";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Appbar, Snackbar, useTheme } from "react-native-paper";

export default function BodyEditorScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    file: string;
    pos: string;
    title: string;
    body: string;
  }>();

  const { triggerRefresh } = useMutation();

  const [body, setBody] = useState(params.body || "");
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ visible: false, message: "", isError: false });

  const bodyRef = useRef(body);
  bodyRef.current = body;

  const todo: Todo = {
    id: params.id || null,
    file: params.file || null,
    pos: params.pos ? parseInt(params.pos, 10) : null,
    title: params.title || "",
    todo: "",
    tags: null,
    level: 1,
    scheduled: null,
    deadline: null,
    priority: null,
    olpath: null,
    notifyBefore: null,
  };

  const save = useCallback(async () => {
    if (!isDirty) return true;

    setIsSaving(true);
    try {
      const result = await api.updateTodo(todo, { body: bodyRef.current });
      if (result.status === "updated") {
        setIsDirty(false);
        triggerRefresh();
        setSnackbar({ visible: true, message: "Saved", isError: false });
        return true;
      } else {
        setSnackbar({
          visible: true,
          message: result.message || "Failed to save",
          isError: true,
        });
        return false;
      }
    } catch (err) {
      console.error("Failed to save body:", err);
      setSnackbar({ visible: true, message: "Failed to save", isError: true });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [isDirty, todo, triggerRefresh]);

  const handleBack = useCallback(async () => {
    if (isDirty) {
      const saved = await save();
      if (saved) {
        router.back();
      }
    } else {
      router.back();
    }
  }, [isDirty, save, router]);

  // Save on unmount if dirty
  useEffect(() => {
    return () => {
      if (isDirty) {
        // Fire and forget - we're unmounting
        api.updateTodo(todo, { body: bodyRef.current }).then(() => {
          triggerRefresh();
        }).catch(console.error);
      }
    };
  }, [isDirty, todo, triggerRefresh]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header>
        <Appbar.BackAction onPress={handleBack} testID="back-button" />
        <Appbar.Content title={params.title || "Edit Body"} titleStyle={styles.title} />
        <Appbar.Action
          icon="content-save"
          onPress={save}
          disabled={!isDirty || isSaving}
          testID="save-button"
        />
      </Appbar.Header>

      <BodyEditor
        initialBody={params.body || ""}
        onBodyChange={setBody}
        onDirtyChange={setIsDirty}
      />

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
  title: {
    fontSize: 16,
  },
});
```

**Step 2: Register the screen in app layout**

Modify `app/_layout.tsx`, add the body-editor screen to the Stack:

```typescript
// In the Stack component, add:
<Stack.Screen name="body-editor" options={{ headerShown: false }} />
```

The updated return statement in `RootLayoutNav` should look like:

```typescript
return (
  <Stack screenOptions={{ headerShown: false }}>
    <Stack.Screen name="login" />
    <Stack.Screen name="(tabs)" />
    <Stack.Screen name="body-editor" options={{ headerShown: false }} />
  </Stack>
);
```

**Step 3: Commit**

```bash
git add app/body-editor.tsx app/_layout.tsx
git commit -m "feat(app): add body-editor screen"
```

---

## Task 9: Add openBodyEditor to useTodoEditing hook

**Files:**

- Modify: `hooks/useTodoEditing.tsx`

**Step 1: Add openBodyEditor function**

In `hooks/useTodoEditing.tsx`, add the import for router and the new function.

Add import at the top:

```typescript
import { useRouter } from "expo-router";
```

Inside `useTodoEditing` function, add router hook:

```typescript
const router = useRouter();
```

Add the openBodyEditor function after the existing modal functions:

```typescript
const openBodyEditor = useCallback(
  (todo: Todo) => {
    const key = getTodoKey(todo);
    swipeableRefs.current.get(key)?.close();
    router.push({
      pathname: "/body-editor",
      params: {
        id: todo.id || "",
        file: todo.file || "",
        pos: todo.pos?.toString() || "",
        title: todo.title || "",
        body: todo.body || "",
      },
    });
  },
  [router],
);
```

Add `openBodyEditor` to the `UseTodoEditingResult` interface:

```typescript
export interface UseTodoEditingResult {
  // ... existing properties
  openBodyEditor: (todo: Todo) => void;
  // ... rest
}
```

Add to the return statement:

```typescript
return {
  // ... existing
  openBodyEditor,
  // ... rest
};
```

**Step 2: Commit**

```bash
git add hooks/useTodoEditing.tsx
git commit -m "feat(hooks): add openBodyEditor to useTodoEditing"
```

---

## Task 10: Add Body swipe action to TodoItem

**Files:**

- Modify: `components/TodoItem.tsx`

**Step 1: Add openBodyEditor to destructured context**

In `components/TodoItem.tsx`, add `openBodyEditor` to the destructured context:

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
  openPriorityModal,
  openRemindModal,
  openBodyEditor, // Add this
  openSwipeable,
} = useTodoEditingContext();
```

**Step 2: Add Body button to renderRightActions**

In the `renderRightActions` callback, add the Body button as the first action:

```typescript
const renderRightActions = useCallback(() => {
  return (
    <View style={styles.swipeActions}>
      <TouchableOpacity
        testID={`bodyActionButton_${testIdSuffix}`}
        style={[
          styles.swipeAction,
          { backgroundColor: theme.colors.secondary },
        ]}
        onPress={() => openBodyEditor(todo)}
      >
        <Text style={styles.swipeActionText}>Body</Text>
      </TouchableOpacity>
      <TouchableOpacity
        testID={`tomorrowActionButton_${testIdSuffix}`}
        // ... rest unchanged
```

**Step 3: Add openBodyEditor to the useCallback dependencies**

```typescript
}, [
  testIdSuffix,
  getActionColor,
  theme.colors.tertiary,
  theme.colors.secondary,  // Add this
  todo,
  scheduleToday,
  scheduleTomorrow,
  openScheduleModal,
  openDeadlineModal,
  openRemindModal,
  openBodyEditor,  // Add this
]);
```

**Step 4: Commit**

```bash
git add components/TodoItem.tsx
git commit -m "feat(components): add Body swipe action to TodoItem"
```

---

## Task 11: Update test mocks for MutationContext

**Files:**

- Modify: `tests/components/AgendaScreen.test.tsx`
- Modify: `tests/components/SearchScreen.test.tsx`

**Step 1: Add openBodyEditor to MutationContext mock**

In both test files, update the mock to include `openBodyEditor`:

The useTodoEditing mock should also be added if not present. For now, since we're mocking MutationContext, ensure the useTodoEditingContext mock also includes openBodyEditor.

Since the tests mock `useTodoEditingContext` implicitly through the provider pattern, we need to add `openBodyEditor` to the mock in the test setup or ensure the TodoEditingProvider works with the mocked MutationContext.

Actually, looking at the test files, they mock MutationContext but the screens use TodoEditingProvider which uses the real useTodoEditing. The tests need to either:

1. Mock useTodoEditing directly, or
2. Ensure the MutationContext mock is sufficient

For now, the simplest fix is to add a mock for the router since openBodyEditor uses it:

In both test files, add the expo-router mock:

```typescript
jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  useSegments: () => [],
}));
```

**Step 2: Commit**

```bash
git add tests/components/AgendaScreen.test.tsx tests/components/SearchScreen.test.tsx
git commit -m "test: add expo-router mock for body editor navigation"
```

---

## Task 12: Run all tests and verify

**Step 1: Run tests**

```bash
npm test
```

Expected: All tests pass

**Step 2: Manual testing checklist**

- [ ] Open app and navigate to agenda or search
- [ ] Swipe a todo item to see "Body" action
- [ ] Tap "Body" to open editor
- [ ] Add checklist items using toolbar
- [ ] Toggle checkboxes
- [ ] Add bullet and numbered items
- [ ] Use indent/outdent
- [ ] Save and verify changes persist
- [ ] Navigate back and verify list refreshes

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address any issues found in testing"
```

---

## Summary

This plan creates a full-screen body editor with:

- Org-mode parser/serializer for `- [ ]` checklists, `- ` bullets, `1. ` numbered lists
- Interactive checkbox toggling
- Toolbar for adding items and indenting
- Auto-save on exit, explicit save button
- Swipe action to access from any todo item

Total: 12 tasks, approximately 45-60 minutes of implementation time.
