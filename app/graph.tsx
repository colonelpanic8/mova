import ForceGraph, {
  type ForceGraphLink,
  type ForceGraphNode,
} from "@/components/notes/ForceGraph";
import {
  NoteNavigationProvider,
  useOpenNote,
} from "@/components/notes/NoteContent";
import { NoteView } from "@/components/notes/NoteView";
import { useApi } from "@/context/ApiContext";
import { useAuth } from "@/context/AuthContext";
import {
  buildServerIdentity,
  queryKeys,
  SIGNED_OUT_IDENTITY,
} from "@/hooks/queryKeys";
import type { NoteGraphResponse } from "@/services/api";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Appbar,
  Button,
  Chip,
  IconButton,
  Searchbar,
  SegmentedButtons,
  Surface,
  Switch,
  Text,
  useTheme,
} from "react-native-paper";

/** Wide enough to show the preview sidebar beside the graph. */
const SIDEBAR_MIN_WIDTH = 900;
const SEARCH_RESULTS = 8;

const directoryOf = (file: string) =>
  file.includes("/") ? file.slice(0, file.indexOf("/")) : "(top level)";

interface Filters {
  localRoot: string | null;
  depth: number;
  showParents: boolean;
  hideOrphans: boolean;
  excludedDirs: Set<string>;
}

function filterGraph(data: NoteGraphResponse, filters: Filters) {
  const allowed = new Set(
    data.nodes
      .filter((node) => !filters.excludedDirs.has(directoryOf(node.file)))
      .map((node) => node.id),
  );
  if (filters.localRoot) allowed.add(filters.localRoot);
  let links = data.links.filter(
    (link) =>
      (filters.showParents || link.type === "link") &&
      allowed.has(link.source) &&
      allowed.has(link.target),
  );

  let included = allowed;
  if (filters.localRoot) {
    const adjacent = new Map<string, string[]>();
    for (const link of links) {
      adjacent.set(link.source, [
        ...(adjacent.get(link.source) ?? []),
        link.target,
      ]);
      adjacent.set(link.target, [
        ...(adjacent.get(link.target) ?? []),
        link.source,
      ]);
    }
    included = new Set([filters.localRoot]);
    let frontier = [filters.localRoot];
    for (let step = 0; step < filters.depth; step++) {
      frontier = frontier.flatMap((id) =>
        (adjacent.get(id) ?? []).filter((next) => !included.has(next)),
      );
      frontier.forEach((id) => included.add(id));
    }
    links = links.filter(
      (link) => included.has(link.source) && included.has(link.target),
    );
  }

  const degree = new Map<string, number>();
  for (const link of links) {
    degree.set(link.source, (degree.get(link.source) ?? 0) + 1);
    degree.set(link.target, (degree.get(link.target) ?? 0) + 1);
  }
  const nodes: ForceGraphNode[] = data.nodes
    .filter(
      (node) =>
        included.has(node.id) &&
        (!filters.hideOrphans ||
          degree.has(node.id) ||
          node.id === filters.localRoot),
    )
    .map((node) => ({
      id: node.id,
      title: node.title,
      degree: degree.get(node.id) ?? 0,
    }));
  return { nodes, links: links as ForceGraphLink[] };
}

function useHistory(initial: string | null) {
  const [state, setState] = useState({
    entries: initial ? [initial] : [],
    index: initial ? 0 : -1,
  });
  return {
    current: state.index >= 0 ? state.entries[state.index] : null,
    canBack: state.index > 0,
    canForward: state.index < state.entries.length - 1,
    visit: (id: string | null) =>
      setState((prev) =>
        id === null
          ? { ...prev, index: -1 }
          : prev.entries[prev.index] === id
            ? prev
            : {
                entries: [...prev.entries.slice(0, prev.index + 1), id],
                index: prev.index + 1,
              },
      ),
    back: () => setState((prev) => ({ ...prev, index: prev.index - 1 })),
    forward: () => setState((prev) => ({ ...prev, index: prev.index + 1 })),
  };
}

export default function GraphScreen() {
  const params = useLocalSearchParams<{ ref?: string }>();
  const router = useRouter();
  const theme = useTheme();
  const api = useApi();
  const { apiUrl, username } = useAuth();
  const identity = buildServerIdentity(apiUrl, username);
  const pushNote = useOpenNote();
  const { width } = useWindowDimensions();
  const wide = width >= SIDEBAR_MIN_WIDTH;

  const graphQuery = useQuery({
    queryKey: queryKeys.noteGraph(identity ?? SIGNED_OUT_IDENTITY),
    enabled: Boolean(api && identity),
    queryFn: () => api!.getNoteGraph(),
  });

  const [localRoot, setLocalRoot] = useState<string | null>(params.ref ?? null);
  const [depth, setDepth] = useState(1);
  const [showParents, setShowParents] = useState(true);
  const [hideOrphans, setHideOrphans] = useState(false);
  const [excludedDirs, setExcludedDirs] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [searching, setSearching] = useState(false);
  const [search, setSearch] = useState("");
  const [focus, setFocus] = useState<{ id: string; nonce: number } | null>(
    null,
  );
  const history = useHistory(params.ref ?? null);
  const selectedId = history.current;

  const data = graphQuery.data;
  const byId = useMemo(
    () => new Map((data?.nodes ?? []).map((node) => [node.id, node])),
    [data],
  );
  const directories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const node of data?.nodes ?? []) {
      const dir = directoryOf(node.file);
      counts.set(dir, (counts.get(dir) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);
  const graph = useMemo(
    () =>
      data
        ? filterGraph(data, {
            localRoot,
            depth,
            showParents,
            hideOrphans,
            excludedDirs,
          })
        : { nodes: [], links: [] },
    [data, localRoot, depth, showParents, hideOrphans, excludedDirs],
  );
  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query || !data) return [];
    return data.nodes
      .filter((node) => node.title.toLowerCase().includes(query))
      .slice(0, SEARCH_RESULTS);
  }, [data, search]);

  const colors = useMemo(
    () => ({
      background: theme.colors.background,
      text: theme.colors.onBackground,
      link: theme.colors.outline,
      highlight: theme.colors.primary,
    }),
    [theme],
  );

  const preview = (id: string | null) => {
    history.visit(id);
    if (id) setFocus((prev) => ({ id, nonce: (prev?.nonce ?? 0) + 1 }));
  };
  const showLocal = (id: string) => {
    setLocalRoot(id);
    history.visit(id);
  };
  const selected = selectedId ? byId.get(selectedId) : undefined;
  const root = localRoot ? byId.get(localRoot) : undefined;

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={root ? `Local: ${root.title}` : "Graph"} />
        {localRoot && (
          <Appbar.Action
            icon="earth"
            accessibilityLabel="Global graph"
            onPress={() => setLocalRoot(null)}
          />
        )}
        <Appbar.Action
          icon="magnify"
          accessibilityLabel="Search"
          onPress={() => setSearching((value) => !value)}
        />
        <Appbar.Action
          icon="filter-variant"
          accessibilityLabel="Filters"
          onPress={() => setShowFilters((value) => !value)}
        />
      </Appbar.Header>

      {searching && (
        <View style={styles.search}>
          <Searchbar
            placeholder="Find a note..."
            value={search}
            onChangeText={setSearch}
            autoFocus
            style={styles.searchbar}
          />
          <FlatList
            data={searchResults}
            keyExtractor={(node) => node.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                style={styles.searchResult}
                onPress={() => {
                  if (localRoot && !graph.nodes.some((n) => n.id === item.id)) {
                    setLocalRoot(item.id);
                  }
                  preview(item.id);
                  setSearching(false);
                  setSearch("");
                }}
              >
                <Text variant="bodyMedium">{item.title}</Text>
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.outline }}
                >
                  {item.file}
                </Text>
              </Pressable>
            )}
          />
        </View>
      )}

      {showFilters && (
        <Surface style={styles.filters} elevation={1}>
          {localRoot && (
            <View style={styles.filterRow}>
              <Text variant="bodyMedium">Neighbors</Text>
              <SegmentedButtons
                density="small"
                style={styles.depth}
                value={String(depth)}
                onValueChange={(value) => setDepth(Number(value))}
                buttons={[1, 2, 3].map((n) => ({
                  value: String(n),
                  label: String(n),
                }))}
              />
            </View>
          )}
          <View style={styles.filterRow}>
            <Text variant="bodyMedium">Link headings to their parent</Text>
            <Switch value={showParents} onValueChange={setShowParents} />
          </View>
          <View style={styles.filterRow}>
            <Text variant="bodyMedium">Hide orphans</Text>
            <Switch value={hideOrphans} onValueChange={setHideOrphans} />
          </View>
          <View style={styles.chips}>
            {directories.map(([dir, count]) => (
              <Chip
                key={dir}
                compact
                selected={!excludedDirs.has(dir)}
                showSelectedCheck
                onPress={() =>
                  setExcludedDirs((prev) => {
                    const next = new Set(prev);
                    if (next.has(dir)) {
                      next.delete(dir);
                    } else {
                      next.add(dir);
                    }
                    return next;
                  })
                }
              >
                {`${dir} (${count})`}
              </Chip>
            ))}
          </View>
        </Surface>
      )}

      <View style={styles.body}>
        <View style={styles.graph}>
          {graphQuery.isPending ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" />
            </View>
          ) : graphQuery.isError ? (
            <View style={styles.centered}>
              <Text variant="bodyLarge" style={{ color: theme.colors.error }}>
                {graphQuery.error.message}
              </Text>
            </View>
          ) : (
            <ForceGraph
              nodes={graph.nodes}
              links={graph.links}
              selectedId={selectedId}
              focus={focus}
              colors={colors}
              onSelect={(id) => history.visit(id)}
              onOpen={showLocal}
              dom={{ style: { flex: 1 }, scrollEnabled: false }}
            />
          )}
        </View>

        {wide && selectedId && (
          <View
            style={[
              styles.sidebar,
              { borderLeftColor: theme.colors.outlineVariant },
            ]}
          >
            <View style={styles.toolbar}>
              <IconButton
                icon="chevron-left"
                disabled={!history.canBack}
                onPress={history.back}
                accessibilityLabel="Previous note"
              />
              <IconButton
                icon="chevron-right"
                disabled={!history.canForward}
                onPress={history.forward}
                accessibilityLabel="Next note"
              />
              <Text
                variant="titleMedium"
                style={styles.toolbarTitle}
                numberOfLines={1}
              >
                {selected?.title}
              </Text>
              <IconButton
                icon="graph-outline"
                onPress={() => showLocal(selectedId)}
                accessibilityLabel="Local graph"
              />
              <IconButton
                icon="open-in-new"
                onPress={() => pushNote(selectedId)}
                accessibilityLabel="Open note"
              />
              <IconButton
                icon="close"
                onPress={() => history.visit(null)}
                accessibilityLabel="Close preview"
              />
            </View>
            <NoteNavigationProvider onOpenNote={preview}>
              <NoteView key={selectedId} noteRef={selectedId} />
            </NoteNavigationProvider>
          </View>
        )}
      </View>

      {!wide && selected && (
        <Surface style={styles.card} elevation={3}>
          <Text variant="titleMedium" numberOfLines={2}>
            {selected.title}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.outline }}
            numberOfLines={1}
          >
            {[selected.file, ...selected.olp].join(" › ")}
          </Text>
          <View style={styles.cardActions}>
            <Button compact onPress={() => history.visit(null)}>
              Close
            </Button>
            <Button compact onPress={() => showLocal(selected.id)}>
              Local graph
            </Button>
            <Button
              compact
              mode="contained"
              onPress={() => pushNote(selected.id)}
            >
              Open
            </Button>
          </View>
        </Surface>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  body: {
    flex: 1,
    flexDirection: "row",
  },
  graph: {
    flex: 1,
    position: "relative",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  sidebar: {
    width: 440,
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
  },
  toolbarTitle: {
    flex: 1,
  },
  search: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    maxHeight: 360,
  },
  searchbar: {
    elevation: 0,
  },
  searchResult: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  filters: {
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  depth: {
    maxWidth: 180,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  card: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 24,
    padding: 16,
    borderRadius: 16,
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 8,
  },
});
