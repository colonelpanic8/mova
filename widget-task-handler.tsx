import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { FlexWidget, TextWidget } from "react-native-android-widget";
import { widgetTaskHandler } from "./widgets/QuickCaptureTask";
import { QuickCaptureWidget } from "./widgets/QuickCaptureWidget";
import { getWidgetTemplate } from "./widgets/WidgetConfigurationScreen";

const QUICK_CAPTURE_KEY = "__quick_capture__";
const AUTH_STORAGE_KEY = "mova_auth";

const nameToWidget = {
  QuickCaptureWidget: QuickCaptureWidget,
};

function ErrorWidget({ message }: { message: string }) {
  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: "#FF0000",
        justifyContent: "center",
        alignItems: "center",
        padding: 8,
      }}
    >
      <TextWidget
        text={message}
        style={{ fontSize: 10, color: "#FFFFFF" }}
      />
    </FlexWidget>
  );
}

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
  const { widgetInfo, widgetAction, clickAction, renderWidget } = props;

  console.log("[Widget] widgetTaskHandlerEntry:", {
    widgetName: widgetInfo.widgetName,
    widgetAction,
    clickAction,
  });

  try {
    const Widget =
      nameToWidget[widgetInfo.widgetName as keyof typeof nameToWidget];

    if (!Widget) {
      console.log("[Widget] Unknown widget:", widgetInfo.widgetName);
      renderWidget(<ErrorWidget message={`Unknown: ${widgetInfo.widgetName}`} />);
      return;
    }

    // Get the template name for this widget
    const templateName = await getTemplateName(widgetInfo.widgetId);

    // Handle click actions
    if (clickAction) {
      const result = await widgetTaskHandler(props);
      console.log("[Widget] Task result:", result);

      const status =
        result.status === "success"
          ? "success"
          : result.status === "queued"
            ? "offline"
            : result.status === "no_auth"
              ? "error"
              : "idle";

      renderWidget(<Widget status={status} widgetId={widgetInfo.widgetId} templateName={templateName} />);
      return;
    }

    // Default render
    renderWidget(<Widget widgetId={widgetInfo.widgetId} templateName={templateName} />);
  } catch (error) {
    console.error("[Widget] Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    renderWidget(
      <ErrorWidget message={`Error: ${errorMessage.substring(0, 50)}`} />
    );
  }
}
