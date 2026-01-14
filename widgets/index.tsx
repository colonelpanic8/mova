import { registerWidgetTaskHandler } from 'react-native-android-widget';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { QuickCaptureWidget } from './QuickCaptureWidget';
import { widgetTaskHandler } from './QuickCaptureTask';

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

export { QuickCaptureWidget } from './QuickCaptureWidget';
export { widgetTaskHandler } from './QuickCaptureTask';
export * from './storage';
