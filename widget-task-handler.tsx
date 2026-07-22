import React from "react";
import { NativeModules } from "react-native";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { FlexWidget, TextWidget } from "react-native-android-widget";
import { QuickCaptureWidget } from "./widgets/QuickCaptureWidget";
import { getWidgetCredentials } from "./widgets/storage";
import { getWidgetTemplate } from "./widgets/WidgetConfigurationScreen";

const { SharedStorage } = NativeModules;

const QUICK_CAPTURE_KEY = "__quick_capture__";

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
      <TextWidget text={message} style={{ fontSize: 10, color: "#FFFFFF" }} />
    </FlexWidget>
  );
}

async function getTemplateName(widgetId: number): Promise<string> {
  try {
    // First try to read template name directly from SharedPreferences
    // (saved by the widget configuration screen)
    if (SharedStorage) {
      const templateName = await SharedStorage.getItem(
        `widget_${widgetId}_template_name`,
      );
      if (templateName) {
        return templateName;
      }
    }

    // Fall back to getting template key and looking up name
    const templateKey = await getWidgetTemplate(widgetId);

    if (templateKey === QUICK_CAPTURE_KEY) {
      return "Quick Capture";
    }

    // Try to get template name from API
    const { apiUrl, username, password } = await getWidgetCredentials();
    if (apiUrl && username && password) {
      const response = await fetch(`${apiUrl}/capture-templates`, {
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

// Renders the home-screen widget. Tapping the widget is handled natively:
// the OPEN_URI click action launches QuickCaptureActivity via the
// mova://capture deep link, so this handler only needs to render.
export async function widgetTaskHandlerEntry(props: WidgetTaskHandlerProps) {
  const { widgetInfo, widgetAction, renderWidget } = props;

  console.log("[Widget] widgetTaskHandlerEntry:", {
    widgetName: widgetInfo.widgetName,
    widgetAction,
  });

  try {
    const Widget =
      nameToWidget[widgetInfo.widgetName as keyof typeof nameToWidget];

    if (!Widget) {
      console.log("[Widget] Unknown widget:", widgetInfo.widgetName);
      renderWidget(
        <ErrorWidget message={`Unknown: ${widgetInfo.widgetName}`} />,
      );
      return;
    }

    const templateName = await getTemplateName(widgetInfo.widgetId);

    renderWidget(
      <Widget widgetId={widgetInfo.widgetId} templateName={templateName} />,
    );
  } catch (error) {
    console.error("[Widget] Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    renderWidget(
      <ErrorWidget message={`Error: ${errorMessage.substring(0, 50)}`} />,
    );
  }
}
