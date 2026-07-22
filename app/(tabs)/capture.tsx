import {
  CategoryField,
  PromptField,
  PromptFieldHandle,
} from "@/components/capture";
import { KeyboardAwareContainer } from "@/components/KeyboardAwareContainer";
import { ScreenContainer } from "@/components/ScreenContainer";
import {
  emptyTodoFormState,
  TodoFormFields,
  TodoFormFieldsHandle,
  TodoFormState,
} from "@/components/todoForm";
import { useApi } from "@/context/ApiContext";
import { useAuth } from "@/context/AuthContext";
import { useMutation } from "@/context/MutationContext";
import { useOutbox } from "@/context/OutboxContext";
import { useTemplates } from "@/context/TemplatesContext";
import { useMenuPickerWorkaround } from "@/hooks/useMenuPickerWorkaround";
import { CategoryType, TemplatePrompt, Timestamp } from "@/services/api";
import { OutboxRequest } from "@/services/captureOutbox";
import { formStringToTimestamp } from "@/utils/timestampConversion";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Divider,
  IconButton,
  Menu,
  Snackbar,
  useTheme,
} from "react-native-paper";

type CaptureSelection =
  | { type: "template"; key: string }
  | { type: "category"; categoryType: CategoryType };

export default function CaptureScreen() {
  const api = useApi();
  const {
    templates,
    categoryTypes,
    isLoading: loading,
    reloadTemplates,
  } = useTemplates();
  const { savedServers, activeServerId } = useAuth();

  const activeServer = useMemo(
    () => savedServers.find((s) => s.id === activeServerId),
    [savedServers, activeServerId],
  );
  const [selection, setSelection] = useState<CaptureSelection | null>(null);
  const [categoryValue, setCategoryValue] = useState("");
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [values, setValues] = useState<Record<string, string | string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);
  const [form, setForm] = useState<TodoFormState>(emptyTodoFormState);
  const theme = useTheme();
  const { triggerRefresh } = useMutation();
  const { captureOrEnqueue } = useOutbox();
  const menu = useMenuPickerWorkaround();
  const promptRefs = useRef<Record<string, PromptFieldHandle | null>>({});
  const formFieldsRef = useRef<TodoFormFieldsHandle>(null);

  // Load default template when templates become available
  useEffect(() => {
    if (!templates) return;

    const templateKeys = Object.keys(templates);
    const defaultTemplate = activeServer?.defaultCaptureTemplate;

    if (defaultTemplate && templateKeys.includes(defaultTemplate)) {
      setSelection({ type: "template", key: defaultTemplate });
    } else if (templateKeys.length > 0) {
      setSelection({ type: "template", key: templateKeys[0] });
    }
  }, [templates, activeServer?.defaultCaptureTemplate]);

  // Fetch categories when category type is selected
  useEffect(() => {
    if (selection?.type !== "category") {
      setAvailableCategories([]);
      setCategoryValue("");
      return;
    }

    const fetchCategories = async () => {
      if (!api) return;
      setCategoriesLoading(true);
      try {
        const response = await api.getCategories(selection.categoryType.name);
        setAvailableCategories(response.categories);
      } catch (err) {
        console.error("Failed to fetch categories:", err);
        setAvailableCategories([]);
      } finally {
        setCategoriesLoading(false);
      }
    };

    fetchCategories();
  }, [selection, api]);

  // Reset form values when selection changes
  useEffect(() => {
    setValues({});
    setForm(emptyTodoFormState());
    setCategoryValue("");
  }, [selection]);

  const handleTemplateSelect = (key: string) =>
    menu.select(() => setSelection({ type: "template", key }));

  const handleCategoryTypeSelect = (categoryType: CategoryType) =>
    menu.select(() => setSelection({ type: "category", categoryType }));

  const selectedDisplayName = useMemo(() => {
    if (!selection) return "Select Template";
    if (selection.type === "template" && templates) {
      return templates[selection.key]?.name || "Select Template";
    }
    if (selection.type === "category") {
      return selection.categoryType.name;
    }
    return "Select Template";
  }, [selection, templates]);

  const selectedPrompts: TemplatePrompt[] = useMemo(() => {
    if (!selection) return [];
    if (selection.type === "template" && templates) {
      return templates[selection.key]?.prompts ?? [];
    }
    if (selection.type === "category") {
      return selection.categoryType.prompts;
    }
    return [];
  }, [selection, templates]);

  const handleValueChange = (promptName: string, value: string | string[]) => {
    setValues((prev) => ({ ...prev, [promptName]: value }));
  };

  const clearForm = () => {
    setValues({});
    setForm(emptyTodoFormState());
    setCategoryValue("");
  };

  const handleCapture = async () => {
    if (!selection || !api) return;

    setSubmitting(true);

    try {
      // Commit any half-typed tag text before reading the form values.
      const effectiveValues: Record<string, string | string[]> = { ...values };
      selectedPrompts
        .filter((p) => p.type === "tags")
        .forEach((p) => {
          const handle = promptRefs.current[p.name];
          if (handle) {
            effectiveValues[p.name] = handle.flushTags();
          }
        });
      const effectiveTags = formFieldsRef.current?.flushTags() ?? form.tags;

      // Validate required fields from prompts
      const missingRequired = selectedPrompts
        .filter((p) => p.required)
        .filter((p) => {
          const val = effectiveValues[p.name];
          if (Array.isArray(val)) return val.length === 0;
          return !val || (typeof val === "string" && !val.trim());
        })
        .map((p) => p.name);

      // For category captures, also require category
      if (selection.type === "category" && !categoryValue.trim()) {
        missingRequired.unshift("Category");
      }

      if (missingRequired.length > 0) {
        setMessage({
          text: `Missing required fields: ${missingRequired.join(", ")}`,
          isError: true,
        });
        setSubmitting(false);
        return;
      }

      // Build capture values
      const captureValues: Record<string, string | string[] | Timestamp> = {
        ...effectiveValues,
      };

      // Convert scheduled to Timestamp (combines date string + repeater)
      const scheduledTs = formStringToTimestamp(
        form.scheduled,
        form.scheduledRepeater,
      );
      if (scheduledTs) {
        captureValues.scheduled = scheduledTs;
      }

      // Convert deadline to Timestamp (combines date string + repeater)
      const deadlineTs = formStringToTimestamp(
        form.deadline,
        form.deadlineRepeater,
      );
      if (deadlineTs) {
        captureValues.deadline = deadlineTs;
      }

      if (form.priority) captureValues.priority = form.priority;
      if (effectiveTags.length) captureValues.tags = effectiveTags;
      if (form.state && form.state !== "TODO") captureValues.state = form.state;

      let outboxRequest: OutboxRequest;
      if (selection.type === "template") {
        outboxRequest = {
          kind: "capture",
          templateKey: selection.key,
          values: captureValues,
        };
      } else {
        // Category capture
        // Map prompt names to API field names
        const title = (captureValues.Title as string) || "";
        delete captureValues.Title;
        captureValues.title = title;

        outboxRequest = {
          kind: "category-capture",
          categoryType: selection.categoryType.name,
          category: categoryValue.trim(),
          values: captureValues,
        };
      }

      const result = await captureOrEnqueue(outboxRequest);

      if (result.outcome === "queued") {
        clearForm();
        setMessage({
          text: "Offline — capture queued, will send when reconnected",
          isError: false,
        });
      } else if (result.response.status === "created") {
        setMessage({ text: "Captured!", isError: false });
        clearForm();
        triggerRefresh();
      } else {
        setMessage({
          text: result.response.message || "Capture failed",
          isError: true,
        });
      }
    } catch (err) {
      // Permanent rejection, or the capture could not even be queued; keep
      // the user's input on screen.
      console.error("Capture failed:", err);
      setMessage({ text: "Failed to capture", isError: true });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View
        testID="captureLoadingView"
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const templateKeys = templates ? Object.keys(templates) : [];

  return (
    <ScreenContainer testID="captureScreen">
      <View style={styles.header}>
        <Menu
          visible={menu.visible}
          onDismiss={menu.close}
          anchor={
            <Button
              mode="outlined"
              onPress={menu.open}
              icon="chevron-down"
              contentStyle={styles.templateButtonContent}
              testID="templateSelector"
            >
              {selectedDisplayName}
            </Button>
          }
        >
          {templateKeys.length === 0 &&
            (!categoryTypes || categoryTypes.length === 0) && (
              <Menu.Item title="No templates available" disabled />
            )}
          {templateKeys.map((key) => (
            <Menu.Item
              key={key}
              onPress={() => handleTemplateSelect(key)}
              title={templates![key].name}
              leadingIcon={
                selection?.type === "template" && selection.key === key
                  ? "check"
                  : undefined
              }
              testID={`menuItem-${key}`}
            />
          ))}
          {categoryTypes && categoryTypes.length > 0 && (
            <>
              <Divider />
              {categoryTypes.map((ct) => (
                <Menu.Item
                  key={`category-${ct.name}`}
                  onPress={() => handleCategoryTypeSelect(ct)}
                  title={ct.name}
                  leadingIcon={
                    selection?.type === "category" &&
                    selection.categoryType.name === ct.name
                      ? "check"
                      : "folder"
                  }
                  testID={`menuItem-category-${ct.name}`}
                />
              ))}
            </>
          )}
        </Menu>
        <IconButton
          icon="refresh"
          size={20}
          onPress={reloadTemplates}
          testID="reloadTemplatesButton"
        />
      </View>

      <Divider />

      <KeyboardAwareContainer style={styles.formContainer}>
        <ScrollView
          style={styles.formContainer}
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Category field for category type captures */}
          {selection?.type === "category" && (
            <CategoryField
              categories={availableCategories}
              value={categoryValue}
              onChange={setCategoryValue}
              loading={categoriesLoading}
            />
          )}

          {/* Template prompts */}
          {selectedPrompts.map((prompt) => (
            <PromptField
              key={prompt.name}
              ref={(handle) => {
                promptRefs.current[prompt.name] = handle;
              }}
              prompt={prompt}
              value={values[prompt.name] || (prompt.type === "tags" ? [] : "")}
              onChange={(value) => handleValueChange(prompt.name, value)}
            />
          ))}

          <Button
            testID="captureButtonTop"
            mode="contained"
            onPress={handleCapture}
            loading={submitting}
            disabled={submitting || !selection}
            style={styles.captureButton}
            icon="check"
          >
            Capture
          </Button>

          {/* Universal org-mode fields */}
          <Divider style={styles.optionsDivider} />

          <TodoFormFields
            ref={formFieldsRef}
            value={form}
            onChange={setForm}
            tagsDefaultExpanded
          />

          <Button
            testID="captureButton"
            mode="contained"
            onPress={handleCapture}
            loading={submitting}
            disabled={submitting || !selection}
            style={styles.captureButton}
            icon="check"
          >
            Capture
          </Button>
        </ScrollView>
      </KeyboardAwareContainer>

      <Snackbar
        visible={!!message}
        onDismiss={() => setMessage(null)}
        duration={3000}
        style={
          message?.isError ? { backgroundColor: theme.colors.error } : undefined
        }
      >
        {message?.text}
      </Snackbar>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingBottom: 12,
  },
  templateButtonContent: {
    flexDirection: "row-reverse",
  },
  formContainer: {
    flex: 1,
  },
  formContent: {
    padding: 16,
    paddingTop: 8,
  },
  captureButton: {
    marginTop: 8,
  },
  optionsDivider: {
    marginVertical: 16,
  },
});
