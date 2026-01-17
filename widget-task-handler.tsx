import React from "react";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { FlexWidget, TextWidget } from "react-native-android-widget";
import { widgetTaskHandler } from "./widgets/QuickCaptureTask";
import { QuickCaptureWidget } from "./widgets/QuickCaptureWidget";

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

      renderWidget(<Widget status={status} widgetId={widgetInfo.widgetId} />);
      return;
    }

    // Default render
    renderWidget(<Widget widgetId={widgetInfo.widgetId} />);
  } catch (error) {
    console.error("[Widget] Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    renderWidget(
      <ErrorWidget message={`Error: ${errorMessage.substring(0, 50)}`} />
    );
  }
}
