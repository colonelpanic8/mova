import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { QuickCaptureWidget } from './widgets/QuickCaptureWidget';
import { widgetTaskHandler, WidgetTaskResult } from './widgets/QuickCaptureTask';

const nameToWidget = {
  QuickCaptureWidget: QuickCaptureWidget,
};

export async function widgetTaskHandlerEntry(props: WidgetTaskHandlerProps) {
  const widgetInfo = props.widgetInfo;
  const Widget = nameToWidget[widgetInfo.widgetName as keyof typeof nameToWidget];

  if (!Widget) {
    return null;
  }

  // Handle click actions via the task handler
  if (props.clickAction) {
    const result = await widgetTaskHandler(props);

    // Update widget based on result
    const status = result.status === 'success'
      ? 'success'
      : result.status === 'queued'
        ? 'offline'
        : result.status === 'no_auth'
          ? 'error'
          : 'idle';

    return <Widget status={status} />;
  }

  // Default render
  return <Widget />;
}
