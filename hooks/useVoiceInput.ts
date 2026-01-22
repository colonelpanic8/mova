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
  const { onTranscript, onPartialTranscript, onError, lang = "en-US" } = options;
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
