# Widget Fixes

## Overview

Debug and fix the Android Quick Capture widget which currently errors after being placed on the home screen.

## Current State

- Widget implementation exists per `2026-01-11-android-widget-design.md`
- Widget can be added to home screen
- Widget crashes/errors after placement
- Root cause unknown - needs investigation

## Investigation Steps

### 1. Setup Testing Environment

```bash
# Start Android emulator
npx expo run:android

# Or use physical device with USB debugging
adb devices
```

### 2. Add Widget to Home Screen

1. Long press on home screen
2. Select "Widgets"
3. Find "Mova Quick Capture"
4. Drag to home screen
5. Observe error

### 3. Capture Error Logs

```bash
# View all logs
adb logcat

# Filter for React Native / widget errors
adb logcat | grep -E "(ReactNative|Widget|mova|Error|Exception)"

# Or use Android Studio Logcat with filters
```

### 4. Common Widget Issues to Check

#### SharedPreferences Access

- Widget may not have access to app's SharedPreferences
- Check if credentials are being written correctly from app
- Verify SharedPreferences key names match between app and widget

#### Widget Provider Registration

- Verify `AndroidManifest.xml` has correct widget provider entry
- Check widget info XML configuration

#### React Native Bridge

- Widget runs outside main RN runtime
- Check if background task is properly registered
- Verify headless JS task configuration

#### Network Permissions

- Widget may need explicit network permissions
- Check if background network calls are allowed

### 5. Files to Inspect

```
widgets/
├── QuickCaptureWidget.tsx    # Widget UI - check for render errors
├── QuickCaptureTask.ts       # Background task - check API call logic
└── storage.ts                # SharedPreferences - check key names

android/app/src/main/
├── AndroidManifest.xml       # Widget provider registration
├── res/xml/                  # Widget configuration XML

app.json                      # Plugin configuration
```

## Potential Fixes

### If SharedPreferences Issue

Ensure app writes credentials on login:

```typescript
// In AuthContext or login flow
import { SharedPreferences } from "./widgets/storage";

await SharedPreferences.set("mova_api_url", apiUrl);
await SharedPreferences.set("mova_username", username);
await SharedPreferences.set("mova_password", password);
```

### If Widget Provider Issue

Verify app.json plugin config matches design doc:

```json
"plugins": [
  ["react-native-android-widget", {
    "widgets": [{
      "name": "QuickCaptureWidget",
      "label": "Mova Quick Capture",
      "minWidth": "250dp",
      "minHeight": "40dp"
    }]
  }]
]
```

### If Background Task Issue

Check headless task registration:

```typescript
// In index.js or app entry
import { registerWidgetTaskHandler } from "react-native-android-widget";
import { QuickCaptureTask } from "./widgets/QuickCaptureTask";

registerWidgetTaskHandler(QuickCaptureTask);
```

### If Network Issue

May need to handle offline state in widget:

- Queue todo locally
- Show "offline" indicator
- Sync when connectivity returns

## Testing Checklist

- [ ] Widget appears in widget picker
- [ ] Widget can be placed on home screen without crash
- [ ] Widget renders correctly (text input visible, button visible)
- [ ] Text input accepts keyboard input
- [ ] Submit button is tappable
- [ ] Submitting with valid credentials creates todo
- [ ] Submitting with invalid credentials shows error
- [ ] Submitting while offline queues todo
- [ ] Input clears after successful submit
- [ ] Widget works after app is killed
- [ ] Widget works after device restart

## Deliverables

1. Root cause identified and documented
2. All bugs fixed
3. Testing checklist passed
4. Any design doc updates if implementation changed
