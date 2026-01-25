import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { useTemplates } from "@/context/TemplatesContext";
import { api } from "@/services/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useState } from "react";
import { Keyboard, Pressable, StyleSheet, View } from "react-native";
import {
  IconButton,
  Menu,
  Snackbar,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

// Get the storage key for default template per server
function getDefaultTemplateKey(serverId: string | null): string {
  return serverId
    ? `mova_default_template_${serverId}`
    : "mova_default_template";
}

export function CaptureBar() {
  const { templates } = useTemplates();
  const { quickScheduleIncludeTime, setQuickScheduleIncludeTime } =
    useSettings();
  const [selectedTemplateKey, setSelectedTemplateKey] =
    useState<string>("default");
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);
  const { isAuthenticated, activeServerId } = useAuth();
  const theme = useTheme();

  // Load default template when templates or server changes
  useEffect(() => {
    if (!templates) return;

    const loadDefaultTemplate = async () => {
      const storageKey = getDefaultTemplateKey(activeServerId);
      const savedTemplate = await AsyncStorage.getItem(storageKey);
      const templateKeys = Object.keys(templates);

      if (savedTemplate && templateKeys.includes(savedTemplate)) {
        // Only use saved template if it's a single-field template
        const template = templates[savedTemplate];
        const requiredPrompts = (template.prompts ?? []).filter(
          (p) => p.required,
        );
        if (requiredPrompts.length <= 1) {
          setSelectedTemplateKey(savedTemplate);
        } else {
          setSelectedTemplateKey("default");
        }
      } else {
        setSelectedTemplateKey("default");
      }
    };

    loadDefaultTemplate();
  }, [templates, activeServerId]);

  const selectedTemplate =
    selectedTemplateKey && templates ? templates[selectedTemplateKey] : null;

  // Get single-field templates (templates with at most 1 required field)
  const singleFieldTemplates = templates
    ? Object.entries(templates).filter(([, template]) => {
        const requiredPrompts = (template.prompts ?? []).filter(
          (p) => p.required,
        );
        return requiredPrompts.length <= 1;
      })
    : [];

  const handleTemplateSelect = useCallback(
    (key: string) => {
      // Close menu first, then update state after menu animation completes
      // This fixes Android issue where menu won't reopen after selection
      setMenuVisible(false);
      setTimeout(() => {
        setSelectedTemplateKey(key);
        const storageKey = getDefaultTemplateKey(activeServerId);
        AsyncStorage.setItem(storageKey, key);
      }, 0);
    },
    [activeServerId],
  );

  const handleCapture = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !selectedTemplate) return;

    setSubmitting(true);
    Keyboard.dismiss();

    try {
      // Find the first required string field or use "Title"
      const titlePrompt = (selectedTemplate.prompts ?? []).find(
        (p) => p.type === "string" && p.required,
      );
      const fieldName = titlePrompt?.name || "Title";

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
    if (selectedTemplate) {
      // Abbreviate long names
      const name = selectedTemplate.name;
      return name.length > 8 ? name.substring(0, 7) + "…" : name;
    }
    return "Todo";
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
            <Pressable
              onPress={() => setMenuVisible(true)}
              style={styles.menuAnchor}
            >
              <IconButton
                icon="chevron-up"
                size={16}
                onPress={() => setMenuVisible(true)}
                style={styles.menuButton}
              />
              <Text variant="labelSmall" style={styles.templateLabel}>
                {getDisplayName()}
              </Text>
            </Pressable>
          }
          anchorPosition="top"
        >
          {singleFieldTemplates.map(([key, template]) => (
            <Menu.Item
              key={key}
              onPress={() => handleTemplateSelect(key)}
              title={template.name}
              leadingIcon={key === selectedTemplateKey ? "check" : undefined}
            />
          ))}
        </Menu>

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

        <VoiceMicButton
          onTranscript={handleVoiceTranscript}
          onPartialTranscript={handleVoicePartial}
          disabled={submitting}
        />

        <IconButton
          icon="send"
          size={20}
          onPress={handleCapture}
          disabled={!title.trim() || submitting}
          loading={submitting}
          style={styles.sendButton}
        />

        <IconButton
          icon={quickScheduleIncludeTime ? "clock" : "clock-outline"}
          size={20}
          onPress={() => setQuickScheduleIncludeTime(!quickScheduleIncludeTime)}
          style={[
            styles.timeToggleButton,
            quickScheduleIncludeTime && {
              backgroundColor: theme.colors.primaryContainer,
            },
          ]}
        />
      </View>

      <Snackbar
        visible={!!message}
        onDismiss={() => setMessage(null)}
        duration={2000}
        style={[
          message?.isError
            ? { backgroundColor: theme.colors.error }
            : undefined,
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
  menuAnchor: {
    flexDirection: "row",
    alignItems: "center",
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
  timeToggleButton: {
    margin: 0,
    borderRadius: 20,
  },
  snackbar: {
    marginBottom: 60,
  },
});

export default CaptureBar;
