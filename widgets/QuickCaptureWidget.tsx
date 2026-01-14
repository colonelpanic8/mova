import React from "react";
import { FlexWidget, TextWidget } from "react-native-android-widget";

interface QuickCaptureWidgetProps {
  inputText?: string;
  status?: "idle" | "submitting" | "success" | "error" | "offline";
}

export function QuickCaptureWidget({
  inputText = "",
  status = "idle",
}: QuickCaptureWidgetProps) {
  const getBackgroundColor = () => {
    switch (status) {
      case "success":
        return "#4CAF50"; // Green
      case "error":
        return "#F44336"; // Red
      case "offline":
        return "#FF9800"; // Orange
      case "submitting":
        return "#9E9E9E"; // Gray
      default:
        return "#FFFFFF"; // White
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case "success":
        return "check";
      case "error":
        return "error";
      case "offline":
        return "cloud_off";
      case "submitting":
        return "sync";
      default:
        return "add";
    }
  };

  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: getBackgroundColor(),
        borderRadius: 8,
        padding: 8,
      }}
    >
      {/* Label */}
      <FlexWidget
        style={{
          flex: 1,
          height: "match_parent",
          backgroundColor: "#F5F5F5",
          borderRadius: 4,
          paddingHorizontal: 12,
          justifyContent: "center",
        }}
        clickAction="OPEN_APP"
      >
        <TextWidget
          text={inputText || "Tap to add todo..."}
          style={{
            fontSize: 14,
            color: inputText ? "#212121" : "#757575",
          }}
        />
      </FlexWidget>

      {/* Submit Button */}
      <FlexWidget
        style={{
          width: 48,
          height: 48,
          marginLeft: 8,
          backgroundColor: "#6200EE",
          borderRadius: 24,
          justifyContent: "center",
          alignItems: "center",
        }}
        clickAction="OPEN_APP"
      >
        <TextWidget
          text="+"
          style={{
            fontSize: 24,
            color: "#FFFFFF",
          }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}

export default QuickCaptureWidget;
