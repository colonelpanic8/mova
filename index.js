// Register widgets only if the module is available
// This may fail in certain test environments or if the native module isn't linked
try {
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
} catch (e) {
  // Widget registration failed - this is expected in some environments
  console.log("[Widget] Registration skipped:", e?.message || e);
}

// Import the Expo Router entry point
// Note: backgroundSync is imported in app/_layout.tsx to avoid loading expo modules in widget context
import "expo-router/entry";
