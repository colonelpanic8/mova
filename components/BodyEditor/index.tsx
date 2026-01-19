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
