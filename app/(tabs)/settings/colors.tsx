/**
 * Color Settings Screen
 *
 * Allows customization of:
 * - TODO state colors (TODO, NEXT, DONE, WAITING, custom states)
 * - Priority colors (A, B, C)
 * - Action button colors (Today, Tomorrow, Schedule, Deadline)
 */

import { ColorPicker } from "@/components/ColorPicker";
import { useColorPalette } from "@/context/ColorPaletteContext";
import { useTemplates } from "@/context/TemplatesContext";
import {
  ActionButtonType,
  ColorValue,
  HabitColorConfig,
  PriorityLevel,
} from "@/types/colors";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Appbar,
  Button,
  Dialog,
  List,
  Portal,
  Text,
  useTheme,
} from "react-native-paper";

type EditingItem =
  | { type: "todoState"; keyword: string }
  | { type: "action"; action: ActionButtonType }
  | { type: "priority"; level: PriorityLevel }
  | { type: "habit"; key: keyof HabitColorConfig }
  | null;

export default function ColorSettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const {
    config,
    getTodoStateColor,
    getActionColor,
    getPriorityColor,
    getHabitColors,
    getConfiguredTodoStates,
    setTodoStateColor,
    setActionColor,
    setPriorityColor,
    setHabitColor,
    randomizeTodoStateColors,
    resetToDefaults,
  } = useColorPalette();
  const { todoStates: orgTodoStates } = useTemplates();

  const [editingItem, setEditingItem] = useState<EditingItem>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Merge actual org-mode states with any custom states from color config
  const todoStates = useMemo(() => {
    const orgStates = [
      ...(orgTodoStates?.active || []),
      ...(orgTodoStates?.done || []),
    ];
    const configuredStates = getConfiguredTodoStates();
    // Combine and deduplicate, preserving org states order first
    const allStates = new Set([...orgStates, ...configuredStates]);
    return Array.from(allStates);
  }, [orgTodoStates, getConfiguredTodoStates]);
  const actionButtons: { key: ActionButtonType; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "tomorrow", label: "Tomorrow" },
    { key: "schedule", label: "Schedule" },
    { key: "deadline", label: "Deadline" },
  ];
  const priorityLevels: { key: PriorityLevel; label: string }[] = [
    { key: "A", label: "Priority A (Highest)" },
    { key: "B", label: "Priority B (High)" },
    { key: "C", label: "Priority C (Medium)" },
    { key: "D", label: "Priority D (Low)" },
    { key: "E", label: "Priority E (Lowest)" },
  ];
  const habitColorItems: { key: keyof HabitColorConfig; label: string }[] = [
    { key: "conforming", label: "Conforming (On Track)" },
    { key: "notConforming", label: "Not Conforming (Behind)" },
  ];

  const handleColorSelect = async (color: ColorValue) => {
    if (!editingItem) return;

    if (editingItem.type === "todoState") {
      await setTodoStateColor(editingItem.keyword, color);
    } else if (editingItem.type === "action") {
      await setActionColor(editingItem.action, color);
    } else if (editingItem.type === "priority") {
      await setPriorityColor(editingItem.level, color);
    } else if (editingItem.type === "habit") {
      await setHabitColor(editingItem.key, color);
    }
    setEditingItem(null);
  };

  const handleRandomize = async () => {
    await randomizeTodoStateColors(todoStates);
  };

  const handleReset = async () => {
    await resetToDefaults();
    setShowResetConfirm(false);
  };

  const getCurrentColor = (): ColorValue => {
    if (!editingItem) return "#000000";
    if (editingItem.type === "todoState") {
      return config.todoStateColors[editingItem.keyword] || "theme:secondary";
    } else if (editingItem.type === "action") {
      return config.actionColors[editingItem.action];
    } else if (editingItem.type === "priority") {
      return config.priorityColors[editingItem.level];
    } else if (editingItem.type === "habit") {
      return config.habitColors[editingItem.key];
    }
    return "#000000";
  };

  const getPickerTitle = (): string => {
    if (!editingItem) return "Select Color";
    if (editingItem.type === "todoState") {
      return `Color for ${editingItem.keyword}`;
    } else if (editingItem.type === "action") {
      const action = actionButtons.find((a) => a.key === editingItem.action);
      return `Color for ${action?.label || editingItem.action}`;
    } else if (editingItem.type === "priority") {
      const priority = priorityLevels.find((p) => p.key === editingItem.level);
      return `Color for ${priority?.label || editingItem.level}`;
    } else if (editingItem.type === "habit") {
      const habit = habitColorItems.find((h) => h.key === editingItem.key);
      return `Color for ${habit?.label || editingItem.key}`;
    }
    return "Select Color";
  };

  const ColorSwatch = ({ color }: { color: string }) => (
    <View style={[styles.colorSwatch, { backgroundColor: color }]} />
  );

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Color Settings" />
        <Appbar.Action
          icon="restore"
          onPress={() => setShowResetConfirm(true)}
        />
      </Appbar.Header>

      <ScrollView style={styles.content}>
        <List.Section>
          <List.Subheader>TODO State Colors</List.Subheader>
          {todoStates.map((keyword) => (
            <List.Item
              key={keyword}
              title={keyword}
              description={config.todoStateColors[keyword]}
              left={() => <ColorSwatch color={getTodoStateColor(keyword)} />}
              onPress={() => setEditingItem({ type: "todoState", keyword })}
              style={styles.listItem}
            />
          ))}
          <List.Item
            title="Default (fallback)"
            description={config.todoStateColors["DEFAULT"]}
            left={() => <ColorSwatch color={getTodoStateColor("DEFAULT")} />}
            onPress={() =>
              setEditingItem({ type: "todoState", keyword: "DEFAULT" })
            }
            style={styles.listItem}
          />
          <Button
            mode="outlined"
            onPress={handleRandomize}
            style={styles.addButton}
            icon="dice-multiple"
          >
            Randomize Colors
          </Button>
        </List.Section>

        <List.Section>
          <List.Subheader>Priority Colors</List.Subheader>
          {priorityLevels.map(({ key, label }) => (
            <List.Item
              key={key}
              title={label}
              description={config.priorityColors[key]}
              left={() => <ColorSwatch color={getPriorityColor(key)} />}
              onPress={() => setEditingItem({ type: "priority", level: key })}
              style={styles.listItem}
            />
          ))}
        </List.Section>

        <List.Section>
          <List.Subheader>Action Button Colors</List.Subheader>
          {actionButtons.map(({ key, label }) => (
            <List.Item
              key={key}
              title={label}
              description={config.actionColors[key]}
              left={() => <ColorSwatch color={getActionColor(key)} />}
              onPress={() => setEditingItem({ type: "action", action: key })}
              style={styles.listItem}
            />
          ))}
        </List.Section>

        <List.Section>
          <List.Subheader>Habit Graph Colors</List.Subheader>
          {habitColorItems.map(({ key, label }) => (
            <List.Item
              key={key}
              title={label}
              description={config.habitColors[key]}
              left={() => <ColorSwatch color={getHabitColors()[key]} />}
              onPress={() => setEditingItem({ type: "habit", key })}
              style={styles.listItem}
            />
          ))}
        </List.Section>

        <View style={styles.footer}>
          <Button
            mode="outlined"
            onPress={() => setShowResetConfirm(true)}
            icon="restore"
          >
            Reset to Defaults
          </Button>
        </View>
      </ScrollView>

      {/* Color Picker Modal */}
      <ColorPicker
        visible={editingItem !== null}
        currentColor={getCurrentColor()}
        onSelect={handleColorSelect}
        onDismiss={() => setEditingItem(null)}
        title={getPickerTitle()}
      />

      {/* Reset Confirmation Dialog */}
      <Portal>
        <Dialog
          visible={showResetConfirm}
          onDismiss={() => setShowResetConfirm(false)}
        >
          <Dialog.Title>Reset Colors?</Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: theme.colors.onSurface }}>
              This will reset all colors to their default values. Custom states
              will be removed.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowResetConfirm(false)}>Cancel</Button>
            <Button onPress={handleReset} textColor={theme.colors.error}>
              Reset
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  listItem: {
    paddingLeft: 16,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 8,
    marginRight: 8,
    alignSelf: "center",
  },
  addButton: {
    marginHorizontal: 16,
    marginTop: 8,
  },
  footer: {
    padding: 16,
    paddingBottom: 32,
  },
});
