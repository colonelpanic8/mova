import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { QuickCaptureWidget } from './QuickCaptureWidget';
import { widgetTaskHandler } from './QuickCaptureTask';

// Register the widget component
export const widgetComponents = {
  QuickCaptureWidget,
};

// Register the task handler
registerWidgetTaskHandler(widgetTaskHandler);

export { QuickCaptureWidget } from './QuickCaptureWidget';
export { widgetTaskHandler } from './QuickCaptureTask';
export * from './storage';
