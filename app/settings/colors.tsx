/**
 * Color Settings Screen
 *
 * Allows customization of:
 * - TODO state colors (TODO, NEXT, DONE, WAITING, custom states)
 * - Action button colors (Tomorrow, Schedule, Deadline, Priority)
 */

import { ColorPicker } from "@/components/ColorPicker";
import { useColorPalette } from "@/context/ColorPaletteContext";
import { ActionButtonType, ColorValue } from "@/types/colors";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
  Appbar,
  Button,
  Dialog,
  List,
  Portal,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

type EditingItem =
  | { type: "todoState"; keyword: string }
  | { type: "action"; action: ActionButtonType }
  | null;

export default function ColorSettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const {
    config,
    getTodoStateColor,
    getActionColor,
    getConfiguredTodoStates,
    setTodoStateColor,
    removeTodoStateColor,
    setActionColor,
    resetToDefaults,
  } = useColorPalette();

  const [editingItem, setEditingItem] = useState<EditingItem>(null);
  const [showAddState, setShowAddState] = useState(false);
  const [newStateName, setNewStateName] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const todoStates = getConfiguredTodoStates();
  const actionButtons: { key: ActionButtonType; label: string }[] = [
    { key: "tomorrow", label: "Tomorrow" },
    { key: "schedule", label: "Schedule" },
    { key: "deadline", label: "Deadline" },
    { key: "priority", label: "Priority" },
  ];

  const handleColorSelect = async (color: ColorValue) => {
    if (!editingItem) return;

    if (editingItem.type === "todoState") {
      await setTodoStateColor(editingItem.keyword, color);
    } else {
      await setActionColor(editingItem.action, color);
    }
    setEditingItem(null);
  };

  const handleAddState = async () => {
    const trimmed = newStateName.trim().toUpperCase();
    if (trimmed && !todoStates.includes(trimmed)) {
      await setTodoStateColor(trimmed, "theme:secondary");
      setNewStateName("");
      setShowAddState(false);
    }
  };

  const handleRemoveState = async (keyword: string) => {
    await removeTodoStateColor(keyword);
  };

  const handleReset = async () => {
    await resetToDefaults();
    setShowResetConfirm(false);
  };

  const getCurrentColor = (): ColorValue => {
    if (!editingItem) return "#000000";
    if (editingItem.type === "todoState") {
      return config.todoStateColors[editingItem.keyword] || "theme:secondary";
    }
    return config.actionColors[editingItem.action];
  };

  const getPickerTitle = (): string => {
    if (!editingItem) return "Select Color";
    if (editingItem.type === "todoState") {
      return `Color for ${editingItem.keyword}`;
    }
    const action = actionButtons.find((a) => a.key === editingItem.action);
    return `Color for ${action?.label || editingItem.action}`;
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
              right={() => (
                <View style={styles.itemActions}>
                  <Pressable
                    onPress={() =>
                      setEditingItem({ type: "todoState", keyword })
                    }
                    style={styles.editButton}
                  >
                    <Text style={{ color: theme.colors.primary }}>Edit</Text>
                  </Pressable>
                  {!["TODO", "NEXT", "DONE", "WAITING", "DEFAULT"].includes(
                    keyword,
                  ) && (
                    <Pressable
                      onPress={() => handleRemoveState(keyword)}
                      style={styles.removeButton}
                    >
                      <Text style={{ color: theme.colors.error }}>Remove</Text>
                    </Pressable>
                  )}
                </View>
              )}
              style={styles.listItem}
            />
          ))}
          <List.Item
            title="Default (fallback)"
            description={config.todoStateColors["DEFAULT"]}
            left={() => <ColorSwatch color={getTodoStateColor("DEFAULT")} />}
            right={() => (
              <Pressable
                onPress={() =>
                  setEditingItem({ type: "todoState", keyword: "DEFAULT" })
                }
                style={styles.editButton}
              >
                <Text style={{ color: theme.colors.primary }}>Edit</Text>
              </Pressable>
            )}
            style={styles.listItem}
          />
          <Button
            mode="outlined"
            onPress={() => setShowAddState(true)}
            style={styles.addButton}
            icon="plus"
          >
            Add Custom State
          </Button>
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

      {/* Add State Dialog */}
      <Portal>
        <Dialog visible={showAddState} onDismiss={() => setShowAddState(false)}>
          <Dialog.Title>Add Custom TODO State</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label="State Name"
              placeholder="e.g., SOMEDAY"
              value={newStateName}
              onChangeText={setNewStateName}
              autoCapitalize="characters"
            />
            <Text
              style={[
                styles.dialogHint,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              Enter the TODO keyword as it appears in your org files (e.g.,
              SOMEDAY, HOLD, PROJECT)
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowAddState(false)}>Cancel</Button>
            <Button onPress={handleAddState} disabled={!newStateName.trim()}>
              Add
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

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
  itemActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  editButton: {
    padding: 8,
  },
  removeButton: {
    padding: 8,
  },
  addButton: {
    marginHorizontal: 16,
    marginTop: 8,
  },
  footer: {
    padding: 16,
    paddingBottom: 32,
  },
  dialogHint: {
    fontSize: 12,
    marginTop: 8,
  },
});
