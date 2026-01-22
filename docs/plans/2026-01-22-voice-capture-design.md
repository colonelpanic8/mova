# Voice Capture Feature Design

## Overview

Add in-app voice input for task capture on Android. Users tap a mic button to dictate task titles instead of typing.

## Library

`expo-speech-recognition` - Expo's official speech recognition library. Integrates cleanly with existing Expo setup.

## Behavior

- Tap mic icon to start recording
- Auto-stops on silence detection
- Partial transcription streams into text field as user speaks
- Visual feedback: mic icon changes appearance while recording (color/animation)

## Integration Points

### Shared Hook: `useVoiceInput`

Location: `hooks/useVoiceInput.ts`

Responsibilities:

- Initialize and manage `expo-speech-recognition`
- Handle permissions
- Expose `start()`, `stop()`, `isListening`, `transcript`, `partialTranscript`
- Handle errors gracefully

### Reusable Component: `VoiceMicButton`

Location: `components/VoiceMicButton.tsx`

Props:

- `onTranscript: (text: string) => void` - called with final transcription
- `disabled?: boolean`

Renders mic IconButton with recording state indication.

### CaptureBar Integration

Location: `components/CaptureBar.tsx`

Add `VoiceMicButton` next to send button. On transcript, append/replace text in the input field.

### Full Capture Screen Integration

Location: `app/(tabs)/capture.tsx`

Add `VoiceMicButton` to the Title field's `PromptField` component (or inline for the title input).

## Permissions

Android: `RECORD_AUDIO` - handled automatically by expo-speech-recognition when speech recognition is started.

## Files to Create

1. `hooks/useVoiceInput.ts`
2. `components/VoiceMicButton.tsx`

## Files to Modify

1. `components/CaptureBar.tsx` - add mic button
2. `app/(tabs)/capture.tsx` - add mic button to title field
3. `package.json` - add expo-speech-recognition dependency
4. `app.config.js` - add required plugin configuration if needed

## Platform Support

Android only for initial implementation. iOS support can be added later (expo-speech-recognition supports both).
