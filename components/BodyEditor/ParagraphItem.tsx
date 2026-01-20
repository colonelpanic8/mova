import { Block } from "@/utils/orgBody";
import React from "react";
import { StyleSheet, View } from "react-native";
import { TextInput, useTheme } from "react-native-paper";

export interface ParagraphItemProps {
  block: Block;
  onChangeContent: (id: string, content: string) => void;
}

export function ParagraphItem({ block, onChangeContent }: ParagraphItemProps) {
  const theme = useTheme();
  const indentPadding = block.indent * 24;

  return (
    <View style={[styles.row, { paddingLeft: indentPadding }]}>
      <TextInput
        value={block.content}
        onChangeText={(text) => onChangeContent(block.id, text)}
        style={[styles.input, { color: theme.colors.onSurface }]}
        mode="flat"
        multiline
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
    minHeight: 48,
  },
  input: {
    flex: 1,
    backgroundColor: "transparent",
  },
});

export default ParagraphItem;
