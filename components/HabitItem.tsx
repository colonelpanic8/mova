import { HabitGraph } from "@/components/HabitGraph";
import { useApi } from "@/context/ApiContext";
import { useSettings } from "@/context/SettingsContext";
import { useTemplates } from "@/context/TemplatesContext";
import { useTodoEditingContext } from "@/hooks/useTodoEditing";
import {
  HabitStatus,
  HabitStatusGraphEntry,
  MiniGraphEntry,
  Todo,
} from "@/services/api";
import { formatLocalDate } from "@/utils/dateFormatting";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform, StyleSheet, useWindowDimensions, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Dialog,
  Divider,
  Icon,
  IconButton,
  Menu,
  Portal,
  Text,
  useTheme,
} from "react-native-paper";

function transformGraphData(graph: HabitStatusGraphEntry[]): MiniGraphEntry[] {
  return graph.map((entry) => ({
    date: entry.date,
    conformingRatio: entry.conformingRatioWithout,
    completed: entry.completionCount > 0,
    ...(entry.status === "present" && {
      completionNeededToday: entry.completionExpectedToday,
    }),
  }));
}

// Normalize graph data to ensure "today" appears at a consistent position
// This pads newer habits with "no data" cells and truncates older habits
function normalizeGraphData(
  graphData: MiniGraphEntry[],
  preceding: number,
  following: number,
): MiniGraphEntry[] {
  if (!graphData || graphData.length === 0) {
    return graphData;
  }

  // Find today's index (entry with completionNeededToday defined)
  const todayIndex = graphData.findIndex(
    (e) => e.completionNeededToday !== undefined,
  );
  if (todayIndex === -1) {
    return graphData;
  }

  // Calculate how many days before/after today we have
  const daysBeforeToday = todayIndex;
  const daysAfterToday = graphData.length - todayIndex - 1;

  let result = graphData;

  // Truncate if we have more days before today than needed
  if (daysBeforeToday > preceding) {
    const startIndex = daysBeforeToday - preceding;
    result = result.slice(startIndex);
  }

  // Truncate if we have more days after today than needed
  if (daysAfterToday > following) {
    const newTodayIndex = result.findIndex(
      (e) => e.completionNeededToday !== undefined,
    );
    result = result.slice(0, newTodayIndex + following + 1);
  }

  // Recalculate today index after truncation
  const newTodayIndex = result.findIndex(
    (e) => e.completionNeededToday !== undefined,
  );
  const newDaysBeforeToday = newTodayIndex;

  // Pad if we have fewer days before today than needed
  if (newDaysBeforeToday < preceding) {
    const daysToAdd = preceding - newDaysBeforeToday;
    const firstDate = new Date(result[0].date + "T00:00:00");

    const placeholderEntries: MiniGraphEntry[] = [];
    for (let i = daysToAdd; i > 0; i--) {
      const placeholderDate = new Date(firstDate);
      placeholderDate.setDate(placeholderDate.getDate() - i);
      const dateStr = placeholderDate.toISOString().split("T")[0];
      placeholderEntries.push({
        date: dateStr,
        conformingRatio: -1, // Special value to indicate "no data"
        completed: false,
      });
    }
    result = [...placeholderEntries, ...result];
  }

  return result;
}

function formatNextRequired(dateString: string | undefined): string {
  if (!dateString) return "";

  const date = new Date(dateString + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = date.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "Overdue";
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  if (diffDays <= 7) return `Due in ${diffDays} days`;

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export interface HabitItemProps {
  todo: Todo;
  habitStatus?: HabitStatus;
  onRefreshNeeded?: () => void;
}

// Layout constants
const CELL_WIDTH = 24;
const TODAY_CELL_EXTRA = 4; // Today cell is 28 instead of 24
const CELL_GAP = 3;
const GRAPH_OUTER_PADDING = 6;
const ITEM_CONTAINER_PADDING = 12;

export function HabitItem({
  todo,
  habitStatus,
  onRefreshNeeded,
}: HabitItemProps) {
  const theme = useTheme();
  const router = useRouter();
  const api = useApi();
  const { quickComplete, completingIds } = useTodoEditingContext();
  const { defaultDoneState } = useSettings();
  const { todoStates } = useTemplates();
  const { width: screenWidth } = useWindowDimensions();

  const [menuVisible, setMenuVisible] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [localGraphData, setLocalGraphData] = useState<MiniGraphEntry[] | null>(
    null,
  );
  const [graphLoading, setGraphLoading] = useState(false);
  const [confirmEntry, setConfirmEntry] = useState<MiniGraphEntry | null>(null);
  const [isUncompleting, setIsUncompleting] = useState(false);

  const key = todo.id || `${todo.file}:${todo.pos}:${todo.title}`;
  const isCompleting = completingIds.has(key);
  const wasCompletingRef = useRef(false);

  // Calculate how many cells can fit based on screen width
  const { preceding, following } = useMemo(() => {
    // Available width for cells after accounting for all padding
    const availableWidth =
      screenWidth - ITEM_CONTAINER_PADDING * 2 - GRAPH_OUTER_PADDING * 2;

    // Calculate max cells that fit (accounting for today's larger cell)
    // Each cell slot is cellWidth + gap, except last one doesn't need gap
    // Formula: n * CELL_WIDTH + (n-1) * CELL_GAP + TODAY_CELL_EXTRA <= availableWidth
    // Simplify: n * (CELL_WIDTH + CELL_GAP) - CELL_GAP + TODAY_CELL_EXTRA <= availableWidth
    // n <= (availableWidth + CELL_GAP - TODAY_CELL_EXTRA) / (CELL_WIDTH + CELL_GAP)
    const maxCells = Math.floor(
      (availableWidth + CELL_GAP - TODAY_CELL_EXTRA) / (CELL_WIDTH + CELL_GAP),
    );

    // Split cells evenly between past (including today) and future
    // Give slightly more to past since that's the primary view
    const pastCells = Math.ceil(maxCells / 2);
    const futureCells = Math.floor(maxCells / 2);

    // preceding is past cells minus today (which is always shown)
    // Cap at reasonable values to avoid overwhelming the server
    const preceding = Math.min(14, Math.max(1, pastCells - 1));
    const following = Math.min(14, Math.max(1, futureCells));

    return { preceding, following };
  }, [screenWidth]);

  // Use pre-fetched habitStatus if available, otherwise use local state
  // Pad the data to ensure consistent "today" positioning
  const graphData = useMemo(() => {
    let data: MiniGraphEntry[] | null = null;
    if (habitStatus?.graph) {
      data = transformGraphData(habitStatus.graph);
    } else {
      data = localGraphData;
    }
    if (data) {
      return normalizeGraphData(data, preceding, following);
    }
    return null;
  }, [habitStatus, localGraphData, preceding, following]);

  // Fetch habit status for graph data (only if not pre-fetched)
  const fetchGraphData = useCallback(() => {
    // If we have pre-fetched data, trigger parent refresh instead
    if (habitStatus && onRefreshNeeded) {
      onRefreshNeeded();
      return;
    }

    if (!todo.id || !api) {
      console.log("Cannot fetch habit status: missing id or api", {
        id: todo.id,
        hasApi: !!api,
      });
      return;
    }

    setGraphLoading(true);
    api
      .getHabitStatus(todo.id, preceding, following)
      .then((status) => {
        if (status.graph) {
          setLocalGraphData(transformGraphData(status.graph));
        }
      })
      .catch((err: Error) => {
        console.error("Failed to fetch habit status:", err);
      })
      .finally(() => {
        setGraphLoading(false);
      });
  }, [todo.id, api, preceding, following, habitStatus, onRefreshNeeded]);

  // Initial fetch (only if no pre-fetched data)
  useEffect(() => {
    if (!habitStatus) {
      fetchGraphData();
    }
  }, [fetchGraphData, habitStatus]);

  // Refresh graph after completion finishes
  useEffect(() => {
    if (wasCompletingRef.current && !isCompleting) {
      fetchGraphData();
    }
    wasCompletingRef.current = isCompleting;
  }, [isCompleting, fetchGraphData]);

  // Compute effective default done state
  const effectiveDoneState = useMemo(() => {
    if (defaultDoneState) return defaultDoneState;
    if (!todoStates?.done?.length) return "DONE";
    return todoStates.done.includes("DONE") ? "DONE" : todoStates.done[0];
  }, [defaultDoneState, todoStates]);

  const habitSummary = todo.habitSummary;
  const needsCompletion = habitSummary?.completionNeededToday;
  const nextRequired = formatNextRequired(habitSummary?.nextRequiredInterval);

  const handleCompleteForDate = useCallback(
    (date: Date) => {
      setMenuVisible(false);
      quickComplete(todo, effectiveDoneState, date);
    },
    [todo, effectiveDoneState, quickComplete],
  );

  const handleCompleteToday = useCallback(() => {
    handleCompleteForDate(new Date());
  }, [handleCompleteForDate]);

  const handleCompleteYesterday = useCallback(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    handleCompleteForDate(yesterday);
  }, [handleCompleteForDate]);

  const handleOpenDatePicker = useCallback(() => {
    setMenuVisible(false);
    setShowDatePicker(true);
  }, []);

  const handleDateChange = useCallback(
    (event: DateTimePickerEvent, date?: Date) => {
      setShowDatePicker(false);
      if (event.type === "dismissed" || !date) {
        return;
      }
      handleCompleteForDate(date);
    },
    [handleCompleteForDate],
  );

  const handlePress = useCallback(() => {
    router.push({
      pathname: "/edit",
      params: {
        todo: JSON.stringify(todo),
      },
    });
  }, [router, todo]);

  const handleGraphCellPress = useCallback((entry: MiniGraphEntry) => {
    setConfirmEntry(entry);
  }, []);

  const handleConfirmComplete = useCallback(() => {
    if (!confirmEntry) return;
    const date = new Date(confirmEntry.date + "T00:00:00");
    handleCompleteForDate(date);
    setConfirmEntry(null);
  }, [confirmEntry, handleCompleteForDate]);

  const handleConfirmUncomplete = useCallback(async () => {
    if (!confirmEntry || !api) return;
    setIsUncompleting(true);
    try {
      const result = await api.deleteLogbookEntry(
        todo,
        confirmEntry.date,
        "state-change",
      );
      if (result.status === "deleted") {
        fetchGraphData();
      }
    } catch (err) {
      console.error("Failed to remove completion:", err);
    } finally {
      setIsUncompleting(false);
      setConfirmEntry(null);
    }
  }, [confirmEntry, api, todo, fetchGraphData]);

  const confirmDate = confirmEntry
    ? new Date(confirmEntry.date + "T00:00:00")
    : null;
  const formattedConfirmDate = confirmDate?.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <>
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.colors.surface,
            borderBottomColor: theme.colors.outlineVariant,
          },
        ]}
      >
        {/* Header row: Title and completion button */}
        <View style={styles.headerRow}>
          <View style={styles.titleRow}>
            <IconButton
              icon="pencil"
              size={16}
              onPress={handlePress}
              style={styles.editButton}
            />
            <View style={styles.titleContainer}>
              <Text
                variant="titleMedium"
                style={styles.title}
                numberOfLines={2}
              >
                {todo.title}
              </Text>
              {nextRequired && !needsCompletion && (
                <View style={styles.nextRequiredRow}>
                  <Icon
                    source="calendar-clock"
                    size={14}
                    color={theme.colors.onSurfaceVariant}
                  />
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    {nextRequired}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.actionsContainer}>
            {!needsCompletion && (
              <View
                style={[
                  styles.completedBadge,
                  { backgroundColor: theme.colors.primaryContainer },
                ]}
              >
                <Text
                  variant="labelSmall"
                  style={{ color: theme.colors.onPrimaryContainer }}
                >
                  Done
                </Text>
              </View>
            )}
            <Menu
              visible={menuVisible}
              onDismiss={() => setMenuVisible(false)}
              anchor={
                <Button
                  mode={needsCompletion ? "contained" : "outlined"}
                  compact
                  onPress={() => setMenuVisible(true)}
                  disabled={isCompleting}
                  loading={isCompleting}
                  icon="check"
                  style={styles.completeButton}
                >
                  Complete
                </Button>
              }
              anchorPosition="bottom"
            >
              <Menu.Item
                onPress={handleCompleteToday}
                title="Today"
                leadingIcon="calendar-today"
              />
              <Menu.Item
                onPress={handleCompleteYesterday}
                title="Yesterday"
                leadingIcon="calendar-arrow-left"
              />
              <Divider />
              <Menu.Item
                onPress={handleOpenDatePicker}
                title="Choose date..."
                leadingIcon="calendar"
              />
            </Menu>
          </View>
        </View>

        {/* Habit Graph */}
        <View style={styles.graphContainer}>
          {graphLoading && (
            <ActivityIndicator size="small" style={styles.graphSpinner} />
          )}
          {!graphLoading && graphData && (
            <HabitGraph
              miniGraph={graphData}
              onCellPress={handleGraphCellPress}
              nextRequiredDate={habitSummary?.nextRequiredInterval}
              windowSpecsStatus={habitStatus?.currentState?.windowSpecsStatus}
            />
          )}
        </View>
      </View>

      {/* Date picker - rendered outside Pressable to prevent touch conflicts */}
      {showDatePicker && Platform.OS !== "web" && (
        <DateTimePicker
          value={new Date()}
          mode="date"
          display="default"
          onChange={handleDateChange}
          maximumDate={new Date()}
        />
      )}

      {/* Web-specific date picker using Portal and Dialog */}
      {Platform.OS === "web" && (
        <Portal>
          <Dialog
            visible={showDatePicker}
            onDismiss={() => setShowDatePicker(false)}
          >
            <Dialog.Title>Choose Date</Dialog.Title>
            <Dialog.Content>
              <input
                type="date"
                max={formatLocalDate(new Date())}
                onChange={(e) => {
                  if (e.target.value) {
                    const selectedDate = new Date(e.target.value + "T00:00:00");
                    setShowDatePicker(false);
                    handleCompleteForDate(selectedDate);
                  }
                }}
                style={{
                  width: "100%",
                  padding: 12,
                  fontSize: 16,
                  borderRadius: 4,
                  border: "1px solid #ccc",
                }}
              />
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setShowDatePicker(false)}>Cancel</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      )}

      {/* Confirmation dialog for completing/uncompleting habit on a specific date */}
      <Portal>
        <Dialog
          visible={confirmEntry !== null}
          onDismiss={() => !isUncompleting && setConfirmEntry(null)}
        >
          <Dialog.Title>
            {confirmEntry?.completed ? "Remove Completion" : "Complete Habit"}
          </Dialog.Title>
          <Dialog.Content>
            <Text>
              {confirmEntry?.completed
                ? `Remove completion for "${todo.title}" on ${formattedConfirmDate}?`
                : `Mark "${todo.title}" as complete for ${formattedConfirmDate}?`}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setConfirmEntry(null)}
              disabled={isUncompleting}
            >
              Cancel
            </Button>
            {confirmEntry?.completed ? (
              <Button
                onPress={handleConfirmUncomplete}
                loading={isUncompleting}
                disabled={isUncompleting}
                textColor={theme.colors.error}
              >
                Remove
              </Button>
            ) : (
              <Button onPress={handleConfirmComplete}>Complete</Button>
            )}
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  editButton: {
    margin: 0,
    marginLeft: -8,
    marginRight: 4,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontWeight: "500",
  },
  nextRequiredRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  actionsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  completeButton: {
    minWidth: 100,
  },
  completedBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  graphContainer: {
    marginTop: 8,
    minHeight: 20,
  },
  graphSpinner: {
    alignSelf: "flex-start",
  },
});

export default HabitItem;
