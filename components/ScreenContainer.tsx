import React from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";

import { ScreenHeader } from "./ScreenHeader";

interface ScreenContainerProps {
  children: React.ReactNode;
  testID?: string;
}

export function ScreenContainer({ children, testID }: ScreenContainerProps) {
  const theme = useTheme();

  return (
    <View
      testID={testID}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScreenHeader />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
