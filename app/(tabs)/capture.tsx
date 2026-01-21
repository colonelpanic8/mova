import {
  CategoryField,
  PriorityPicker,
  StatePicker,
} from "@/components/capture";
import { RepeaterPicker } from "@/components/RepeaterPicker";
import { DateFieldWithQuickActions } from "@/components/todoForm";
import { useMutation } from "@/context/MutationContext";
import { useSettings } from "@/context/SettingsContext";
import { useTemplates } from "@/context/TemplatesContext";
import { api, CategoryType, Repeater, TemplatePrompt } from "@/services/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Button,
  Chip,
  Divider,
  IconButton,
  Menu,
  Snackbar,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

const LAST_TEMPLATE_KEY = "mova_last_template";

type CaptureSelection =
  | { type: "template"; key: string }
  | { type: "category"; categoryType: CategoryType };

function formatDateForApi(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatDateForDisplay(dateString: string): string {
  // Check if the string includes time
  if (dateString.includes("T") || dateString.includes(" ")) {
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface PromptFieldProps {
  prompt: TemplatePrompt;
  value: string | string[];
  onChange: (value: string | string[]) => void;
}

function PromptField({ prompt, value, onChange }: PromptFieldProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tagInputValue, setTagInputValue] = useState("");

  const handleDateChange = useCallback(
    (event: DateTimePickerEvent, date?: Date) => {
      setShowDatePicker(Platform.OS === "ios");
      if (date) {
        onChange(formatDateForApi(date));
      }
    },
    [onChange],
  );

  if (prompt.type === "date") {
    const dateValue = typeof value === "string" ? value : "";

    // Use native HTML date input on web
    if (Platform.OS === "web") {
      return (
        <View style={styles.fieldContainer}>
          <Text variant="bodySmall" style={styles.fieldLabel}>
            {prompt.name}
            {prompt.required ? " *" : ""}
          </Text>
          <View style={styles.dateInputRow}>
            <input
              type="date"
              value={dateValue}
              onChange={(e) => onChange(e.target.value)}
              style={{
                flex: 1,
                padding: 12,
                fontSize: 16,
                borderRadius: 4,
                border: "1px solid #79747E",
                backgroundColor: "transparent",
              }}
            />
            {dateValue && (
              <IconButton icon="close" size={20} onPress={() => onChange("")} />
            )}
          </View>
        </View>
      );
    }

    return (
      <View style={styles.fieldContainer}>
        <Button
          mode="outlined"
          onPress={() => setShowDatePicker(true)}
          style={styles.dateButton}
          icon="calendar"
        >
          {dateValue
            ? formatDateForDisplay(dateValue)
            : `Select ${prompt.name}${prompt.required ? " *" : ""}`}
        </Button>
        {dateValue && (
          <IconButton
            icon="close"
            size={20}
            onPress={() => onChange("")}
            style={styles.clearButton}
          />
        )}
        {showDatePicker && (
          <DateTimePicker
            value={dateValue ? new Date(dateValue + "T00:00:00") : new Date()}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleDateChange}
          />
        )}
      </View>
    );
  }

  if (prompt.type === "tags") {
    const tagsArray = Array.isArray(value)
      ? value
      : typeof value === "string" && value
        ? value.split(",").map((t) => t.trim())
        : [];

    const addTag = () => {
      if (tagInputValue.trim()) {
        const newTags = [...tagsArray, tagInputValue.trim()];
        onChange(newTags);
        setTagInputValue("");
      }
    };

    const removeTag = (index: number) => {
      const newTags = tagsArray.filter((_, i) => i !== index);
      onChange(newTags);
    };

    return (
      <View style={styles.fieldContainer}>
        <Text variant="bodySmall" style={styles.fieldLabel}>
          {prompt.name}
          {prompt.required ? " *" : ""}
        </Text>
        <View style={styles.tagsContainer}>
          {tagsArray.map((tag, index) => (
            <Chip
              key={`${tag}-${index}`}
              onClose={() => removeTag(index)}
              style={styles.tag}
            >
              {tag}
            </Chip>
          ))}
        </View>
        <View style={styles.tagInputRow}>
          <TextInput
            mode="outlined"
            placeholder="Add tag..."
            value={tagInputValue}
            onChangeText={setTagInputValue}
            onSubmitEditing={addTag}
            style={styles.tagInput}
            dense
          />
          <IconButton icon="plus" onPress={addTag} />
        </View>
      </View>
    );
  }

  // Default: string type
  const stringValue = typeof value === "string" ? value : "";
  return (
    <TextInput
      label={`${prompt.name}${prompt.required ? " *" : ""}`}
      value={stringValue}
      onChangeText={(text) => onChange(text)}
      mode="outlined"
      style={styles.input}
      multiline={
        prompt.name.toLowerCase() === "title" ||
        prompt.name.toLowerCase() === "body"
      }
      numberOfLines={prompt.name.toLowerCase() === "body" ? 4 : 2}
    />
  );
}

export default function CaptureScreen() {
  const {
    templates,
    categoryTypes,
    filterOptions,
    isLoading: loading,
    reloadTemplates,
  } = useTemplates();
  const { quickScheduleIncludeTime } = useSettings();
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
  const [menuVisible, setMenuVisible] = useState(false);
  const [optionalFields, setOptionalFields] = useState<{
    scheduled?: string;
    deadline?: string;
    scheduledRepeater?: Repeater | null;
    deadlineRepeater?: Repeater | null;
    priority?: string | null;
    tags?: string[];
    todo?: string;
  }>({});
  const theme = useTheme();
  const { triggerRefresh } = useMutation();

  // Load last used template when templates become available
  useEffect(() => {
    if (!templates) return;

    const loadLastTemplate = async () => {
      const lastTemplate = await AsyncStorage.getItem(LAST_TEMPLATE_KEY);
      const templateKeys = Object.keys(templates);

      if (lastTemplate && templateKeys.includes(lastTemplate)) {
        setSelection({ type: "template", key: lastTemplate });
      } else if (templateKeys.length > 0) {
        setSelection({ type: "template", key: templateKeys[0] });
      }
    };

    loadLastTemplate();
  }, [templates]);

  // Fetch categories when category type is selected
  useEffect(() => {
    if (selection?.type !== "category") {
      setAvailableCategories([]);
      setCategoryValue("");
      return;
    }

    const fetchCategories = async () => {
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
  }, [selection]);

  // Reset form values when selection changes
  useEffect(() => {
    setValues({});
    setOptionalFields({});
    setCategoryValue("");
  }, [selection]);

  const handleOptionalFieldChange = <K extends keyof typeof optionalFields>(
    field: K,
    value: (typeof optionalFields)[K],
  ) => {
    setOptionalFields((prev) => ({ ...prev, [field]: value }));
  };

  const handleTemplateSelect = (key: string) => {
    setMenuVisible(false);
    setTimeout(() => {
      setSelection({ type: "template", key });
      AsyncStorage.setItem(LAST_TEMPLATE_KEY, key);
    }, 0);
  };

  const handleCategoryTypeSelect = (categoryType: CategoryType) => {
    setMenuVisible(false);
    setTimeout(() => {
      setSelection({ type: "category", categoryType });
    }, 0);
  };

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

  const handleCapture = async () => {
    if (!selection) return;

    setSubmitting(true);

    try {
      // Validate required fields from prompts
      const missingRequired = selectedPrompts
        .filter((p) => p.required)
        .filter((p) => {
          const val = values[p.name];
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
      const captureValues: Record<string, string | string[]> = { ...values };
      if (optionalFields.scheduled)
        captureValues.scheduled = optionalFields.scheduled;
      if (optionalFields.deadline)
        captureValues.deadline = optionalFields.deadline;
      if (optionalFields.priority)
        captureValues.priority = optionalFields.priority;
      if (optionalFields.tags?.length) captureValues.tags = optionalFields.tags;
      if (optionalFields.todo && optionalFields.todo !== "TODO")
        captureValues.todo = optionalFields.todo;

      let result;
      if (selection.type === "template") {
        // For template captures, include repeaters
        const templateCaptureValues: Record<
          string,
          string | string[] | Repeater
        > = { ...captureValues };
        if (optionalFields.scheduledRepeater)
          templateCaptureValues.scheduledRepeater =
            optionalFields.scheduledRepeater;
        if (optionalFields.deadlineRepeater)
          templateCaptureValues.deadlineRepeater =
            optionalFields.deadlineRepeater;
        result = await api.capture(selection.key, templateCaptureValues);
      } else {
        // Category capture
        // Map prompt names to API field names
        const title = (captureValues.Title as string) || "";
        delete captureValues.Title;
        captureValues.title = title;

        result = await api.categoryCapture(
          selection.categoryType.name,
          categoryValue.trim(),
          captureValues,
        );
      }

      if (result.status === "created") {
        setMessage({ text: "Captured!", isError: false });
        setValues({});
        setOptionalFields({});
        setCategoryValue("");
        triggerRefresh();
      } else {
        setMessage({
          text: result.message || "Capture failed",
          isError: true,
        });
      }
    } catch (err) {
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
    <View
      testID="captureScreen"
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.header}>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <Button
              mode="outlined"
              onPress={() => setMenuVisible(true)}
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

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.formContainer}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
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
              prompt={prompt}
              value={values[prompt.name] || (prompt.type === "tags" ? [] : "")}
              onChange={(value) => handleValueChange(prompt.name, value)}
            />
          ))}

          {/* Universal org-mode fields */}
          <Divider style={styles.optionsDivider} />

          <StatePicker
            value={optionalFields.todo || "TODO"}
            onChange={(v) => handleOptionalFieldChange("todo", v)}
          />

          <PriorityPicker
            value={optionalFields.priority || null}
            onChange={(v) => handleOptionalFieldChange("priority", v)}
            priorities={filterOptions?.priorities}
          />

          <DateFieldWithQuickActions
            label="Schedule"
            value={optionalFields.scheduled || ""}
            onChange={(v) => handleOptionalFieldChange("scheduled", v)}
            colorKey="schedule"
            includeTime={quickScheduleIncludeTime}
          />

          <RepeaterPicker
            value={optionalFields.scheduledRepeater || null}
            onChange={(v) => handleOptionalFieldChange("scheduledRepeater", v)}
            label="Schedule Repeater"
          />

          <DateFieldWithQuickActions
            label="Deadline"
            value={optionalFields.deadline || ""}
            onChange={(v) => handleOptionalFieldChange("deadline", v)}
            colorKey="deadline"
            includeTime={quickScheduleIncludeTime}
          />

          <RepeaterPicker
            value={optionalFields.deadlineRepeater || null}
            onChange={(v) => handleOptionalFieldChange("deadlineRepeater", v)}
            label="Deadline Repeater"
          />

          <PromptField
            prompt={{ name: "Tags", type: "tags", required: false }}
            value={optionalFields.tags || []}
            onChange={(v) => handleOptionalFieldChange("tags", v as string[])}
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
      </KeyboardAvoidingView>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
  input: {
    marginBottom: 16,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    marginBottom: 8,
    opacity: 0.7,
  },
  dateButton: {
    flex: 1,
  },
  clearButton: {
    position: "absolute",
    right: 0,
    top: 0,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  tag: {
    marginRight: 4,
  },
  tagInputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  tagInput: {
    flex: 1,
  },
  dateInputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  captureButton: {
    marginTop: 8,
  },
  optionsDivider: {
    marginVertical: 16,
  },
});
