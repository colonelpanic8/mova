import { registerWidgetTaskHandler } from "react-native-android-widget";
import { widgetTaskHandlerEntry } from "./widget-task-handler";

// Register the widget task handler before app starts
registerWidgetTaskHandler(widgetTaskHandlerEntry);

// Import the Expo Router entry point
// Note: backgroundSync is imported in app/_layout.tsx to avoid loading expo modules in widget context
import "expo-router/entry";
