import React from "react";
import { StyleSheet, View } from "react-native";
import { IconButton, useTheme } from "react-native-paper";

export interface ToolbarProps {
  onAddChecklist: () => void;
  onAddBullet: () => void;
  onAddNumbered: () => void;
  onIndent: () => void;
  onOutdent: () => void;
}

export function Toolbar({
  onAddChecklist,
  onAddBullet,
  onAddNumbered,
  onIndent,
  onOutdent,
}: ToolbarProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.toolbar,
        { backgroundColor: theme.colors.surfaceVariant },
      ]}
    >
      <IconButton
        icon="checkbox-marked-outline"
        onPress={onAddChecklist}
        testID="toolbar-checklist"
      />
      <IconButton
        icon="format-list-bulleted"
        onPress={onAddBullet}
        testID="toolbar-bullet"
      />
      <IconButton
        icon="format-list-numbered"
        onPress={onAddNumbered}
        testID="toolbar-numbered"
      />
      <View style={styles.separator} />
      <IconButton
        icon="format-indent-decrease"
        onPress={onOutdent}
        testID="toolbar-outdent"
      />
      <IconButton
        icon="format-indent-increase"
        onPress={onIndent}
        testID="toolbar-indent"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  separator: {
    flex: 1,
  },
});

export default Toolbar;
