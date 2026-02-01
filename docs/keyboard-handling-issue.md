# Android Keyboard Handling Issue - RESOLVED

## Problem Description

When the keyboard appears on Android (e.g., when tapping an input field in the Capture view), the ScrollView does not properly adjust to make all content accessible. Content at the bottom of the screen becomes stuck beneath the keyboard and cannot be scrolled into view.

## Root Cause

Starting with **Expo SDK 53**, edge-to-edge display is enabled by default on Android (`edgeToEdgeEnabled=true` in gradle.properties). This fundamentally changes how keyboard insets are handled:

- The traditional `windowSoftInputMode="adjustResize"` in AndroidManifest.xml no longer works reliably with edge-to-edge enabled
- React Native's built-in `KeyboardAvoidingView` doesn't properly account for the new edge-to-edge inset behavior on Android
- Content gets hidden behind the keyboard even with `adjustResize` or `adjustPan`

This is a known issue affecting many Expo SDK 53+ apps on Android 15+.

## Solution

We use [`react-native-keyboard-controller`](https://github.com/kirillzyusko/react-native-keyboard-controller), which is the [Expo-recommended library](https://docs.expo.dev/guides/keyboard-handling/) for advanced keyboard handling. It properly handles keyboard insets with edge-to-edge mode.

### Implementation

1. **Installed `react-native-keyboard-controller`**

   ```bash
   npx expo install react-native-keyboard-controller
   ```

2. **Added `KeyboardProvider` wrapper in `app/_layout.tsx`**
   - Required for the library to function
   - Wraps the entire app inside `GestureHandlerRootView`

3. **Updated `components/KeyboardAwareContainer.tsx`**
   - Uses `KeyboardAvoidingView` from `react-native-keyboard-controller` on Android
   - Uses React Native's built-in `KeyboardAvoidingView` on iOS
   - Uses VisualViewport API on web

### Files Modified

- `app/_layout.tsx` - Added `KeyboardProvider` wrapper
- `components/KeyboardAwareContainer.tsx` - Uses library's KeyboardAvoidingView on Android
- `package.json` - Added `react-native-keyboard-controller` dependency

## Removal Instructions

If Expo/React Native fixes the underlying edge-to-edge keyboard issues in a future SDK version, this workaround can be simplified:

1. Remove the `react-native-keyboard-controller` dependency:

   ```bash
   yarn remove react-native-keyboard-controller
   ```

2. Remove the `KeyboardProvider` wrapper from `app/_layout.tsx`

3. Simplify `components/KeyboardAwareContainer.tsx` to use React Native's built-in `KeyboardAvoidingView` or just a plain `View` on Android

## References

- [Expo Keyboard Handling Guide](https://docs.expo.dev/guides/keyboard-handling/)
- [react-native-keyboard-controller GitHub](https://github.com/kirillzyusko/react-native-keyboard-controller)
- [GitHub Discussion: KeyboardAvoidingView not working after SDK 52 to 53 migration](https://github.com/orgs/community/discussions/167709)
- [React Native Issue: KeyboardAvoidingView under Android 15](https://github.com/facebook/react-native/issues/49759)

## Environment

- Expo SDK 54
- React Native (New Architecture enabled)
- Android with edge-to-edge enabled
- `windowSoftInputMode="adjustResize"` in AndroidManifest.xml
