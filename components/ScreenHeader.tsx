import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function ScreenHeader() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insets.top,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      <Image
        source={require("@/assets/images/mova-header.png")}
        style={styles.logo}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  logo: {
    height: 36,
    width: 108,
  },
});
