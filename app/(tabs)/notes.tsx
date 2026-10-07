import { useOpenNote } from "@/components/notes/NoteContent";
import { NoteRow } from "@/components/notes/NoteRow";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useApi } from "@/context/ApiContext";
import { useAuth } from "@/context/AuthContext";
import {
  buildServerIdentity,
  queryKeys,
  SIGNED_OUT_IDENTITY,
} from "@/hooks/queryKeys";
import type { NoteSummary } from "@/services/api";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  IconButton,
  Searchbar,
  SegmentedButtons,
  Text,
  useTheme,
} from "react-native-paper";

const SEARCH_DEBOUNCE_MS = 300;

type SortMode = "recent" | "title" | "links";

const SORTS: Record<SortMode, (a: NoteSummary, b: NoteSummary) => number> = {
  recent: (a, b) => b.mtime - a.mtime,
  title: (a, b) => a.title.localeCompare(b.title),
  links: (a, b) => b.backlinkCount - a.backlinkCount,
};

const keyExtractor = (note: NoteSummary) => note.ref;

export default function NotesScreen() {
  const api = useApi();
  const { apiUrl, username } = useAuth();
  const theme = useTheme();
  const openNote = useOpenNote();
  const identity = buildServerIdentity(apiUrl, username) ?? SIGNED_OUT_IDENTITY;

  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("recent");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  const listQuery = useQuery({
    queryKey: queryKeys.notes(identity),
    enabled: Boolean(api) && identity !== SIGNED_OUT_IDENTITY && !query,
    queryFn: () => api!.getNotes(),
  });
  const searchQuery = useQuery({
    queryKey: queryKeys.noteSearch(identity, query),
    enabled: Boolean(api) && identity !== SIGNED_OUT_IDENTITY && Boolean(query),
    queryFn: () => api!.getNotes(query),
    placeholderData: keepPreviousData,
  });
  const active = query ? searchQuery : listQuery;

  const notes = useMemo(() => {
    const result = active.data?.notes ?? [];
    return query ? result : [...result].sort(SORTS[sort]);
  }, [active.data, query, sort]);

  const onPress = useCallback(
    (note: NoteSummary) => openNote(note.ref),
    [openNote],
  );
  const renderItem = useCallback(
    ({ item }: { item: NoteSummary }) => (
      <NoteRow note={item} onPress={onPress} detail={item.snippet} />
    ),
    [onPress],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await active.refetch();
    setRefreshing(false);
  };

  return (
    <ScreenContainer testID="notesScreen">
      <View style={styles.searchContainer}>
        <Searchbar
          testID="notesSearchInput"
          placeholder="Search notes..."
          onChangeText={setInput}
          value={input}
          style={styles.searchbar}
        />
        <IconButton icon="refresh" onPress={onRefresh} disabled={refreshing} />
      </View>
      {!query && (
        <SegmentedButtons
          style={styles.sort}
          density="small"
          value={sort}
          onValueChange={(value) => setSort(value as SortMode)}
          buttons={[
            { value: "recent", label: "Recent" },
            { value: "title", label: "A–Z" },
            { value: "links", label: "Most linked" },
          ]}
        />
      )}

      {active.isPending ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      ) : active.isError ? (
        <View style={styles.centered}>
          <Text variant="bodyLarge" style={{ color: theme.colors.error }}>
            {active.error.message}
          </Text>
        </View>
      ) : notes.length === 0 ? (
        <View style={styles.centered}>
          <Text variant="bodyLarge" style={{ opacity: 0.6 }}>
            {query ? "No matching notes" : "No notes found"}
          </Text>
        </View>
      ) : (
        <FlatList
          testID="notesList"
          data={notes}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          initialNumToRender={15}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingRight: 4,
    paddingBottom: 8,
  },
  searchbar: {
    flex: 1,
    elevation: 0,
  },
  sort: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
});
