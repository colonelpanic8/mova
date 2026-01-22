# Voice Capture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add in-app voice input for task capture on Android using expo-speech-recognition.

**Architecture:** A shared `useVoiceInput` hook encapsulates all speech recognition logic. A `VoiceMicButton` component provides the UI. Both CaptureBar and the full capture screen use this button to enable voice dictation.

**Tech Stack:** expo-speech-recognition, React Native, TypeScript

---

## Task 1: Install and Configure expo-speech-recognition

**Files:**

- Modify: `package.json`
- Modify: `app.config.js:61-95` (plugins array)

**Step 1: Install the package**

Run:

```bash
npm install expo-speech-recognition
```

**Step 2: Add plugin to app.config.js**

In the `plugins` array, add:

```javascript
[
  "expo-speech-recognition",
  {
    microphonePermission: "Allow Mova to use the microphone for voice capture.",
    speechRecognitionPermission: "Allow Mova to use speech recognition for voice capture.",
    androidSpeechServicePackages: ["com.google.android.googlequicksearchbox"],
  },
],
```

**Step 3: Commit**

```bash
git add package.json package-lock.json app.config.js
git commit -m "chore: add expo-speech-recognition dependency"
```

---

## Task 2: Create useVoiceInput Hook

**Files:**

- Create: `hooks/useVoiceInput.ts`

**Step 1: Create the hook**

```typescript
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { useCallback, useState } from "react";
import { Platform } from "react-native";

interface UseVoiceInputOptions {
  onTranscript?: (text: string) => void;
  onPartialTranscript?: (text: string) => void;
  onError?: (error: string) => void;
  lang?: string;
}

interface UseVoiceInputResult {
  isListening: boolean;
  isSupported: boolean;
  start: () => Promise<void>;
  stop: () => void;
  transcript: string;
}

export function useVoiceInput(
  options: UseVoiceInputOptions = {},
): UseVoiceInputResult {
  const {
    onTranscript,
    onPartialTranscript,
    onError,
    lang = "en-US",
  } = options;
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");

  // Only supported on Android for now
  const isSupported = Platform.OS === "android";

  useSpeechRecognitionEvent("start", () => {
    setIsListening(true);
    setTranscript("");
  });

  useSpeechRecognitionEvent("end", () => {
    setIsListening(false);
  });

  useSpeechRecognitionEvent("result", (event) => {
    const result = event.results[0]?.transcript || "";
    setTranscript(result);

    if (event.isFinal) {
      onTranscript?.(result);
    } else {
      onPartialTranscript?.(result);
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    setIsListening(false);
    onError?.(event.message || event.error);
  });

  const start = useCallback(async () => {
    if (!isSupported) {
      onError?.("Voice input is only supported on Android");
      return;
    }

    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!result.granted) {
      onError?.("Microphone permission denied");
      return;
    }

    ExpoSpeechRecognitionModule.start({
      lang,
      interimResults: true,
      continuous: false,
    });
  }, [isSupported, lang, onError]);

  const stop = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
  }, []);

  return {
    isListening,
    isSupported,
    start,
    stop,
    transcript,
  };
}
```

**Step 2: Commit**

```bash
git add hooks/useVoiceInput.ts
git commit -m "feat: add useVoiceInput hook for speech recognition"
```

---

## Task 3: Create VoiceMicButton Component

**Files:**

- Create: `components/VoiceMicButton.tsx`

**Step 1: Create the component**

```typescript
import { useVoiceInput } from "@/hooks/useVoiceInput";
import React, { useCallback } from "react";
import { StyleSheet } from "react-native";
import { IconButton, useTheme } from "react-native-paper";

interface VoiceMicButtonProps {
  onTranscript: (text: string) => void;
  onPartialTranscript?: (text: string) => void;
  disabled?: boolean;
  size?: number;
}

export function VoiceMicButton({
  onTranscript,
  onPartialTranscript,
  disabled = false,
  size = 20,
}: VoiceMicButtonProps) {
  const theme = useTheme();

  const { isListening, isSupported, start, stop } = useVoiceInput({
    onTranscript,
    onPartialTranscript,
  });

  const handlePress = useCallback(() => {
    if (isListening) {
      stop();
    } else {
      start();
    }
  }, [isListening, start, stop]);

  if (!isSupported) {
    return null;
  }

  return (
    <IconButton
      icon={isListening ? "microphone" : "microphone-outline"}
      size={size}
      onPress={handlePress}
      disabled={disabled}
      style={[
        styles.button,
        isListening && { backgroundColor: theme.colors.errorContainer },
      ]}
      iconColor={isListening ? theme.colors.error : undefined}
    />
  );
}

const styles = StyleSheet.create({
  button: {
    margin: 0,
  },
});
```

**Step 2: Commit**

```bash
git add components/VoiceMicButton.tsx
git commit -m "feat: add VoiceMicButton component"
```

---

## Task 4: Integrate Voice Input into CaptureBar

**Files:**

- Modify: `components/CaptureBar.tsx`

**Step 1: Add import**

At the top of the file, add:

```typescript
import { VoiceMicButton } from "@/components/VoiceMicButton";
```

**Step 2: Add voice handlers**

Inside the `CaptureBar` function, after the existing state declarations, add:

```typescript
const handleVoiceTranscript = useCallback((text: string) => {
  setTitle(text);
}, []);

const handleVoicePartial = useCallback((text: string) => {
  setTitle(text);
}, []);
```

**Step 3: Add VoiceMicButton to the JSX**

Insert the VoiceMicButton between the TextInput and the send IconButton. Find this section:

```tsx
<TextInput
  placeholder="Capture..."
  ...
/>

<IconButton
  icon="send"
  ...
/>
```

And insert between them:

```tsx
<VoiceMicButton
  onTranscript={handleVoiceTranscript}
  onPartialTranscript={handleVoicePartial}
  disabled={submitting}
/>
```

**Step 4: Commit**

```bash
git add components/CaptureBar.tsx
git commit -m "feat: add voice input to CaptureBar"
```

---

## Task 5: Integrate Voice Input into Capture Screen

**Files:**

- Modify: `app/(tabs)/capture.tsx`

**Step 1: Add import**

At the top of the file, add:

```typescript
import { VoiceMicButton } from "@/components/VoiceMicButton";
```

**Step 2: Modify PromptField to accept voice button**

Update the `PromptFieldProps` interface:

```typescript
interface PromptFieldProps {
  prompt: TemplatePrompt;
  value: string | string[];
  onChange: (value: string | string[]) => void;
  showVoiceInput?: boolean;
}
```

**Step 3: Add voice input to string fields in PromptField**

In the default string type case (around line 199), wrap the TextInput with a View and add the mic button. Replace:

```typescript
// Default: string type
const stringValue = typeof value === "string" ? value : "";
return (
  <TextInput
    label={`${prompt.name}${prompt.required ? " *" : ""}`}
    value={stringValue}
    onChangeText={(text) => onChange(text)}
    mode="outlined"
    style={styles.input}
    multiline={
      prompt.name.toLowerCase() === "title" ||
      prompt.name.toLowerCase() === "body"
    }
    numberOfLines={prompt.name.toLowerCase() === "body" ? 4 : 2}
  />
);
```

With:

```typescript
// Default: string type
const stringValue = typeof value === "string" ? value : "";
return (
  <View style={styles.textFieldContainer}>
    <TextInput
      label={`${prompt.name}${prompt.required ? " *" : ""}`}
      value={stringValue}
      onChangeText={(text) => onChange(text)}
      mode="outlined"
      style={styles.textFieldInput}
      multiline={
        prompt.name.toLowerCase() === "title" ||
        prompt.name.toLowerCase() === "body"
      }
      numberOfLines={prompt.name.toLowerCase() === "body" ? 4 : 2}
    />
    {showVoiceInput && (
      <VoiceMicButton
        onTranscript={(text) => onChange(text)}
        onPartialTranscript={(text) => onChange(text)}
      />
    )}
  </View>
);
```

**Step 4: Update PromptField usage for Title field**

In the main render, find where PromptField is used for prompts and pass `showVoiceInput` for title fields:

```tsx
{
  selectedPrompts.map((prompt) => (
    <PromptField
      key={prompt.name}
      prompt={prompt}
      value={values[prompt.name] || (prompt.type === "tags" ? [] : "")}
      onChange={(value) => handleValueChange(prompt.name, value)}
      showVoiceInput={prompt.name.toLowerCase() === "title"}
    />
  ));
}
```

**Step 5: Add styles**

Add to the styles object:

```typescript
textFieldContainer: {
  flexDirection: "row",
  alignItems: "flex-start",
  marginBottom: 16,
},
textFieldInput: {
  flex: 1,
},
```

**Step 6: Commit**

```bash
git add app/(tabs)/capture.tsx
git commit -m "feat: add voice input to capture screen title field"
```

---

## Task 6: Rebuild and Test

**Step 1: Rebuild the Android app**

Run:

```bash
npx expo run:android
```

This is required because we added a native module (expo-speech-recognition).

**Step 2: Manual testing checklist**

- [ ] CaptureBar shows mic button on Android
- [ ] Tapping mic requests permission on first use
- [ ] Speaking produces text in the input field
- [ ] Mic icon changes appearance while listening
- [ ] Auto-stops after silence
- [ ] Full capture screen shows mic button on Title field
- [ ] Mic button is hidden on iOS/web (not supported yet)

**Step 3: Commit any fixes and final commit**

```bash
git add -A
git commit -m "feat: complete voice capture feature for Android"
```

---

## Summary

| Task | Description                                          |
| ---- | ---------------------------------------------------- |
| 1    | Install expo-speech-recognition and configure plugin |
| 2    | Create useVoiceInput hook                            |
| 3    | Create VoiceMicButton component                      |
| 4    | Add voice to CaptureBar                              |
| 5    | Add voice to capture screen                          |
| 6    | Rebuild and test                                     |
