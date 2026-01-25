/**
 * ActionButton - A compact button for quick actions
 *
 * Used for Today/Tomorrow buttons, quick filters, and other compact action triggers.
 * Provides consistent styling across the app.
 */

import React from "react";
import { StyleProp, StyleSheet, ViewStyle } from "react-native";
import { Button } from "react-native-paper";

/**
 * Border radius for action buttons.
 * Gives a subtle squircle look rather than fully rounded pills.
 */
const ACTION_BUTTON_RADIUS = 8;

export interface ActionButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  mode?: "contained" | "outlined" | "text";
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
  buttonColor?: string;
  textColor?: string;
  style?: StyleProp<ViewStyle>;
}

export function ActionButton({
  children,
  onPress,
  mode = "contained",
  icon,
  disabled,
  loading,
  buttonColor,
  textColor,
  style,
}: ActionButtonProps) {
  return (
    <Button
      mode={mode}
      compact
      onPress={onPress}
      icon={icon}
      disabled={disabled}
      loading={loading}
      buttonColor={buttonColor}
      textColor={textColor}
      style={[styles.button, style]}
    >
      {children}
    </Button>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: ACTION_BUTTON_RADIUS,
  },
});
