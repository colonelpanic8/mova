# Keyboard-Aware Container Design

## Problem

Text fields become hidden behind the keyboard on multiple platforms:

- **Android**: `KeyboardAvoidingView` has `behavior={undefined}`, doing nothing
- **iOS**: Works but inconsistent `keyboardVerticalOffset` values across screens
- **Mobile Web**: `KeyboardAvoidingView` doesn't work at all

Affected screens: capture, edit, quick capture, body editor, search.

## Solution

Create a reusable `KeyboardAwareContainer` component that handles keyboard visibility across all platforms.

## Implementation

### KeyboardAwareContainer Component

**Location**: `components/KeyboardAwareContainer.tsx`

**Props**:

- `children` (required) - content to render
- `keyboardVerticalOffset` (optional, default 0) - offset for headers
- `style` (optional) - additional container styles

**Platform Behavior**:

| Platform | Approach                                         |
| -------- | ------------------------------------------------ |
| Android  | `KeyboardAvoidingView` with `behavior="height"`  |
| iOS      | `KeyboardAvoidingView` with `behavior="padding"` |
| Web      | CSS `100dvh` + VisualViewport API fallback       |

**Native Implementation**:

```tsx
<KeyboardAvoidingView
  behavior={Platform.OS === "ios" ? "padding" : "height"}
  style={[styles.container, style]}
  keyboardVerticalOffset={keyboardVerticalOffset}
>
  {children}
</KeyboardAvoidingView>
```

**Web Implementation**:

- Use `height: 100dvh` (dynamic viewport height) which automatically adjusts for mobile keyboards
- Fallback: Listen to `window.visualViewport` resize events and calculate available height
- Apply via inline style or CSS variable

### Screen Updates

**capture.tsx**:

- Remove `KeyboardAvoidingView` (lines 523-527)
- Wrap content with `KeyboardAwareContainer`
- Keep `ScrollView` with `keyboardShouldPersistTaps="handled"`

**edit.tsx**:

- Remove `KeyboardAvoidingView` (lines 289-293)
- Wrap content after `Appbar.Header` with `KeyboardAwareContainer`
- Keep `ScrollView` inside

**BodyEditor/index.tsx**:

- Replace existing `KeyboardAvoidingView` with `KeyboardAwareContainer`

**search.tsx** (if needed):

- Add `KeyboardAwareContainer` if keyboard issues exist

### QuickCaptureActivity (Android Native)

The native quick capture dialog uses `SOFT_INPUT_ADJUST_PAN`. If issues persist after React Native fixes, add to AndroidManifest.xml:

```xml
<activity
    android:name=".QuickCaptureActivity"
    android:windowSoftInputMode="adjustResize"
    ...
```

## Testing

1. Android: Open capture/edit screens, tap text field, verify content scrolls/resizes above keyboard
2. iOS: Same as Android
3. Mobile Web (Chrome/Safari): Same verification
4. Verify tapping outside text fields doesn't dismiss keyboard unexpectedly (keyboardShouldPersistTaps)

## Notes

- MainActivity already has `android:windowSoftInputMode="adjustResize"` configured
- `dvh` unit has good browser support (Chrome 108+, Safari 15.4+, Firefox 101+)
- VisualViewport API provides fallback for older browsers
