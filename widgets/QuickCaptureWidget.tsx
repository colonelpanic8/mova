import { FlexWidget, SvgWidget, TextWidget } from "react-native-android-widget";

interface QuickCaptureWidgetProps {
  status?: "idle" | "submitting" | "success" | "error" | "offline";
  widgetId?: number;
  templateName?: string;
  /** Current widget size in dp, as reported by the task handler. */
  width?: number;
  height?: number;
}

// Below this width there is no room for a usable text field, so the widget
// collapses to just the two action buttons (voice + type).
const COMPACT_WIDTH_DP = 170;

const DEFAULT_TEMPLATE_NAME = "Quick Capture";

// MD3 light palette (kept coherent with the app + capture dialog).
const CONTAINER_IDLE = "#F3EDF7"; // surfaceContainer
const TEXT_COLOR = "#49454F"; // hint-style onSurfaceVariant
const MIC_FILL = "#6750A4"; // primary
const MIC_ICON = "#FFFFFF"; // onPrimary
const SEND_FILL = "#EADDFF"; // primaryContainer
const SEND_ICON = "#21005D"; // onPrimaryContainer

// Real Material icons rendered by SvgWidget (no text glyphs).
const micSvg = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${color}" d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>`;

const sendSvg = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${color}" d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z"/></svg>`;

export function QuickCaptureWidget({
  status = "idle",
  widgetId,
  templateName = DEFAULT_TEMPLATE_NAME,
  width,
  height,
}: QuickCaptureWidgetProps) {
  const compact = typeof width === "number" && width < COMPACT_WIDTH_DP;
  // Pill shrinks with the widget so a 1-cell-tall placement isn't clipped.
  const pillHeight = Math.max(40, Math.min(56, height ?? 56));
  const buttonSize = pillHeight - 16;
  // Status recolors the pill but keeps the same shape.
  const getContainerColor = () => {
    switch (status) {
      case "success":
        return "#C8E6C9"; // Light green
      case "error":
        return "#FFCDD2"; // Light red
      case "offline":
        return "#FFE0B2"; // Light orange
      default:
        return CONTAINER_IDLE;
    }
  };

  const isDefaultTemplate = templateName === DEFAULT_TEMPLATE_NAME;

  const getText = () => {
    switch (status) {
      case "submitting":
        return "Capturing…";
      case "success":
        return "Captured!";
      case "error":
        return "Error — tap to retry";
      case "offline":
        return "Queued — will sync";
      default:
        return isDefaultTemplate ? "Add a todo…" : templateName;
    }
  };

  const widgetQuery = widgetId ? `?widgetId=${widgetId}` : "";

  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Single pill row: mic | text | send. borderRadius = half of height. */}
      <FlexWidget
        style={{
          height: pillHeight,
          width: "match_parent",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: compact ? "space-between" : "flex-start",
          backgroundColor: getContainerColor(),
          borderRadius: pillHeight / 2,
          paddingLeft: 8,
          paddingRight: 8,
        }}
        clickAction="OPEN_URI"
        clickActionData={{ uri: `mova://capture${widgetQuery}` }}
        accessibilityLabel="Add a todo"
      >
        {/* Mic circle -> voice trampoline (no app launch) */}
        <FlexWidget
          style={{
            width: buttonSize,
            height: buttonSize,
            borderRadius: buttonSize / 2,
            backgroundColor: MIC_FILL,
            justifyContent: "center",
            alignItems: "center",
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: `mova://capture-voice${widgetQuery}` }}
          accessibilityLabel="Capture by voice"
        >
          <SvgWidget svg={micSvg(MIC_ICON)} style={{ width: 22, height: 22 }} />
        </FlexWidget>

        {/* Text area -> typing dialog (inherits pill clickAction).
            Dropped entirely when the widget is too narrow to show it. */}
        {compact ? null : (
          <FlexWidget
            style={{
              flex: 1,
              height: pillHeight,
              justifyContent: "center",
              paddingLeft: 14,
              paddingRight: 10,
            }}
          >
            <TextWidget
              text={getText()}
              truncate="END"
              maxLines={1}
              style={{ fontSize: 15, color: TEXT_COLOR }}
            />
          </FlexWidget>
        )}

        {/* Send circle -> typing dialog (inherits pill clickAction) */}
        <FlexWidget
          style={{
            width: buttonSize,
            height: buttonSize,
            borderRadius: buttonSize / 2,
            backgroundColor: SEND_FILL,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <SvgWidget
            svg={sendSvg(SEND_ICON)}
            style={{ width: 20, height: 20 }}
          />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}

export default QuickCaptureWidget;
