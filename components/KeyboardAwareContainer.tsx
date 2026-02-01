import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

interface KeyboardAwareContainerProps {
  children: React.ReactNode;
  keyboardVerticalOffset?: number;
  style?: StyleProp<ViewStyle>;
}

export function KeyboardAwareContainer({
  children,
  keyboardVerticalOffset = 0,
  style,
}: KeyboardAwareContainerProps) {
  // Web: Use VisualViewport API to detect keyboard
  const [webHeight, setWebHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (Platform.OS !== "web") return;

    const viewport = window.visualViewport;
    if (!viewport) return;

    const handleResize = () => {
      // When keyboard opens, visualViewport.height shrinks
      setWebHeight(viewport.height);
    };

    viewport.addEventListener("resize", handleResize);
    handleResize(); // Set initial height

    return () => {
      viewport.removeEventListener("resize", handleResize);
    };
  }, []);

  // Web platform
  if (Platform.OS === "web") {
    return (
      <View
        style={[
          styles.container,
          style,
          // Use dvh for modern browsers, fall back to visualViewport height
          webHeight !== undefined
            ? { height: webHeight }
            : { height: "100dvh" as unknown as number },
        ]}
      >
        {children}
      </View>
    );
  }

  // Mobile: Use KeyboardAvoidingView
  // - iOS: "padding" behavior works best
  // - Android with edge-to-edge (Expo SDK 53+): "height" behavior needed
  //   because windowSoftInputMode no longer works reliably
  // See: https://github.com/expo/expo/issues/36685
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, style]}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
