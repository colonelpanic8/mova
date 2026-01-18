import React from "react";
import { FlexWidget, TextWidget } from "react-native-android-widget";

interface QuickCaptureWidgetProps {
  status?: "idle" | "submitting" | "success" | "error" | "offline";
  widgetId?: number;
  templateName?: string;
}

export function QuickCaptureWidget({
  status = "idle",
  widgetId,
  templateName = "Quick Capture",
}: QuickCaptureWidgetProps) {
  // Match app's surfaceVariant color
  const getContainerColor = () => {
    switch (status) {
      case "success":
        return "#C8E6C9"; // Light green
      case "error":
        return "#FFCDD2"; // Light red
      case "offline":
        return "#FFE0B2"; // Light orange
      default:
        return "#E7E0EC"; // surfaceVariant from MD3
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "success":
        return "Captured!";
      case "error":
        return "Error - tap to retry";
      case "offline":
        return "Queued - will sync";
      default:
        return "Capture...";
    }
  };

  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: getContainerColor(),
        borderRadius: 16,
        paddingLeft: 12,
        paddingRight: 4,
        paddingTop: 4,
        paddingBottom: 4,
      }}
      clickAction="OPEN_URI"
      clickActionData={{
        uri: `mova://capture${widgetId ? `?widgetId=${widgetId}` : ""}`,
      }}
    >
      {/* Input area - styled like the app's TextInput */}
      <FlexWidget
        style={{
          flex: 1,
          height: 36,
          backgroundColor: "#FFFBFE", // surface color
          borderRadius: 18,
          paddingLeft: 16,
          paddingRight: 16,
          justifyContent: "center",
        }}
      >
        <TextWidget
          text={
            status === "idle"
              ? `Tap to add (${templateName})...`
              : getStatusText()
          }
          style={{
            fontSize: 14,
            color: "#1C1B1F",
          }}
        />
      </FlexWidget>

      {/* Send button - matches app's IconButton */}
      <FlexWidget
        style={{
          width: 40,
          height: 40,
          marginLeft: 4,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <TextWidget
          text="➤"
          style={{
            fontSize: 20,
            color: "#6750A4", // primary color
          }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}

export default QuickCaptureWidget;
