import {
  headingsStartExpanded,
  NoteView,
  useNoteQuery,
} from "@/components/notes/NoteView";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Appbar, useTheme } from "react-native-paper";

export default function NoteScreen() {
  const { ref } = useLocalSearchParams<{ ref: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { data } = useNoteQuery(ref);

  // null until toggled: follow the size-based default.
  const [expandAll, setExpandAll] = useState<boolean | null>(null);
  const expanded = expandAll ?? headingsStartExpanded(data);

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={data?.note.title ?? ""} />
        {data && data.content.children.length > 0 && (
          <Appbar.Action
            icon={
              expanded ? "unfold-less-horizontal" : "unfold-more-horizontal"
            }
            accessibilityLabel={expanded ? "Collapse all" : "Expand all"}
            onPress={() => setExpandAll(!expanded)}
          />
        )}
        {ref && (
          <Appbar.Action
            icon="graph-outline"
            accessibilityLabel="Local graph"
            onPress={() => router.push({ pathname: "/graph", params: { ref } })}
          />
        )}
      </Appbar.Header>
      {ref && <NoteView noteRef={ref} expandAll={expandAll} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
