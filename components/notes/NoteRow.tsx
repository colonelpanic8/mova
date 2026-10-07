import type { NoteSummary } from "@/services/api";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

/** Where a note lives: its file, then the headings above it. */
export function notePath(note: NoteSummary): string {
  return [note.file, ...note.olp].join(" › ");
}

interface NoteRowProps {
  note: NoteSummary;
  onPress: (note: NoteSummary) => void;
  /** Extra line under the path, e.g. a search snippet or backlink context. */
  detail?: string;
}

export const NoteRow = memo(function NoteRow({
  note,
  onPress,
  detail,
}: NoteRowProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => onPress(note)}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: theme.colors.outlineVariant },
        pressed && { backgroundColor: theme.colors.surfaceVariant },
      ]}
    >
      <View style={styles.titleLine}>
        <Text variant="titleSmall" style={styles.title} numberOfLines={2}>
          {note.title}
        </Text>
        {note.backlinkCount > 0 && (
          <View style={styles.backlinks}>
            <MaterialCommunityIcons
              name="link-variant"
              size={14}
              color={theme.colors.outline}
            />
            <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
              {note.backlinkCount}
            </Text>
          </View>
        )}
      </View>
      <Text
        variant="bodySmall"
        style={{ color: theme.colors.outline }}
        numberOfLines={1}
      >
        {notePath(note)}
        {note.tags.length > 0 ? `  :${note.tags.join(":")}:` : ""}
      </Text>
      {detail ? (
        <Text variant="bodySmall" style={styles.detail} numberOfLines={3}>
          {detail}
        </Text>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    flex: 1,
  },
  backlinks: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  detail: {
    marginTop: 4,
    opacity: 0.85,
  },
});
