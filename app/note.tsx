import {
  countHeadings,
  NoteContent,
  useOpenNote,
} from "@/components/notes/NoteContent";
import { NoteRow } from "@/components/notes/NoteRow";
import { useApi } from "@/context/ApiContext";
import { useAuth } from "@/context/AuthContext";
import {
  buildServerIdentity,
  queryKeys,
  SIGNED_OUT_IDENTITY,
} from "@/hooks/queryKeys";
import type { NoteSummary } from "@/services/api";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Appbar, Text, useTheme } from "react-native-paper";

/** Headings start collapsed in notes with more than this many of them. */
const EXPANDED_HEADING_LIMIT = 30;

function ConnectionList({
  title,
  notes,
  showContext,
}: {
  title: string;
  notes: NoteSummary[];
  showContext?: boolean;
}) {
  const openNote = useOpenNote();
  const onPress = useCallback(
    (note: NoteSummary) => openNote(note.ref),
    [openNote],
  );
  if (notes.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text variant="titleSmall" style={styles.sectionTitle}>
        {title} ({notes.length})
      </Text>
      {notes.map((note) => (
        <NoteRow
          key={note.ref}
          note={note}
          onPress={onPress}
          detail={showContext ? note.context : undefined}
        />
      ))}
    </View>
  );
}

export default function NoteScreen() {
  const { ref } = useLocalSearchParams<{ ref: string }>();
  const router = useRouter();
  const api = useApi();
  const { apiUrl, username } = useAuth();
  const theme = useTheme();
  const openNote = useOpenNote();
  const identity = buildServerIdentity(apiUrl, username);

  const noteQuery = useQuery({
    queryKey: queryKeys.note(identity ?? SIGNED_OUT_IDENTITY, ref ?? ""),
    enabled: Boolean(api && identity && ref),
    queryFn: () => api!.getNote(ref!),
  });
  const data = noteQuery.data;

  // null until toggled: follow the size-based default.
  const [expandAll, setExpandAll] = useState<boolean | null>(null);
  const defaultExpanded =
    expandAll ??
    (data ? countHeadings(data.content) <= EXPANDED_HEADING_LIMIT : true);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await noteQuery.refetch();
    setRefreshing(false);
  }, [noteQuery]);

  const note = data?.note;
  const fileRef = note && note.fileRef !== note.ref ? note.fileRef : null;

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={note?.title ?? ""} />
        {data && data.content.children.length > 0 && (
          <Appbar.Action
            icon={
              defaultExpanded
                ? "unfold-less-horizontal"
                : "unfold-more-horizontal"
            }
            accessibilityLabel={defaultExpanded ? "Collapse all" : "Expand all"}
            onPress={() => setExpandAll(!defaultExpanded)}
          />
        )}
      </Appbar.Header>

      {noteQuery.isPending ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      ) : noteQuery.isError || !data ? (
        <ScrollView
          contentContainerStyle={[styles.centered, { flexGrow: 1 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <Text variant="bodyLarge" style={{ color: theme.colors.error }}>
            {noteQuery.error?.message ?? "Failed to load note"}
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <Text
            variant="bodySmall"
            style={[
              styles.path,
              { color: fileRef ? theme.colors.primary : theme.colors.outline },
            ]}
            onPress={fileRef ? () => openNote(fileRef) : undefined}
          >
            {[data.note.file, ...data.note.olp].join(" › ")}
          </Text>
          {data.note.tags.length > 0 && (
            <Text
              variant="bodySmall"
              style={[styles.path, { color: theme.colors.outline }]}
            >
              :{data.note.tags.join(":")}:
            </Text>
          )}
          <View style={styles.body}>
            <NoteContent
              key={String(defaultExpanded)}
              content={data.content}
              defaultExpanded={defaultExpanded}
            />
          </View>
          <ConnectionList
            title="Linked from"
            notes={data.backlinks}
            showContext
          />
          <ConnectionList title="Links to" notes={data.links} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  content: {
    paddingVertical: 12,
    paddingBottom: 48,
  },
  path: {
    paddingHorizontal: 16,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
});
