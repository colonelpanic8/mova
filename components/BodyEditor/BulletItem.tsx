import { Block } from "@/utils/orgBody";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Text, TextInput, useTheme } from "react-native-paper";

export interface BulletItemProps {
  block: Block;
  index?: number; // For numbered lists
  onChangeContent: (id: string, content: string) => void;
  onSubmit: (id: string) => void;
}

export function BulletItem({
  block,
  index,
  onChangeContent,
  onSubmit,
}: BulletItemProps) {
  const theme = useTheme();
  const indentPadding = block.indent * 24;

  const prefix = block.type === "numbered" ? `${(index ?? 0) + 1}.` : "\u2022";

  return (
    <View style={[styles.row, { paddingLeft: indentPadding }]}>
      <Text style={[styles.prefix, { color: theme.colors.onSurfaceVariant }]}>
        {prefix}
      </Text>
      <TextInput
        value={block.content}
        onChangeText={(text) => onChangeContent(block.id, text)}
        onSubmitEditing={() => onSubmit(block.id)}
        style={[styles.input, { color: theme.colors.onSurface }]}
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
  prefix: {
    width: 24,
    textAlign: "center",
    fontSize: 16,
  },
  input: {
    flex: 1,
    backgroundColor: "transparent",
  },
});

export default BulletItem;
