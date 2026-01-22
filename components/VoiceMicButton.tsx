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
