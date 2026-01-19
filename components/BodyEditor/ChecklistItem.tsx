import { Block } from "@/utils/orgBody";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Checkbox, TextInput, useTheme } from "react-native-paper";

export interface ChecklistItemProps {
  block: Block;
  onToggle: (id: string) => void;
  onChangeContent: (id: string, content: string) => void;
  onSubmit: (id: string) => void;
}

export function ChecklistItem({
  block,
  onToggle,
  onChangeContent,
  onSubmit,
}: ChecklistItemProps) {
  const theme = useTheme();
  const indentPadding = block.indent * 24;

  return (
    <View style={[styles.row, { paddingLeft: indentPadding }]}>
      <Checkbox
        status={block.checked ? "checked" : "unchecked"}
        onPress={() => onToggle(block.id)}
        testID={`checkbox-${block.id}`}
      />
      <TextInput
        value={block.content}
        onChangeText={(text) => onChangeContent(block.id, text)}
        onSubmitEditing={() => onSubmit(block.id)}
        style={[
          styles.input,
          block.checked && styles.checkedText,
          { color: theme.colors.onSurface },
        ]}
        mode="flat"
        dense
        underlineColor="transparent"
        activeUnderlineColor="transparent"
        testID={`input-${block.id}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
  },
  input: {
    flex: 1,
    backgroundColor: "transparent",
  },
  checkedText: {
    textDecorationLine: "line-through",
    opacity: 0.6,
  },
});

export default ChecklistItem;
