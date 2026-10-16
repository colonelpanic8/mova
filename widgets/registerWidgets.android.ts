import {
  registerWidgetConfigurationScreen,
  registerWidgetTaskHandler,
} from "react-native-android-widget";
import { WidgetConfigurationScreen } from "./WidgetConfigurationScreen";
import { widgetTaskHandlerEntry } from "./widgetTaskHandler";

// Registered at bundle load: widget updates run the bundle headlessly, where
// no app component ever mounts.
registerWidgetTaskHandler(widgetTaskHandlerEntry);
registerWidgetConfigurationScreen(WidgetConfigurationScreen);
