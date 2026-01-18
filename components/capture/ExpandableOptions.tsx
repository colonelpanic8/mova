// components/capture/ExpandableOptions.tsx
import React, { useState } from "react";
import { LayoutAnimation, Platform, StyleSheet, UIManager, View } from "react-native";
import { Button, Divider } from "react-native-paper";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface ExpandableOptionsProps {
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

export function ExpandableOptions({ children, defaultExpanded = false }: ExpandableOptionsProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  return (
    <View style={styles.container}>
      <Button
        mode="text"
        onPress={toggle}
        icon={expanded ? "chevron-up" : "chevron-down"}
        contentStyle={styles.buttonContent}
        style={styles.button}
      >
        {expanded ? "Less options" : "More options"}
      </Button>

      {expanded && (
        <>
          <Divider style={styles.divider} />
          <View style={styles.optionsContainer}>{children}</View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  button: {
    alignSelf: "flex-start",
  },
  buttonContent: {
    flexDirection: "row-reverse",
  },
  divider: {
    marginVertical: 8,
  },
  optionsContainer: {
    paddingTop: 8,
  },
});
