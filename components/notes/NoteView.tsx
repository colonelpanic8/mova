import { useApi } from "@/context/ApiContext";
import { useAuth } from "@/context/AuthContext";
import {
  buildServerIdentity,
  queryKeys,
  SIGNED_OUT_IDENTITY,
} from "@/hooks/queryKeys";
import type { NoteResponse } from "@/services/api";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text, useTheme } from "react-native-paper";

import { BacklinksPanel } from "./BacklinksPanel";
import { countHeadings, NoteContent, useOpenNote } from "./NoteContent";

/** Headings start collapsed in notes with more than this many of them. */
const EXPANDED_HEADING_LIMIT = 30;

export function useNoteQuery(ref: string | undefined) {
  const api = useApi();
  const { apiUrl, username } = useAuth();
  const identity = buildServerIdentity(apiUrl, username);
  return useQuery({
    queryKey: queryKeys.note(identity ?? SIGNED_OUT_IDENTITY, ref ?? ""),
    enabled: Boolean(api && identity && ref),
    queryFn: () => api!.getNote(ref!),
  });
}

export function headingsStartExpanded(data: NoteResponse | undefined) {
  return data ? countHeadings(data.content) <= EXPANDED_HEADING_LIMIT : true;
}

interface NoteViewProps {
  noteRef: string;
  /** Overrides whether headings start expanded. */
  expandAll?: boolean | null;
}

/** A note's path, tags, content and connections, scrolling as one page. */
export function NoteView({ noteRef, expandAll = null }: NoteViewProps) {
  const theme = useTheme();
  const openNote = useOpenNote();
  const noteQuery = useNoteQuery(noteRef);
  const data = noteQuery.data;
  const defaultExpanded = expandAll ?? headingsStartExpanded(data);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await noteQuery.refetch();
    setRefreshing(false);
  };
  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
  );

  if (noteQuery.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  if (noteQuery.isError || !data) {
    return (
      <ScrollView
        contentContainerStyle={[styles.centered, { flexGrow: 1 }]}
        refreshControl={refreshControl}
      >
        <Text variant="bodyLarge" style={{ color: theme.colors.error }}>
          {noteQuery.error?.message ?? "Failed to load note"}
        </Text>
      </ScrollView>
    );
  }

  const { note } = data;
  const fileRef = note.fileRef !== note.ref ? note.fileRef : null;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={refreshControl}
    >
      <Text
        variant="bodySmall"
        style={{ color: fileRef ? theme.colors.primary : theme.colors.outline }}
        onPress={fileRef ? () => openNote(fileRef) : undefined}
      >
        {[note.file, ...note.olp].join(" › ")}
      </Text>
      {note.tags.length > 0 && (
        <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
          :{note.tags.join(":")}:
        </Text>
      )}
      <View style={styles.body}>
        <NoteContent
          key={String(defaultExpanded)}
          content={data.content}
          defaultExpanded={defaultExpanded}
        />
      </View>
      <BacklinksPanel
        backlinks={data.backlinks}
        unlinked={data.unlinked}
        links={data.links}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  body: {
    paddingTop: 8,
  },
});
