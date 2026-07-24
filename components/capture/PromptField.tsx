import { PlatformDatePicker } from "@/components/PlatformDatePicker";
import { TagsEditor, TagsEditorHandle } from "@/components/TagsEditor";
import { TemplatePrompt } from "@/services/api";
import {
  formatLocalDate as formatDateForApi,
  formatDateForDisplay,
} from "@/utils/dateFormatting";
import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Button, IconButton, Text, TextInput } from "react-native-paper";

export interface PromptFieldHandle {
  /**
   * For tags prompts: commit any tag text typed but not yet added and
   * return the resulting tags, so submits don't lose a half-entered tag.
   */
  flushTags: () => string[];
}

export interface PromptFieldProps {
  prompt: TemplatePrompt;
  value: string | string[];
  onChange: (value: string | string[]) => void;
}

/** Renders one capture-template prompt (string, date, or tags field). */
export const PromptField = forwardRef<PromptFieldHandle, PromptFieldProps>(
  function PromptField({ prompt, value, onChange }, ref) {
    const [showDatePicker, setShowDatePicker] = useState(false);
    const tagsRef = useRef<TagsEditorHandle>(null);
    const tagsArray = useMemo(
      () =>
        Array.isArray(value)
          ? value
          : typeof value === "string" && value
            ? value.split(",").map((t) => t.trim())
            : [],
      [value],
    );

    useImperativeHandle(ref, () => ({
      flushTags: () => tagsRef.current?.flush() ?? tagsArray,
    }));

    const label = `${prompt.name}${prompt.required ? " *" : ""}`;

    if (prompt.type === "date") {
      const dateValue = typeof value === "string" ? value : "";
      const pickedDate = dateValue
        ? new Date(dateValue + "T00:00:00")
        : new Date();

      if (Platform.OS === "web") {
        return (
          <View style={styles.fieldContainer}>
            <Text variant="bodySmall" style={styles.fieldLabel}>
              {label}
            </Text>
            <View style={styles.dateInputRow}>
              <PlatformDatePicker
                mode="date"
                webInline
                visible
                value={dateValue ? pickedDate : null}
                onChange={(date) => onChange(formatDateForApi(date))}
                onDismiss={() => {}}
                webInlineStyle={{
                  flex: 1,
                  borderRadius: 4,
                  backgroundColor: "transparent",
                  marginBottom: 0,
                }}
              />
              {dateValue && (
                <IconButton
                  icon="close"
                  size={20}
                  onPress={() => onChange("")}
                />
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
            {dateValue ? formatDateForDisplay(dateValue) : `Select ${label}`}
          </Button>
          {dateValue && (
            <IconButton
              icon="close"
              size={20}
              onPress={() => onChange("")}
              style={styles.clearButton}
            />
          )}
          <PlatformDatePicker
            mode="date"
            visible={showDatePicker}
            value={pickedDate}
            onChange={(date) => {
              setShowDatePicker(false);
              onChange(formatDateForApi(date));
            }}
            onDismiss={() => setShowDatePicker(false)}
          />
        </View>
      );
    }

    if (prompt.type === "tags") {
      return (
        <TagsEditor
          ref={tagsRef}
          title={label}
          tags={tagsArray}
          onChange={onChange}
          defaultExpanded
        />
      );
    }

    // Default: string type
    const stringValue = typeof value === "string" ? value : "";
    return (
      <View style={styles.textFieldContainer}>
        <TextInput
          label={label}
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
  },
);

const styles = StyleSheet.create({
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    marginBottom: 8,
    opacity: 0.7,
  },
  dateInputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dateButton: {
    flex: 1,
  },
  clearButton: {
    position: "absolute",
    right: 0,
    top: 0,
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
