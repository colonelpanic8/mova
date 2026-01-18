import { Platform } from "react-native";

// Only register Android widgets on Android platform
if (Platform.OS === "android") {
  const {
    registerWidgetConfigurationScreen,
    registerWidgetTaskHandler,
  } = require("react-native-android-widget");
  const { widgetTaskHandlerEntry } = require("./widget-task-handler");
  const {
    WidgetConfigurationScreen,
  } = require("./widgets/WidgetConfigurationScreen");

  // Register the widget task handler before app starts
  registerWidgetTaskHandler(widgetTaskHandlerEntry);

  // Register the widget configuration screen
  registerWidgetConfigurationScreen(WidgetConfigurationScreen);
}

// Import the Expo Router entry point
// Note: backgroundSync is imported in app/_layout.tsx to avoid loading expo modules in widget context
import "expo-router/entry";
