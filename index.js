import { registerWidgetTaskHandler } from "react-native-android-widget";
import { widgetTaskHandlerEntry } from "./widget-task-handler";

// Register the widget task handler before app starts
registerWidgetTaskHandler(widgetTaskHandlerEntry);

// Register background sync task (must be at module level)
import "./services/backgroundSync";

// Import the Expo Router entry point
import "expo-router/entry";
