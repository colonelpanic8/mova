import { useApi } from "@/context/ApiContext";
import { useAuth } from "@/context/AuthContext";
import { useOutbox } from "@/context/OutboxContext";
import { useSettings } from "@/context/SettingsContext";
import { useTemplates } from "@/context/TemplatesContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, StyleSheet, View } from "react-native";
import {
  Chip,
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

// Storage key for the in-progress quick-capture draft, per server
function getDraftStorageKey(serverId: string | null): string {
  return serverId
    ? `mova_capture_draft_v1:${serverId}`
    : "mova_capture_draft_v1";
}

const DRAFT_SAVE_DEBOUNCE_MS = 500;

export function CaptureBar() {
  const api = useApi();
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
  const { pendingCount, captureOrEnqueue, flushNow, notice, clearNotice } =
    useOutbox();
  const theme = useTheme();

  // Surface outbox notices (e.g. queued captures rejected by the server)
  // via this bar's snackbar so nothing vanishes silently.
  useEffect(() => {
    if (!notice) return;
    setMessage({ text: notice, isError: true });
    clearNotice();
  }, [notice, clearNotice]);

  // Restore the in-progress draft on mount and when the server changes, so
  // an app kill doesn't lose what the user was typing.
  const draftKey = getDraftStorageKey(activeServerId);
  // Which server's draft has finished loading; persistence is gated on it.
  const [loadedDraftKey, setLoadedDraftKey] = useState<string | null>(null);
  // Tracks whether the user has typed since the current server's draft
  // started loading, so a slow restore never clobbers fresh input.
  const titleDirtyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoadedDraftKey(null);
    titleDirtyRef.current = false;
    AsyncStorage.getItem(draftKey)
      .then((draft) => {
        if (cancelled) return;
        if (!titleDirtyRef.current) {
          setTitle(draft ?? "");
        }
        setLoadedDraftKey(draftKey);
      })
      .catch((error) => {
        console.warn("Failed to restore capture draft:", error);
        if (!cancelled) {
          setLoadedDraftKey(draftKey);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [draftKey]);

  // Persist the draft (debounced). Skipped until the draft for the current
  // server has loaded, so we never clobber it with stale text.
  useEffect(() => {
    if (loadedDraftKey !== draftKey) return;
    const timer = setTimeout(() => {
      const operation = title
        ? AsyncStorage.setItem(draftKey, title)
        : AsyncStorage.removeItem(draftKey);
      operation.catch((error) =>
        console.warn("Failed to persist capture draft:", error),
      );
    }, DRAFT_SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [title, draftKey, loadedDraftKey]);

  const handleTitleChange = useCallback((text: string) => {
    titleDirtyRef.current = true;
    setTitle(text);
  }, []);

  const clearInputAndDraft = useCallback(() => {
    setTitle("");
    AsyncStorage.removeItem(draftKey).catch((error) =>
      console.warn("Failed to clear capture draft:", error),
    );
  }, [draftKey]);

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
    if (!trimmedTitle || !selectedTemplate || !api) return;

    setSubmitting(true);
    Keyboard.dismiss();

    // Find the first required string field or use "Title"
    const titlePrompt = (selectedTemplate.prompts ?? []).find(
      (p) => p.type === "string" && p.required,
    );
    const fieldName = titlePrompt?.name || "Title";
    const captureValues = { [fieldName]: trimmedTitle };

    try {
      const result = await captureOrEnqueue({
        kind: "capture",
        templateKey: selectedTemplateKey,
        values: captureValues,
      });
      if (result.outcome === "queued") {
        clearInputAndDraft();
        setMessage({
          text: "Offline — capture saved, will retry",
          isError: false,
        });
      } else if (result.response.status === "created") {
        setMessage({ text: "Captured!", isError: false });
        clearInputAndDraft();
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

        {pendingCount > 0 && (
          <Chip
            compact
            icon="cloud-upload-outline"
            onPress={() => {
              void flushNow();
            }}
            style={styles.pendingChip}
            testID="outboxPendingChip"
            accessibilityLabel={`${pendingCount} queued capture${
              pendingCount === 1 ? "" : "s"
            }, tap to retry`}
          >
            {pendingCount}
          </Chip>
        )}

        <TextInput
          placeholder="Capture..."
          value={title}
          onChangeText={handleTitleChange}
          onSubmitEditing={handleCapture}
          mode="outlined"
          dense
          style={[styles.input, { backgroundColor: theme.colors.surface }]}
          outlineStyle={styles.inputOutline}
          disabled={submitting}
          returnKeyType="done"
          testID="captureBarInput"
        />

        <IconButton
          icon="send"
          size={20}
          onPress={handleCapture}
          disabled={!title.trim() || submitting}
          loading={submitting}
          style={styles.sendButton}
          testID="captureBarSend"
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
  pendingChip: {
    marginLeft: 2,
  },
  input: {
    flex: 1,
    height: 36,
    marginHorizontal: 4,
    borderRadius: 8,
  },
  inputOutline: {
    borderRadius: 8,
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
