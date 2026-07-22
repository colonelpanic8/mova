import { KeyboardAwareContainer } from "@/components/KeyboardAwareContainer";
import { LogbookViewer } from "@/components/LogbookViewer";
import { PropertiesEditor } from "@/components/PropertiesEditor";
import { TagsEditor } from "@/components/TagsEditor";
import { DeleteConfirmDialog } from "@/components/todoEditing/DeleteConfirmDialog";
import {
  TodoFormFields,
  TodoFormState,
  todoToFormState,
} from "@/components/todoForm";
import { useApi } from "@/context/ApiContext";
import { AppSnackbar, useSnackbar } from "@/context/SnackbarContext";
import { useServerDataInvalidation } from "@/hooks/queryKeys";
import { Todo, TodoUpdates } from "@/services/api";
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
  IconButton,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

export default function EditScreen() {
  const theme = useTheme();
  const router = useRouter();
  const api = useApi();
  const invalidateServerData = useServerDataInvalidation();

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
  const [form, setForm] = useState<TodoFormState>(() =>
    todoToFormState(originalTodo),
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

      if (form.state !== originalTodo.todo) {
        updates.state = form.state;
      }

      // Check if scheduled or its repeater changed
      const originalScheduledStr = timestampToFormString(
        originalTodo.scheduled,
      );
      const originalScheduledRepeater =
        originalTodo.scheduled?.repeater || null;
      if (
        form.scheduled !== originalScheduledStr ||
        JSON.stringify(form.scheduledRepeater) !==
          JSON.stringify(originalScheduledRepeater)
      ) {
        updates.scheduled = formStringToTimestamp(
          form.scheduled,
          form.scheduledRepeater,
        );
      }

      // Check if deadline or its repeater changed
      const originalDeadlineStr = timestampToFormString(originalTodo.deadline);
      const originalDeadlineRepeater = originalTodo.deadline?.repeater || null;
      if (
        form.deadline !== originalDeadlineStr ||
        JSON.stringify(form.deadlineRepeater) !==
          JSON.stringify(originalDeadlineRepeater)
      ) {
        updates.deadline = formStringToTimestamp(
          form.deadline,
          form.deadlineRepeater,
        );
      }
      if (form.priority !== originalTodo.priority) {
        updates.priority = form.priority;
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
      if (
        JSON.stringify(form.tags) !== JSON.stringify(originalTodo.tags || [])
      ) {
        updates.tags = form.tags.length > 0 ? form.tags : null;
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

      invalidateServerData();
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
    form,
    body,
    properties,
    originalTodo,
    invalidateServerData,
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
        invalidateServerData();
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
  }, [originalTodo, invalidateServerData, router, api, showSnackbar]);

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

          {/* State, priority, schedule/deadline with repeaters */}
          <TodoFormFields value={form} onChange={setForm} showTags={false} />

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
          <TagsEditor
            tags={form.tags}
            onChange={(tags) => setForm((f) => ({ ...f, tags }))}
            defaultExpanded={false}
          />

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
      <DeleteConfirmDialog
        todo={deleteDialogVisible ? originalTodo : null}
        onDismiss={() => setDeleteDialogVisible(false)}
        onConfirm={handleDelete}
      />

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
