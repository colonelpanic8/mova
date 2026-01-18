import { PriorityPicker, StatePicker } from "@/components/capture";
import { RepeaterPicker } from "@/components/RepeaterPicker";
import { useAuth } from "@/context/AuthContext";
import { useColorPalette } from "@/context/ColorPaletteContext";
import {
  api,
  Repeater,
  TemplatePrompt,
  TemplatesResponse,
} from "@/services/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import React, { useCallback, useEffect, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
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

function formatDateTimeForApi(date: Date, includeTime: boolean): string {
  if (includeTime) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }
  return formatDateForApi(date);
}

interface DateFieldWithQuickActionsProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  colorKey: "schedule" | "deadline";
}

function DateFieldWithQuickActions({
  label,
  value,
  onChange,
  colorKey,
}: DateFieldWithQuickActionsProps) {
  const theme = useTheme();
  const { getActionColor } = useColorPalette();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [includeTime, setIncludeTime] = useState(
    value.includes("T") || value.includes(" "),
  );
  const [tempDate, setTempDate] = useState<Date>(new Date());

  const handleToday = useCallback(() => {
    const today = new Date();
    if (includeTime) {
      today.setHours(9, 0, 0, 0); // Default to 9 AM
    }
    onChange(formatDateTimeForApi(today, includeTime));
  }, [includeTime, onChange]);

  const handleTomorrow = useCallback(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (includeTime) {
      tomorrow.setHours(9, 0, 0, 0); // Default to 9 AM
    }
    onChange(formatDateTimeForApi(tomorrow, includeTime));
  }, [includeTime, onChange]);

  const handleDateChange = useCallback(
    (event: DateTimePickerEvent, date?: Date) => {
      if (Platform.OS !== "ios") {
        setShowDatePicker(false);
      }
      if (event.type === "dismissed") {
        return;
      }
      if (date) {
        if (includeTime) {
          setTempDate(date);
          if (Platform.OS !== "ios") {
            setShowTimePicker(true);
          }
        } else {
          onChange(formatDateTimeForApi(date, false));
          if (Platform.OS === "ios") {
            setShowDatePicker(false);
          }
        }
      }
    },
    [includeTime, onChange],
  );

  const handleTimeChange = useCallback(
    (event: DateTimePickerEvent, date?: Date) => {
      setShowTimePicker(false);
      if (event.type === "dismissed") {
        return;
      }
      if (date) {
        const combined = new Date(tempDate);
        combined.setHours(date.getHours(), date.getMinutes(), 0, 0);
        onChange(formatDateTimeForApi(combined, true));
      }
    },
    [tempDate, onChange],
  );

  const handleTimeToggle = useCallback(() => {
    const newIncludeTime = !includeTime;
    setIncludeTime(newIncludeTime);

    // If we have a value, update it to include/exclude time
    if (value) {
      const currentDate =
        value.includes("T") || value.includes(" ")
          ? new Date(value.replace(" ", "T"))
          : new Date(value + "T09:00:00");

      if (newIncludeTime) {
        // Adding time - default to 9 AM if switching from date-only
        if (!value.includes("T") && !value.includes(" ")) {
          currentDate.setHours(9, 0, 0, 0);
        }
        onChange(formatDateTimeForApi(currentDate, true));
      } else {
        // Removing time
        onChange(formatDateForApi(currentDate));
      }
    }
  }, [includeTime, value, onChange]);

  const handleClear = useCallback(() => {
    onChange("");
  }, [onChange]);

  const handleOpenPicker = useCallback(() => {
    if (value) {
      const date =
        value.includes("T") || value.includes(" ")
          ? new Date(value.replace(" ", "T"))
          : new Date(value + "T00:00:00");
      setTempDate(date);
    } else {
      setTempDate(new Date());
    }
    setShowDatePicker(true);
  }, [value]);

  const todayColor = getActionColor("today");
  const tomorrowColor = getActionColor("tomorrow");
  const fieldColor = getActionColor(colorKey);

  // Web implementation
  if (Platform.OS === "web") {
    return (
      <View style={styles.fieldContainer}>
        <Text variant="bodySmall" style={styles.fieldLabel}>
          {label}
        </Text>
        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            style={[styles.quickActionButton, { backgroundColor: todayColor }]}
            onPress={handleToday}
          >
            <Text style={styles.quickActionText}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.quickActionButton,
              { backgroundColor: tomorrowColor },
            ]}
            onPress={handleTomorrow}
          >
            <Text style={styles.quickActionText}>Tomorrow</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.quickActionButton,
              {
                backgroundColor: includeTime
                  ? theme.colors.primary
                  : theme.colors.surfaceVariant,
              },
            ]}
            onPress={handleTimeToggle}
          >
            <Text
              style={[
                styles.quickActionText,
                {
                  color: includeTime ? "white" : theme.colors.onSurfaceVariant,
                },
              ]}
            >
              Time
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.dateInputRow}>
          <input
            type={includeTime ? "datetime-local" : "date"}
            value={
              includeTime && value
                ? value.replace(" ", "T")
                : value.split(" ")[0] || ""
            }
            onChange={(e) => {
              if (e.target.value) {
                const newValue = includeTime
                  ? e.target.value.replace("T", " ")
                  : e.target.value;
                onChange(newValue);
              }
            }}
            style={{
              flex: 1,
              padding: 12,
              fontSize: 16,
              borderRadius: 4,
              border: `1px solid ${fieldColor}`,
              backgroundColor: "transparent",
            }}
          />
          {value && <IconButton icon="close" size={20} onPress={handleClear} />}
        </View>
      </View>
    );
  }

  // Native implementation
  return (
    <View style={styles.fieldContainer}>
      <Text variant="bodySmall" style={styles.fieldLabel}>
        {label}
      </Text>
      <View style={styles.quickActionsRow}>
        <TouchableOpacity
          style={[styles.quickActionButton, { backgroundColor: todayColor }]}
          onPress={handleToday}
        >
          <Text style={styles.quickActionText}>Today</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickActionButton, { backgroundColor: tomorrowColor }]}
          onPress={handleTomorrow}
        >
          <Text style={styles.quickActionText}>Tomorrow</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.quickActionButton,
            {
              backgroundColor: includeTime
                ? theme.colors.primary
                : theme.colors.surfaceVariant,
            },
          ]}
          onPress={handleTimeToggle}
        >
          <Text
            style={[
              styles.quickActionText,
              { color: includeTime ? "white" : theme.colors.onSurfaceVariant },
            ]}
          >
            Time
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.dateButtonRow}>
        <Button
          mode="outlined"
          onPress={handleOpenPicker}
          style={[styles.dateButton, { borderColor: fieldColor }]}
          icon="calendar"
        >
          {value ? formatDateForDisplay(value) : `Select ${label}`}
        </Button>
        {value && (
          <IconButton
            icon="close"
            size={20}
            onPress={handleClear}
            style={styles.clearButtonInline}
          />
        )}
      </View>
      {showDatePicker && (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleDateChange}
        />
      )}
      {showTimePicker && (
        <DateTimePicker
          value={tempDate}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleTimeChange}
        />
      )}
    </View>
  );
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
    scheduledRepeater?: Repeater | null;
    deadlineRepeater?: Repeater | null;
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
      const missingRequired = (selectedTemplate.prompts ?? [])
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
      const captureValues: Record<string, string | string[] | Repeater> = {
        ...values,
      };
      if (optionalFields.scheduled)
        captureValues.scheduled = optionalFields.scheduled;
      if (optionalFields.deadline)
        captureValues.deadline = optionalFields.deadline;
      if (optionalFields.scheduledRepeater)
        captureValues.scheduledRepeater = optionalFields.scheduledRepeater;
      if (optionalFields.deadlineRepeater)
        captureValues.deadlineRepeater = optionalFields.deadlineRepeater;
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
        {(selectedTemplate?.prompts ?? []).map((prompt) => (
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

        <DateFieldWithQuickActions
          label="Schedule"
          value={optionalFields.scheduled || ""}
          onChange={(v) => handleOptionalFieldChange("scheduled", v)}
          colorKey="schedule"
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
  quickActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  quickActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  quickActionText: {
    color: "white",
    fontSize: 13,
    fontWeight: "600",
  },
  dateButtonRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  clearButtonInline: {
    marginLeft: -8,
  },
});
