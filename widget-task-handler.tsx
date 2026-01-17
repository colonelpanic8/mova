import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { widgetTaskHandler } from "./widgets/QuickCaptureTask";
import { QuickCaptureWidget } from "./widgets/QuickCaptureWidget";
import { getWidgetTemplate } from "./widgets/WidgetConfigurationScreen";

const QUICK_CAPTURE_KEY = "__quick_capture__";
const AUTH_STORAGE_KEY = "mova_auth";

const nameToWidget = {
  QuickCaptureWidget: QuickCaptureWidget,
};

async function getTemplateName(widgetId: number): Promise<string> {
  try {
    const templateKey = await getWidgetTemplate(widgetId);

    if (templateKey === QUICK_CAPTURE_KEY) {
      return "Quick Capture";
    }

    // Try to get template name from API
    const authData = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    if (authData) {
      const { apiUrl, username, password } = JSON.parse(authData);
      const response = await fetch(`${apiUrl}/templates`, {
        headers: {
          Authorization: `Basic ${btoa(`${username}:${password}`)}`,
        },
      });
      if (response.ok) {
        const templates = await response.json();
        if (templates[templateKey]) {
          return templates[templateKey].name;
        }
      }
    }

    return "Capture";
  } catch {
    return "Quick Capture";
  }
}

export async function widgetTaskHandlerEntry(props: WidgetTaskHandlerProps) {
  const widgetInfo = props.widgetInfo;
  const Widget =
    nameToWidget[widgetInfo.widgetName as keyof typeof nameToWidget];

  if (!Widget) {
    return null;
  }

  // Get the template name for this widget
  const templateName = await getTemplateName(widgetInfo.widgetId);

  // Handle click actions via the task handler
  if (props.clickAction) {
    const result = await widgetTaskHandler(props);

    // Update widget based on result
    const status =
      result.status === "success"
        ? "success"
        : result.status === "queued"
          ? "offline"
          : result.status === "no_auth"
            ? "error"
            : "idle";

    return <Widget status={status} templateName={templateName} />;
  }

  // Default render
  return <Widget templateName={templateName} />;
}
