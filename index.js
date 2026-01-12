import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandlerEntry } from './widget-task-handler';

// Register the widget task handler before app starts
registerWidgetTaskHandler(widgetTaskHandlerEntry);

// Import the Expo Router entry point
import 'expo-router/entry';
