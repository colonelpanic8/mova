import {
  registerWidgetConfigurationScreen,
  registerWidgetTaskHandler,
} from "react-native-android-widget";
import { widgetTaskHandlerEntry } from "./widget-task-handler";
import { WidgetConfigurationScreen } from "./widgets/WidgetConfigurationScreen";

// Register the widget task handler before app starts
registerWidgetTaskHandler(widgetTaskHandlerEntry);

// Register the widget configuration screen
registerWidgetConfigurationScreen(WidgetConfigurationScreen);

// Register background sync task (must be at module level)
import "./services/backgroundSync";

// Import the Expo Router entry point
import "expo-router/entry";
