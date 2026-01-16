import { useAuth } from "@/context/AuthContext";
import { api, TemplatesResponse } from "@/services/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useState } from "react";
import { Keyboard, StyleSheet, View } from "react-native";
import {
  IconButton,
  Menu,
  Snackbar,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

const LAST_TEMPLATE_KEY = "mova_last_template";
const QUICK_CAPTURE_KEY = "__quick_capture__";

export function CaptureBar() {
  const [templates, setTemplates] = useState<TemplatesResponse | null>(null);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>(
    QUICK_CAPTURE_KEY,
  );
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);
  const { apiUrl, username, password, isAuthenticated } = useAuth();
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
        // Only use saved template if it's a single-field template
        const template = data[lastTemplate];
        const requiredPrompts = template.prompts.filter((p) => p.required);
        if (requiredPrompts.length <= 1) {
          setSelectedTemplateKey(lastTemplate);
        } else {
          setSelectedTemplateKey(QUICK_CAPTURE_KEY);
        }
      }
    } catch (err) {
      console.error("Failed to load templates:", err);
    }
  }, [apiUrl, username, password]);

  useEffect(() => {
    if (isAuthenticated) {
      loadTemplates();
    }
  }, [loadTemplates, isAuthenticated]);

  const isQuickCapture = selectedTemplateKey === QUICK_CAPTURE_KEY;
  const selectedTemplate =
    selectedTemplateKey && templates && !isQuickCapture
      ? templates[selectedTemplateKey]
      : null;

  // Get single-field templates (templates with at most 1 required field)
  const singleFieldTemplates = templates
    ? Object.entries(templates).filter(([, template]) => {
        const requiredPrompts = template.prompts.filter((p) => p.required);
        return requiredPrompts.length <= 1;
      })
    : [];

  const handleTemplateSelect = async (key: string) => {
    setSelectedTemplateKey(key);
    setMenuVisible(false);
    await AsyncStorage.setItem(LAST_TEMPLATE_KEY, key);
  };

  const handleCapture = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    setSubmitting(true);
    Keyboard.dismiss();

    try {
      if (isQuickCapture) {
        const result = await api.createTodo(trimmedTitle);
        if (result.status === "created") {
          setMessage({ text: "Captured!", isError: false });
          setTitle("");
        } else {
          setMessage({ text: "Capture failed", isError: true });
        }
      } else if (selectedTemplate) {
        // For template capture, find the first required string field or use "title"
        const titlePrompt = selectedTemplate.prompts.find(
          (p) => p.type === "string" && p.required,
        );
        const fieldName = titlePrompt?.name || "title";

        const result = await api.capture(selectedTemplateKey, {
          [fieldName]: trimmedTitle,
        });
        if (result.status === "created") {
          setMessage({ text: "Captured!", isError: false });
          setTitle("");
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

  if (!isAuthenticated) {
    return null;
  }

  const getDisplayName = () => {
    if (isQuickCapture) return "Quick";
    if (selectedTemplate) {
      // Abbreviate long names
      const name = selectedTemplate.name;
      return name.length > 8 ? name.substring(0, 7) + "…" : name;
    }
    return "Quick";
  };

  return (
    <>
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.colors.surfaceVariant,
            borderTopColor: theme.colors.outlineVariant,
          },
        ]}
      >
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <IconButton
              icon="chevron-up"
              size={16}
              onPress={() => setMenuVisible(true)}
              style={styles.menuButton}
            />
          }
          anchorPosition="top"
        >
          <Menu.Item
            key={QUICK_CAPTURE_KEY}
            onPress={() => handleTemplateSelect(QUICK_CAPTURE_KEY)}
            title="Quick Capture"
            leadingIcon={isQuickCapture ? "check" : "lightning-bolt"}
          />
          {singleFieldTemplates.length > 0 && (
            <>
              {singleFieldTemplates.map(([key, template]) => (
                <Menu.Item
                  key={key}
                  onPress={() => handleTemplateSelect(key)}
                  title={template.name}
                  leadingIcon={key === selectedTemplateKey ? "check" : undefined}
                />
              ))}
            </>
          )}
        </Menu>

        <Text variant="labelSmall" style={styles.templateLabel}>
          {getDisplayName()}
        </Text>

        <TextInput
          placeholder="Capture..."
          value={title}
          onChangeText={setTitle}
          onSubmitEditing={handleCapture}
          mode="flat"
          dense
          style={[styles.input, { backgroundColor: theme.colors.surface }]}
          underlineStyle={styles.inputUnderline}
          disabled={submitting}
          returnKeyType="done"
        />

        <IconButton
          icon="send"
          size={20}
          onPress={handleCapture}
          disabled={!title.trim() || submitting}
          loading={submitting}
          style={styles.sendButton}
        />
      </View>

      <Snackbar
        visible={!!message}
        onDismiss={() => setMessage(null)}
        duration={2000}
        style={[
          message?.isError ? { backgroundColor: theme.colors.error } : undefined,
          styles.snackbar,
        ]}
      >
        {message?.text}
      </Snackbar>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  menuButton: {
    margin: 0,
  },
  templateLabel: {
    minWidth: 40,
    opacity: 0.7,
  },
  input: {
    flex: 1,
    height: 36,
    marginHorizontal: 4,
    borderRadius: 18,
  },
  inputUnderline: {
    display: "none",
  },
  sendButton: {
    margin: 0,
  },
  snackbar: {
    marginBottom: 60,
  },
});

export default CaptureBar;
