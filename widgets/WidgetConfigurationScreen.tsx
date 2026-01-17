import { api, TemplatesResponse } from "@/services/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import type { WidgetConfigurationScreenProps } from "react-native-android-widget";
import {
  ActivityIndicator,
  Button,
  List,
  Text,
  useTheme,
} from "react-native-paper";
import { QuickCaptureWidget } from "./QuickCaptureWidget";

const AUTH_STORAGE_KEY = "mova_auth";
const QUICK_CAPTURE_KEY = "__quick_capture__";

// Get the storage key for a widget's template selection
export function getWidgetTemplateKey(widgetId: number): string {
  return `mova_widget_template_${widgetId}`;
}

// Get the selected template for a widget
export async function getWidgetTemplate(widgetId: number): Promise<string> {
  const key = getWidgetTemplateKey(widgetId);
  const template = await AsyncStorage.getItem(key);
  return template || QUICK_CAPTURE_KEY;
}

export function WidgetConfigurationScreen({
  widgetInfo,
  renderWidget,
  setResult,
}: WidgetConfigurationScreenProps) {
  const theme = useTheme();
  const [templates, setTemplates] = useState<TemplatesResponse | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>(QUICK_CAPTURE_KEY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    try {
      // Load auth credentials
      const authData = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      if (!authData) {
        setError("Please log in to the app first");
        setLoading(false);
        return;
      }

      const { apiUrl, username, password } = JSON.parse(authData);
      api.configure(apiUrl, username, password);

      // Load templates
      const data = await api.getTemplates();
      setTemplates(data);

      // Load previously selected template for this widget
      const savedTemplate = await getWidgetTemplate(widgetInfo.widgetId);
      setSelectedTemplate(savedTemplate);
    } catch (err) {
      console.error("Failed to load templates:", err);
      setError("Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, [widgetInfo.widgetId]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleSelectTemplate = async (templateKey: string) => {
    setSelectedTemplate(templateKey);
  };

  const handleConfirm = async () => {
    // Save the selected template
    const key = getWidgetTemplateKey(widgetInfo.widgetId);
    await AsyncStorage.setItem(key, selectedTemplate);

    // Render the widget
    const templateName = selectedTemplate === QUICK_CAPTURE_KEY
      ? "Quick Capture"
      : templates?.[selectedTemplate]?.name || "Capture";

    renderWidget(<QuickCaptureWidget templateName={templateName} />);
    setResult("ok");
  };

  const handleCancel = () => {
    setResult("cancel");
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading templates...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centered}>
          <Text style={[styles.errorText, { color: theme.colors.error }]}>
            {error}
          </Text>
          <Button mode="contained" onPress={handleCancel} style={styles.button}>
            Cancel
          </Button>
        </View>
      </View>
    );
  }

  const templateKeys = templates ? Object.keys(templates) : [];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.title}>
          Configure Widget
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Select a capture template for this widget
        </Text>
      </View>

      <ScrollView style={styles.list}>
        <List.Item
          title="Quick Capture"
          description="Simple todo with just a title"
          left={(props) => <List.Icon {...props} icon="lightning-bolt" />}
          right={(props) =>
            selectedTemplate === QUICK_CAPTURE_KEY ? (
              <List.Icon {...props} icon="check" color={theme.colors.primary} />
            ) : null
          }
          onPress={() => handleSelectTemplate(QUICK_CAPTURE_KEY)}
          style={[
            styles.listItem,
            selectedTemplate === QUICK_CAPTURE_KEY && {
              backgroundColor: theme.colors.primaryContainer,
            },
          ]}
        />

        {templateKeys.map((key) => (
          <List.Item
            key={key}
            title={templates![key].name}
            description={`${templates![key].prompts.length} field(s)`}
            left={(props) => <List.Icon {...props} icon="file-document-outline" />}
            right={(props) =>
              selectedTemplate === key ? (
                <List.Icon {...props} icon="check" color={theme.colors.primary} />
              ) : null
            }
            onPress={() => handleSelectTemplate(key)}
            style={[
              styles.listItem,
              selectedTemplate === key && {
                backgroundColor: theme.colors.primaryContainer,
              },
            ]}
          />
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Button mode="outlined" onPress={handleCancel} style={styles.button}>
          Cancel
        </Button>
        <Button mode="contained" onPress={handleConfirm} style={styles.button}>
          Confirm
        </Button>
      </View>
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
    padding: 24,
  },
  header: {
    padding: 24,
    paddingBottom: 16,
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    opacity: 0.7,
  },
  list: {
    flex: 1,
  },
  listItem: {
    paddingHorizontal: 16,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  button: {
    minWidth: 100,
  },
  loadingText: {
    marginTop: 16,
    opacity: 0.7,
  },
  errorText: {
    marginBottom: 16,
    textAlign: "center",
  },
});
