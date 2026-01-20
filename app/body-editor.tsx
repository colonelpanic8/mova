import { BodyEditor } from "@/components/BodyEditor";
import { useMutation } from "@/context/MutationContext";
import { api, Todo } from "@/services/api";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
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
  const [snackbar, setSnackbar] = useState({
    visible: false,
    message: "",
    isError: false,
  });

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
    scheduledRepeater: null,
    deadline: null,
    deadlineRepeater: null,
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
        api
          .updateTodo(todo, { body: bodyRef.current })
          .then(() => {
            triggerRefresh();
          })
          .catch(console.error);
      }
    };
  }, [isDirty, todo, triggerRefresh]);

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Appbar.Header>
        <Appbar.BackAction onPress={handleBack} testID="back-button" />
        <Appbar.Content
          title={params.title || "Edit Body"}
          titleStyle={styles.title}
        />
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
  title: {
    fontSize: 16,
  },
});
