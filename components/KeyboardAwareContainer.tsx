import React, { useEffect, useState } from "react";
import {
  Platform,
  KeyboardAvoidingView as RNKeyboardAvoidingView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { KeyboardAvoidingView as KCKeyboardAvoidingView } from "react-native-keyboard-controller";

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

  // iOS: Use standard KeyboardAvoidingView with padding
  if (Platform.OS === "ios") {
    return (
      <RNKeyboardAvoidingView
        behavior="padding"
        style={[styles.container, style]}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        {children}
      </RNKeyboardAvoidingView>
    );
  }

  // Android: Use react-native-keyboard-controller for edge-to-edge support
  // The standard KeyboardAvoidingView doesn't work well with edge-to-edge mode
  // See: https://github.com/expo/expo/issues/36685
  return (
    <KCKeyboardAvoidingView
      behavior="padding"
      style={[styles.container, style]}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {children}
    </KCKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
