import { PriorityPicker, StatePicker } from "@/components/capture";
import { LogbookViewer } from "@/components/LogbookViewer";
import { PropertiesEditor } from "@/components/PropertiesEditor";
import { RepeaterPicker } from "@/components/RepeaterPicker";
import { DateFieldWithQuickActions } from "@/components/todoForm";
import { useMutation } from "@/context/MutationContext";
import { useSettings } from "@/context/SettingsContext";
import { useTemplates } from "@/context/TemplatesContext";
import { api, Repeater, Todo, TodoUpdates } from "@/services/api";
import { scheduleCustomNotification } from "@/services/notifications";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  Appbar,
  Button,
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
  const { filterOptions } = useTemplates();

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
      properties: null,
    };
  }, [params.todo]);

  // Form state
  const [title, setTitle] = useState(originalTodo.title || "");
  const [todoState, setTodoState] = useState(originalTodo.todo || "TODO");
  const [priority, setPriority] = useState<string | null>(
    originalTodo.priority,
  );
  const [scheduled, setScheduled] = useState(originalTodo.scheduled || "");
  const [scheduledRepeater, setScheduledRepeater] = useState<Repeater | null>(
    originalTodo.scheduledRepeater,
  );
  const [deadline, setDeadline] = useState(originalTodo.deadline || "");
  const [deadlineRepeater, setDeadlineRepeater] = useState<Repeater | null>(
    originalTodo.deadlineRepeater,
  );
  const [body, setBody] = useState(originalTodo.body || "");
  const [bodyExpanded, setBodyExpanded] = useState(!!originalTodo.body);
  const [properties, setProperties] = useState<Record<string, string>>(
    originalTodo.properties || {},
  );

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [snackbar, setSnackbar] = useState({
    visible: false,
    message: "",
    isError: false,
  });
  const [remindDialogVisible, setRemindDialogVisible] = useState(false);
  const [remindDateTime, setRemindDateTime] = useState<Date>(() => {
    const date = new Date();
    date.setHours(date.getHours() + 1);
    date.setMinutes(0, 0, 0);
    return date;
  });

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      // Check if state changed
      const stateChanged = todoState !== originalTodo.todo;

      // Build updates object
      const updates: TodoUpdates = {};

      if (title !== (originalTodo.title || "")) {
        updates.new_title = title;
      }
      if (scheduled !== (originalTodo.scheduled || "")) {
        updates.scheduled = scheduled || null;
      }
      if (
        JSON.stringify(scheduledRepeater) !==
        JSON.stringify(originalTodo.scheduledRepeater)
      ) {
        updates.scheduledRepeater = scheduledRepeater;
      }
      if (deadline !== (originalTodo.deadline || "")) {
        updates.deadline = deadline || null;
      }
      if (
        JSON.stringify(deadlineRepeater) !==
        JSON.stringify(originalTodo.deadlineRepeater)
      ) {
        updates.deadlineRepeater = deadlineRepeater;
      }
      if (priority !== originalTodo.priority) {
        updates.priority = priority;
      }
      if (body !== (originalTodo.body || "")) {
        updates.body = body || null;
      }
      if (
        JSON.stringify(properties) !==
        JSON.stringify(originalTodo.properties || {})
      ) {
        updates.properties =
          Object.keys(properties).length > 0 ? properties : null;
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
    properties,
    originalTodo,
    triggerRefresh,
    router,
  ]);

  const handleDelete = useCallback(async () => {
    setDeleteDialogVisible(false);
    setIsDeleting(true);
    try {
      const result = await api.deleteTodo(originalTodo);
      if (result.deleted) {
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
      setSnackbar({
        visible: true,
        message: "Failed to delete",
        isError: true,
      });
    } finally {
      setIsDeleting(false);
    }
  }, [originalTodo, triggerRefresh, router]);

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

    const result = await scheduleCustomNotification(
      originalTodo,
      remindDateTime,
    );
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

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
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

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.scrollView}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Read-only category display */}
          {originalTodo.file && (
            <View style={styles.categoryContainer}>
              <Text
                variant="bodySmall"
                style={[styles.categoryLabel, { color: theme.colors.outline }]}
              >
                {originalTodo.file}
              </Text>
            </View>
          )}

          {/* Title */}
          <TextInput
            label="Title"
            value={title}
            onChangeText={setTitle}
            mode="outlined"
            style={styles.input}
            testID="title-input"
            editable={true}
          />

          {/* State */}
          <StatePicker value={todoState} onChange={setTodoState} />

          {/* Priority */}
          <PriorityPicker
            value={priority}
            onChange={setPriority}
            priorities={filterOptions?.priorities}
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

          {/* Body - Collapsible */}
          {bodyExpanded ? (
            <View style={styles.bodyContainer}>
              <Text variant="bodySmall" style={styles.fieldLabel}>
                Body
              </Text>
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

          {/* Properties - Collapsible, collapsed by default */}
          <PropertiesEditor
            properties={properties}
            onChange={setProperties}
            defaultExpanded={false}
          />

          {/* Logbook - Read-only, collapsed by default */}
          <LogbookViewer
            logbook={originalTodo.logbook}
            defaultExpanded={false}
          />

          {/* Remind button - only on native (notifications don't work on web) */}
          {Platform.OS !== "web" && (
            <Button
              mode="outlined"
              onPress={handleRemind}
              style={styles.remindButton}
              icon="bell"
            >
              Set Reminder
            </Button>
          )}

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
      </KeyboardAvoidingView>

      {/* Delete confirmation dialog */}
      <Portal>
        <Dialog
          visible={deleteDialogVisible}
          onDismiss={() => setDeleteDialogVisible(false)}
        >
          <Dialog.Title>Delete Todo?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{originalTodo.title}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteDialogVisible(false)}>
              Cancel
            </Button>
            <Button onPress={handleDelete} textColor={theme.colors.error}>
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog
          visible={remindDialogVisible}
          onDismiss={() => setRemindDialogVisible(false)}
        >
          <Dialog.Title>Set Reminder</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ marginBottom: 16 }}>
              {originalTodo.title}
            </Text>
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
            <Button onPress={() => setRemindDialogVisible(false)}>
              Cancel
            </Button>
            <Button onPress={handleScheduleReminder}>Set Reminder</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar((s) => ({ ...s, visible: false }))}
        duration={2000}
        style={
          snackbar.isError ? { backgroundColor: theme.colors.error } : undefined
        }
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
