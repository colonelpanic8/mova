import { PriorityPicker, StatePicker } from "@/components/capture";
import { KeyboardAwareContainer } from "@/components/KeyboardAwareContainer";
import { LogbookViewer } from "@/components/LogbookViewer";
import { PropertiesEditor } from "@/components/PropertiesEditor";
import { RepeaterPicker } from "@/components/RepeaterPicker";
import { TagsEditor } from "@/components/TagsEditor";
import { DateFieldWithQuickActions } from "@/components/todoForm";
import { useApi } from "@/context/ApiContext";
import { useMutation } from "@/context/MutationContext";
import { useSettings } from "@/context/SettingsContext";
import { AppSnackbar, useSnackbar } from "@/context/SnackbarContext";
import { useTemplates } from "@/context/TemplatesContext";
import { Repeater, Todo, TodoUpdates } from "@/services/api";
import {
  formStringToTimestamp,
  timestampToFormString,
} from "@/utils/timestampConversion";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Appbar,
  Button,
  Dialog,
  IconButton,
  Portal,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

export default function EditScreen() {
  const theme = useTheme();
  const router = useRouter();
  const api = useApi();
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
      deadline: null,
      priority: null,
      olpath: null,
      notifyBefore: null,
      body: null,
      properties: null,
      category: null,
      effectiveCategory: null,
    };
  }, [params.todo]);

  // Form state
  const [title, setTitle] = useState(originalTodo.title || "");
  const [todoState, setTodoState] = useState(originalTodo.todo || "TODO");
  const [priority, setPriority] = useState<string | null>(
    originalTodo.priority,
  );
  const [scheduled, setScheduled] = useState(
    timestampToFormString(originalTodo.scheduled),
  );
  const [scheduledRepeater, setScheduledRepeater] = useState<Repeater | null>(
    originalTodo.scheduled?.repeater || null,
  );
  const [deadline, setDeadline] = useState(
    timestampToFormString(originalTodo.deadline),
  );
  const [deadlineRepeater, setDeadlineRepeater] = useState<Repeater | null>(
    originalTodo.deadline?.repeater || null,
  );
  const [body, setBody] = useState(originalTodo.body || "");
  const [bodyExpanded, setBodyExpanded] = useState(!!originalTodo.body);
  const [properties, setProperties] = useState<Record<string, string>>(
    originalTodo.properties || {},
  );
  const [tags, setTags] = useState<string[]>(originalTodo.tags || []);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const { showSnackbar } = useSnackbar();

  const handleSave = useCallback(async () => {
    if (!api) return;
    setIsSaving(true);
    try {
      // Build updates object
      const updates: TodoUpdates = {};

      if (title !== (originalTodo.title || "")) {
        updates.new_title = title;
      }

      if (todoState !== originalTodo.todo) {
        updates.state = todoState;
      }

      // Check if scheduled or its repeater changed
      const originalScheduledStr = timestampToFormString(
        originalTodo.scheduled,
      );
      const originalScheduledRepeater =
        originalTodo.scheduled?.repeater || null;
      if (
        scheduled !== originalScheduledStr ||
        JSON.stringify(scheduledRepeater) !==
          JSON.stringify(originalScheduledRepeater)
      ) {
        updates.scheduled = formStringToTimestamp(scheduled, scheduledRepeater);
      }

      // Check if deadline or its repeater changed
      const originalDeadlineStr = timestampToFormString(originalTodo.deadline);
      const originalDeadlineRepeater = originalTodo.deadline?.repeater || null;
      if (
        deadline !== originalDeadlineStr ||
        JSON.stringify(deadlineRepeater) !==
          JSON.stringify(originalDeadlineRepeater)
      ) {
        updates.deadline = formStringToTimestamp(deadline, deadlineRepeater);
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
      if (JSON.stringify(tags) !== JSON.stringify(originalTodo.tags || [])) {
        updates.tags = tags.length > 0 ? tags : null;
      }

      // Apply all updates in a single request
      if (Object.keys(updates).length > 0) {
        const result = await api.updateTodo(originalTodo, updates);
        if (result.status !== "updated") {
          showSnackbar(result.message || "Failed to update", {
            isError: true,
          });
          setIsSaving(false);
          return;
        }
      }

      triggerRefresh();
      showSnackbar("Saved");

      // Navigate back after brief delay to show success
      setTimeout(() => router.back(), 500);
    } catch (err) {
      console.error("Failed to save:", err);
      showSnackbar("Failed to save", { isError: true });
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
    tags,
    originalTodo,
    triggerRefresh,
    router,
    api,
    showSnackbar,
  ]);

  const handleDelete = useCallback(async () => {
    if (!api) return;
    setDeleteDialogVisible(false);
    setIsDeleting(true);
    try {
      const result = await api.deleteTodo(originalTodo);
      if (result.deleted) {
        triggerRefresh();
        router.back();
      } else {
        showSnackbar(result.message || "Failed to delete", { isError: true });
      }
    } catch (err) {
      console.error("Failed to delete:", err);
      showSnackbar("Failed to delete", { isError: true });
    } finally {
      setIsDeleting(false);
    }
  }, [originalTodo, triggerRefresh, router, api, showSnackbar]);

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

      <KeyboardAwareContainer style={styles.scrollView}>
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

          {/* Title with inline save button */}
          <View style={styles.titleRow}>
            <TextInput
              label="Title"
              value={title}
              onChangeText={setTitle}
              mode="outlined"
              style={styles.titleInput}
              testID="title-input"
              editable={true}
            />
            <IconButton
              icon="content-save"
              mode="contained"
              onPress={handleSave}
              disabled={isSaving || isDeleting}
              loading={isSaving}
              style={styles.inlineSaveButton}
            />
          </View>

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

          {/* Tags - Collapsible, collapsed by default */}
          <TagsEditor tags={tags} onChange={setTags} defaultExpanded={false} />

          {/* Logbook - Read-only, collapsed by default */}
          <LogbookViewer
            logbook={originalTodo.logbook}
            defaultExpanded={false}
          />

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
      </KeyboardAwareContainer>

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
      </Portal>

      <AppSnackbar />
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 8,
  },
  titleInput: {
    flex: 1,
  },
  inlineSaveButton: {
    marginTop: 6,
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
  saveButton: {
    marginTop: 8,
  },
});
