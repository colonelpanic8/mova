import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { registerWidgetTaskHandler } from "react-native-android-widget";
import { widgetTaskHandler } from "./QuickCaptureTask";
import { QuickCaptureWidget } from "./QuickCaptureWidget";

// Register the widget component
export const widgetComponents = {
  QuickCaptureWidget,
};

// Wrapper to make the handler compatible with registerWidgetTaskHandler's void return type
const voidHandler = async (props: WidgetTaskHandlerProps): Promise<void> => {
  await widgetTaskHandler(props);
};

// Register the task handler
registerWidgetTaskHandler(voidHandler);

export { widgetTaskHandler } from "./QuickCaptureTask";
export { QuickCaptureWidget } from "./QuickCaptureWidget";
export * from "./storage";
