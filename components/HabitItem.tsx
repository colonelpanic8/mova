import { HabitGraph } from "@/components/HabitGraph";
import { useApi } from "@/context/ApiContext";
import { useSettings } from "@/context/SettingsContext";
import { useTemplates } from "@/context/TemplatesContext";
import { useTodoEditingContext } from "@/hooks/useTodoEditing";
import { HabitStatusGraphEntry, MiniGraphEntry, Todo } from "@/services/api";
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
}

// Cell sizing constants (must match HabitGraph styles)
const CELL_WIDTH = 24;
const CELL_GAP = 3;
const GRAPH_PADDING = 6; // outerContainer padding
const ITEM_PADDING = 12; // HabitItem container padding

// Default maximums
const MAX_PRECEDING = 14;
const MAX_FOLLOWING = 5;

function calculateCellCount(screenWidth: number): {
  preceding: number;
  following: number;
} {
  // Available width for cells: screen - item padding (both sides) - graph padding (both sides)
  const availableWidth = screenWidth - ITEM_PADDING * 2 - GRAPH_PADDING * 2;

  // How many cells fit: (availableWidth + gap) / (cellWidth + gap)
  // We add gap because gaps are between cells, not after the last one
  const cellsFit = Math.floor((availableWidth + CELL_GAP) / (CELL_WIDTH + CELL_GAP));

  // Cap at the maximum total (14 + 5 = 19)
  const totalMax = MAX_PRECEDING + MAX_FOLLOWING;
  const totalCells = Math.min(cellsFit, totalMax);

  // Allocate to preceding and following, prioritizing preceding
  // Keep the same ratio: 14:5 ~= 74% preceding, 26% following
  const following = Math.min(MAX_FOLLOWING, Math.floor(totalCells * 0.26));
  const preceding = Math.min(MAX_PRECEDING, totalCells - following);

  return { preceding, following };
}

export function HabitItem({ todo }: HabitItemProps) {
  const theme = useTheme();
  const router = useRouter();
  const api = useApi();
  const { quickComplete, completingIds } = useTodoEditingContext();
  const { defaultDoneState } = useSettings();
  const { todoStates } = useTemplates();
  const { width: screenWidth } = useWindowDimensions();

  const [menuVisible, setMenuVisible] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [graphData, setGraphData] = useState<MiniGraphEntry[] | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [confirmEntry, setConfirmEntry] = useState<MiniGraphEntry | null>(null);
  const [isUncompleting, setIsUncompleting] = useState(false);

  const key = todo.id || `${todo.file}:${todo.pos}:${todo.title}`;
  const isCompleting = completingIds.has(key);
  const wasCompletingRef = useRef(false);

  // Calculate how many cells fit in the display
  const { preceding, following } = useMemo(
    () => calculateCellCount(screenWidth),
    [screenWidth],
  );

  // Fetch habit status for graph data
  const fetchGraphData = useCallback(() => {
    if (!todo.id || !api) return;

    setGraphLoading(true);
    api
      .getHabitStatus(todo.id, preceding, following)
      .then((status) => {
        if (status.graph) {
          setGraphData(transformGraphData(status.graph));
        }
      })
      .catch((err: Error) => {
        console.error("Failed to fetch habit status:", err);
      })
      .finally(() => {
        setGraphLoading(false);
      });
  }, [todo.id, api, preceding, following]);

  // Initial fetch
  useEffect(() => {
    fetchGraphData();
  }, [fetchGraphData]);

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
