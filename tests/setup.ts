// Mock AsyncStorage before anything else
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([]),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
}));

// Mock expo-linking
jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string) => `mova://${path}`),
  parse: jest.fn(),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  getInitialURL: jest.fn().mockResolvedValue(null),
}));

// Mock widgets storage
jest.mock('../widgets/storage', () => ({
  saveCredentialsToWidget: jest.fn(),
  clearWidgetCredentials: jest.fn(),
  getWidgetCredentials: jest.fn().mockResolvedValue({
    apiUrl: null,
    username: null,
    password: null,
  }),
}));

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native').View;
  return {
    Swipeable: ({ children }: { children: React.ReactNode }) => children,
    GestureHandlerRootView: View,
    Directions: {},
    State: {},
    PanGestureHandler: View,
    TapGestureHandler: View,
    FlingGestureHandler: View,
    ForceTouchGestureHandler: View,
    LongPressGestureHandler: View,
    PinchGestureHandler: View,
    RotationGestureHandler: View,
    ScrollView: require('react-native').ScrollView,
    Slider: View,
    Switch: require('react-native').Switch,
    TextInput: require('react-native').TextInput,
    ToolbarAndroid: View,
    ViewPagerAndroid: View,
    DrawerLayoutAndroid: View,
    WebView: View,
    NativeViewGestureHandler: View,
    RawButton: View,
    BaseButton: View,
    RectButton: View,
    BorderlessButton: View,
    TouchableHighlight: require('react-native').TouchableHighlight,
    TouchableNativeFeedback: require('react-native').TouchableNativeFeedback,
    TouchableOpacity: require('react-native').TouchableOpacity,
    TouchableWithoutFeedback: require('react-native').TouchableWithoutFeedback,
  };
});

// Mock DateTimePicker
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
