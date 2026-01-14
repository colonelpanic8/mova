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
const QUICK_CAPTURE_KEY = "__quick_capture__";

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
  const { apiUrl, username, password } = useAuth();
  const theme = useTheme();

  const loadTemplates = useCallback(async () => {
    if (!apiUrl || !username || !password) return;

    try {
      api.configure(apiUrl, username, password);
      const data = await api.getTemplates();
      setTemplates(data);

      // Load last used template
      const lastTemplate = await AsyncStorage.getItem(LAST_TEMPLATE_KEY);
      const templateKeys = Object.keys(data);

      if (lastTemplate === QUICK_CAPTURE_KEY) {
        setSelectedTemplateKey(QUICK_CAPTURE_KEY);
      } else if (lastTemplate && templateKeys.includes(lastTemplate)) {
        setSelectedTemplateKey(lastTemplate);
      } else {
        // Default to Quick Capture
        setSelectedTemplateKey(QUICK_CAPTURE_KEY);
      }
    } catch (err) {
      console.error("Failed to load templates:", err);
      setMessage({ text: "Failed to load capture templates", isError: true });
      // Even if templates fail to load, we can still use Quick Capture
      setSelectedTemplateKey(QUICK_CAPTURE_KEY);
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
  }, [selectedTemplateKey]);

  const isQuickCapture = selectedTemplateKey === QUICK_CAPTURE_KEY;
  const selectedTemplate =
    selectedTemplateKey && templates && !isQuickCapture
      ? templates[selectedTemplateKey]
      : null;

  const handleTemplateSelect = async (key: string) => {
    setSelectedTemplateKey(key);
    setMenuVisible(false);
    await AsyncStorage.setItem(LAST_TEMPLATE_KEY, key);
  };

  const handleValueChange = (promptName: string, value: string | string[]) => {
    setValues((prev) => ({ ...prev, [promptName]: value }));
  };

  const handleCapture = async () => {
    if (!selectedTemplateKey) return;

    setSubmitting(true);

    try {
      if (isQuickCapture) {
        // Quick Capture: just create a simple todo with title
        const title =
          typeof values["title"] === "string" ? values["title"].trim() : "";
        if (!title) {
          setMessage({ text: "Please enter a title", isError: true });
          setSubmitting(false);
          return;
        }

        const result = await api.createTodo(title);
        if (result.status === "created") {
          setMessage({ text: "Captured!", isError: false });
          setValues({});
        } else {
          setMessage({ text: "Capture failed", isError: true });
        }
      } else {
        // Template-based capture
        if (!selectedTemplate) return;

        // Validate required fields
        const missingRequired = selectedTemplate.prompts
          .filter((p) => p.required)
          .filter((p) => {
            const val = values[p.name];
            if (Array.isArray(val)) return val.length === 0;
            return !val || !val.trim();
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

        const result = await api.capture(selectedTemplateKey, values);
        if (result.status === "created") {
          setMessage({ text: "Captured!", isError: false });
          setValues({});
        } else {
          setMessage({
            text: result.message || "Capture failed",
            isError: true,
          });
        }
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
  const hasTemplates = templateKeys.length > 0;

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
              {isQuickCapture
                ? "Quick Capture"
                : selectedTemplate?.name || "Select Template"}
            </Button>
          }
        >
          <Menu.Item
            key={QUICK_CAPTURE_KEY}
            onPress={() => handleTemplateSelect(QUICK_CAPTURE_KEY)}
            title="Quick Capture"
            leadingIcon={isQuickCapture ? "check" : "lightning-bolt"}
            testID="menuItem-quick-capture"
          />
          {hasTemplates && <Divider />}
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
        {isQuickCapture ? (
          <TextInput
            label="Title *"
            value={typeof values["title"] === "string" ? values["title"] : ""}
            onChangeText={(text) => handleValueChange("title", text)}
            mode="outlined"
            style={styles.input}
            multiline
            numberOfLines={2}
            autoFocus
          />
        ) : (
          selectedTemplate?.prompts.map((prompt) => (
            <PromptField
              key={prompt.name}
              prompt={prompt}
              value={values[prompt.name] || (prompt.type === "tags" ? [] : "")}
              onChange={(value) => handleValueChange(prompt.name, value)}
            />
          ))
        )}

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
  captureButton: {
    marginTop: 8,
  },
});
