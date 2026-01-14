# Android Quick Capture Widget Design

## Overview

A 4x1 Android home screen widget with an always-visible text input field and submit button for quick todo capture without opening the app.

## Architecture

### Widget Layout

```
┌─────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────┐  ┌─────────┐  │
│  │ What needs to be done?          │  │   +     │  │
│  └─────────────────────────────────┘  └─────────┘  │
└─────────────────────────────────────────────────────┘
     TextInput (editable)                Submit btn
```

### Technical Approach

- Use `react-native-android-widget` library with Expo config plugin
- Widget runs as native Android component (not React Native JS runtime)
- Widget UI defined using library primitives (FlexWidget, TextInputWidget, etc.)
- On submit, widget triggers background task that calls org-agenda-api
- Credentials stored in Android SharedPreferences (accessible to widget)

### Data Flow

1. User types in widget text field
2. Taps "+" button
3. Widget reads stored credentials from SharedPreferences
4. Background task POSTs to `{apiUrl}/create` with auth header
5. Shows brief success/error feedback
6. Clears input on success

## Error Handling & Retry Logic

### Retry Strategy

- On network failure or 5xx error: retry up to 3 times with exponential backoff (2s, 4s, 8s)
- On 401 (auth failure): no retry, show "Auth failed" message
- On 502 specifically: trigger server restart request before retrying

### Restart-on-Failure Flow

1. First attempt fails with 502/503
2. Call `POST /restart` endpoint to wake up workers
3. Wait 10 seconds for server warmup
4. Retry original request (up to 2 more times)

### Offline Queue Behavior

- If device is offline, queue the todo locally
- When connectivity returns, flush queue in order
- Store pending todos in SharedPreferences (survives widget/app restarts)

### User Feedback

- Normal submit: brief checkmark animation or green flash
- Retrying: subtle spinner or pulsing indicator
- Failed after retries: red flash + "Tap to retry" state (todo stays in input)
- Queued offline: yellow/orange indicator + "Will sync when online"

### Storage Structure

```
SharedPreferences:
  - mova_api_url: string
  - mova_username: string
  - mova_password: string
  - mova_pending_todos: JSON array of {text, timestamp, retryCount}
```

## Implementation Structure

### New Dependencies

```json
"react-native-android-widget": "^0.15.0"
```

### File Structure

```
mova/
├── widgets/
│   ├── QuickCaptureWidget.tsx    # Widget UI definition
│   ├── QuickCaptureTask.ts       # Background task handler
│   └── storage.ts                # SharedPreferences helpers
├── app.json                      # Add widget config plugin
└── android/                      # Generated on prebuild, committed
```

### app.json Widget Configuration

```json
"plugins": [
  ["react-native-android-widget", {
    "widgets": [{
      "name": "QuickCaptureWidget",
      "label": "Mova Quick Capture",
      "minWidth": "250dp",
      "minHeight": "40dp",
      "resizeMode": "horizontal",
      "widgetFeatures": "reconfigurable"
    }]
  }]
]
```

### Credential Sync

- When user logs in via main app, also write credentials to SharedPreferences
- Widget reads from same SharedPreferences location
- Logout clears both AsyncStorage (app) and SharedPreferences (widget)

## Build Workflow

### Initial Setup

```bash
# Generate native android/ folder
npx expo prebuild --platform android

# Commit the android/ folder
git add android/
git commit -m "Add Android native folder for widget support"
```

### Development

```bash
npx expo run:android    # Build + install + run with hot reload
```

### APK Creation

```bash
cd android
./gradlew assembleDebug      # Debug APK
./gradlew assembleRelease    # Release APK
```

## Changes to Existing Files

### context/AuthContext.tsx

- On login: write credentials to SharedPreferences in addition to AsyncStorage
- On logout: clear both AsyncStorage and SharedPreferences

### app.json

- Add `react-native-android-widget` plugin configuration
