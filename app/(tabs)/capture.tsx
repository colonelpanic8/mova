import {
  CategoryField,
  PriorityPicker,
  StatePicker,
} from "@/components/capture";
import { KeyboardAwareContainer } from "@/components/KeyboardAwareContainer";
import { RepeaterPicker } from "@/components/RepeaterPicker";
import { ScreenContainer } from "@/components/ScreenContainer";
import { DateFieldWithQuickActions } from "@/components/todoForm";
import { useApi } from "@/context/ApiContext";
import { useAuth } from "@/context/AuthContext";
import { useMutation } from "@/context/MutationContext";
import { useSettings } from "@/context/SettingsContext";
import { useTemplates } from "@/context/TemplatesContext";
import {
  CategoryType,
  Repeater,
  TemplatePrompt,
  Timestamp,
} from "@/services/api";
import {
  formatLocalDate as formatDateForApi,
  formatDateForDisplay,
} from "@/utils/dateFormatting";
import { formStringToTimestamp } from "@/utils/timestampConversion";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
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

type CaptureSelection =
  | { type: "template"; key: string }
  | { type: "category"; categoryType: CategoryType };

interface PromptFieldProps {
  prompt: TemplatePrompt;
  value: string | string[];
  onChange: (value: string | string[]) => void;
  registerTagFlusher?: (flusher: (() => string[]) | null) => void;
}

function PromptField({
  prompt,
  value,
  onChange,
  registerTagFlusher,
}: PromptFieldProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tagInputValue, setTagInputValue] = useState("");
  const tagsArray = useMemo(
    () =>
      Array.isArray(value)
        ? value
        : typeof value === "string" && value
          ? value.split(",").map((t) => t.trim())
          : [],
    [value],
  );

  const handleDateChange = useCallback(
    (event: DateTimePickerEvent, date?: Date) => {
      setShowDatePicker(Platform.OS === "ios");
      if (date) {
        onChange(formatDateForApi(date));
      }
    },
    [onChange],
  );

  const flushPendingTag = useCallback((): string[] => {
    const trimmedTag = tagInputValue.trim();
    if (!trimmedTag) {
      return tagsArray;
    }

    const newTags = tagsArray.includes(trimmedTag)
      ? tagsArray
      : [...tagsArray, trimmedTag];
    onChange(newTags);
    setTagInputValue("");
    return newTags;
  }, [onChange, tagInputValue, tagsArray]);

  useEffect(() => {
    if (prompt.type !== "tags" || !registerTagFlusher) return;
    registerTagFlusher(flushPendingTag);
    return () => registerTagFlusher(null);
  }, [flushPendingTag, prompt.type, registerTagFlusher]);

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
            onSubmitEditing={() => flushPendingTag()}
            onEndEditing={() => flushPendingTag()}
            style={styles.tagInput}
            dense
          />
          <IconButton icon="plus" onPress={() => flushPendingTag()} />
        </View>
      </View>
    );
  }

  // Default: string type
  const stringValue = typeof value === "string" ? value : "";
  return (
    <View style={styles.textFieldContainer}>
      <TextInput
        label={`${prompt.name}${prompt.required ? " *" : ""}`}
        value={stringValue}
        onChangeText={(text) => onChange(text)}
        mode="outlined"
        style={styles.textFieldInput}
        multiline={
          prompt.name.toLowerCase() === "title" ||
          prompt.name.toLowerCase() === "body"
        }
        numberOfLines={prompt.name.toLowerCase() === "body" ? 4 : 2}
      />
    </View>
  );
}

export default function CaptureScreen() {
  const api = useApi();
  const {
    templates,
    categoryTypes,
    filterOptions,
    isLoading: loading,
    reloadTemplates,
  } = useTemplates();
  const { savedServers, activeServerId } = useAuth();
  const { quickScheduleIncludeTime } = useSettings();

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
  const promptTagFlusherRef = useRef<Record<string, () => string[]>>({});
  const optionalTagsFlusherRef = useRef<(() => string[]) | null>(null);

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
    if (!selection || !api) return;

    setSubmitting(true);

    try {
      const effectiveValues: Record<string, string | string[]> = { ...values };
      selectedPrompts
        .filter((p) => p.type === "tags")
        .forEach((p) => {
          const flushTagInput = promptTagFlusherRef.current[p.name];
          if (flushTagInput) {
            effectiveValues[p.name] = flushTagInput();
          }
        });

      const effectiveOptionalFields = { ...optionalFields };
      if (optionalTagsFlusherRef.current) {
        effectiveOptionalFields.tags = optionalTagsFlusherRef.current();
      }

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
        effectiveOptionalFields.scheduled || "",
        effectiveOptionalFields.scheduledRepeater || null,
      );
      if (scheduledTs) {
        captureValues.scheduled = scheduledTs;
      }

      // Convert deadline to Timestamp (combines date string + repeater)
      const deadlineTs = formStringToTimestamp(
        effectiveOptionalFields.deadline || "",
        effectiveOptionalFields.deadlineRepeater || null,
      );
      if (deadlineTs) {
        captureValues.deadline = deadlineTs;
      }

      if (effectiveOptionalFields.priority)
        captureValues.priority = effectiveOptionalFields.priority;
      if (effectiveOptionalFields.tags?.length)
        captureValues.tags = effectiveOptionalFields.tags;
      if (
        effectiveOptionalFields.todo &&
        effectiveOptionalFields.todo !== "TODO"
      )
        captureValues.state = effectiveOptionalFields.todo;

      let result;
      if (selection.type === "template") {
        result = await api.capture(selection.key, captureValues);
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
    <ScreenContainer testID="captureScreen">
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
              prompt={prompt}
              value={values[prompt.name] || (prompt.type === "tags" ? [] : "")}
              onChange={(value) => handleValueChange(prompt.name, value)}
              registerTagFlusher={
                prompt.type === "tags"
                  ? (flusher) => {
                      if (flusher) {
                        promptTagFlusherRef.current[prompt.name] = flusher;
                      } else {
                        delete promptTagFlusherRef.current[prompt.name];
                      }
                    }
                  : undefined
              }
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
            registerTagFlusher={(flusher) => {
              optionalTagsFlusherRef.current = flusher;
            }}
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
  textFieldContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  textFieldInput: {
    flex: 1,
  },
});
