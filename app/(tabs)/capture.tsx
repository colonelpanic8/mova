import { PriorityPicker, StatePicker } from "@/components/capture";
import { useAuth } from "@/context/AuthContext";
import { api, TemplatePrompt, TemplatesResponse } from "@/services/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import React, { useCallback, useEffect, useState } from "react";
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

const LAST_TEMPLATE_KEY = "mova_last_template";

function formatDateForApi(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatDateForDisplay(dateString: string): string {
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
  const [templates, setTemplates] = useState<TemplatesResponse | null>(null);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string | null>(
    null,
  );
  const [values, setValues] = useState<Record<string, string | string[]>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [optionalFields, setOptionalFields] = useState<{
    scheduled?: string;
    deadline?: string;
    priority?: string | null;
    tags?: string[];
    todo?: string;
  }>({});
  const { apiUrl, username, password } = useAuth();
  const theme = useTheme();

  const loadTemplates = useCallback(async () => {
    if (!apiUrl || !username || !password) return;

    try {
      api.configure(apiUrl, username, password);
      const data = await api.getTemplates();
      setTemplates(data);

      // Load last used template or default to first template
      const lastTemplate = await AsyncStorage.getItem(LAST_TEMPLATE_KEY);
      const templateKeys = Object.keys(data);

      if (lastTemplate && templateKeys.includes(lastTemplate)) {
        setSelectedTemplateKey(lastTemplate);
      } else if (templateKeys.length > 0) {
        // Default to first template
        setSelectedTemplateKey(templateKeys[0]);
      }
    } catch (err) {
      console.error("Failed to load templates:", err);
      setMessage({ text: "Failed to load capture templates", isError: true });
    } finally {
      setLoading(false);
    }
  }, [apiUrl, username, password]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Reset form values when template changes
  useEffect(() => {
    setValues({});
    setOptionalFields({});
  }, [selectedTemplateKey]);

  const handleOptionalFieldChange = <K extends keyof typeof optionalFields>(
    field: K,
    value: (typeof optionalFields)[K],
  ) => {
    setOptionalFields((prev) => ({ ...prev, [field]: value }));
  };

  const selectedTemplate =
    selectedTemplateKey && templates ? templates[selectedTemplateKey] : null;

  const handleTemplateSelect = (key: string) => {
    // Close menu first, then update state after menu animation completes
    // This fixes Android issue where menu won't reopen after selection
    setMenuVisible(false);
    setTimeout(() => {
      setSelectedTemplateKey(key);
      AsyncStorage.setItem(LAST_TEMPLATE_KEY, key);
    }, 0);
  };

  const handleValueChange = (promptName: string, value: string | string[]) => {
    setValues((prev) => ({ ...prev, [promptName]: value }));
  };

  const handleCapture = async () => {
    if (!selectedTemplateKey || !selectedTemplate) return;

    setSubmitting(true);

    try {
      // Validate required fields
      const missingRequired = selectedTemplate.prompts
        .filter((p) => p.required)
        .filter((p) => {
          const val = values[p.name];
          if (Array.isArray(val)) return val.length === 0;
          return !val || (typeof val === "string" && !val.trim());
        })
        .map((p) => p.name);

      if (missingRequired.length > 0) {
        setMessage({
          text: `Missing required fields: ${missingRequired.join(", ")}`,
          isError: true,
        });
        setSubmitting(false);
        return;
      }

      // Merge template values with optional fields
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

      console.log("Capture request:", {
        template: selectedTemplateKey,
        values: captureValues,
      });
      const result = await api.capture(selectedTemplateKey, captureValues);
      console.log("Capture response:", result);
      if (result.status === "created") {
        setMessage({ text: "Captured!", isError: false });
        setValues({});
        setOptionalFields({});
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
              {selectedTemplate?.name || "Select Template"}
            </Button>
          }
        >
          {templateKeys.map((key) => (
            <Menu.Item
              key={key}
              onPress={() => handleTemplateSelect(key)}
              title={templates![key].name}
              leadingIcon={key === selectedTemplateKey ? "check" : undefined}
              testID={`menuItem-${key}`}
            />
          ))}
        </Menu>
      </View>

      <Divider />

      <ScrollView
        style={styles.formContainer}
        contentContainerStyle={styles.formContent}
      >
        {/* Template prompts */}
        {selectedTemplate?.prompts.map((prompt) => (
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
        />

        <PromptField
          prompt={{ name: "Schedule", type: "date", required: false }}
          value={optionalFields.scheduled || ""}
          onChange={(v) => handleOptionalFieldChange("scheduled", v as string)}
        />

        <PromptField
          prompt={{ name: "Deadline", type: "date", required: false }}
          value={optionalFields.deadline || ""}
          onChange={(v) => handleOptionalFieldChange("deadline", v as string)}
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
          disabled={submitting}
          style={styles.captureButton}
          icon="check"
        >
          Capture
        </Button>
      </ScrollView>

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
