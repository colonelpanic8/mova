import { useColorPalette } from "@/context/ColorPaletteContext";
import { useTodoEditingContext } from "@/hooks/useTodoEditing";
import { Repeater, Todo } from "@/services/api";
import { PriorityLevel } from "@/types/colors";
import React, { useCallback, useEffect, useRef } from "react";
import { Pressable, StyleSheet, TouchableOpacity, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Chip, Icon, Text, useTheme } from "react-native-paper";

function formatRepeater(repeater: Repeater): string {
  const unitLabels: Record<string, string> = {
    d: "day",
    w: "week",
    m: "month",
    y: "year",
  };
  const plural = repeater.value !== 1 ? "s" : "";
  return `${repeater.value} ${unitLabels[repeater.unit] || repeater.unit}${plural}`;
}

export interface TodoItemProps {
  todo: Todo & { completedAt?: string | null };
  opacity?: number;
}

function formatDate(dateString: string): string {
  const hasTime = dateString.includes("T") && dateString.includes(":");
  // Parse date-only strings as local time to avoid timezone shift
  const date = hasTime
    ? new Date(dateString)
    : new Date(dateString + "T00:00:00");
  if (hasTime) {
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatCompletedAt(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getTodoKey(todo: Todo): string {
  return todo.id || `${todo.file}:${todo.pos}:${todo.title}`;
}

export function TodoItem({ todo, opacity = 1 }: TodoItemProps) {
  const theme = useTheme();
  const { getTodoStateColor, getActionColor, getPriorityColor } =
    useColorPalette();
  const {
    completingIds,
    updatingIds,
    swipeableRefs,
    handleTodoPress,
    scheduleToday,
    scheduleTomorrow,
    openScheduleModal,
    openDeadlineModal,
    openPriorityModal,
    openRemindModal,
    openBodyEditor,
    openSwipeable,
  } = useTodoEditingContext();

  const internalRef = useRef<Swipeable>(null);
  const key = getTodoKey(todo);
  const isCompleting = completingIds.has(key);
  const isUpdating = updatingIds.has(key);

  // Register ref with the context's ref map
  useEffect(() => {
    const refs = swipeableRefs.current;
    if (internalRef.current) {
      refs.set(key, internalRef.current);
    }
    return () => {
      refs.delete(key);
    };
  }, [key, swipeableRefs]);

  const onTodoChipPress = useCallback(() => {
    handleTodoPress(todo);
  }, [handleTodoPress, todo]);

  const handleBodyPress = useCallback(() => {
    // Open this swipeable (closes any others)
    openSwipeable(key);
  }, [openSwipeable, key]);

  // Close all other swipeables when this one starts to open (from swiping)
  const handleSwipeableWillOpen = useCallback(() => {
    swipeableRefs.current.forEach((swipeable, refKey) => {
      if (refKey !== key) {
        swipeable.close();
      }
    });
  }, [key, swipeableRefs]);

  // Create a unique suffix for testIDs based on todo title (sanitized for testID)
  const testIdSuffix = todo.title
    .replace(/[^a-zA-Z0-9]/g, "_")
    .substring(0, 20);

  const renderRightActions = useCallback(() => {
    return (
      <View style={styles.swipeActions}>
        <TouchableOpacity
          testID={`bodyActionButton_${testIdSuffix}`}
          style={[
            styles.swipeAction,
            { backgroundColor: theme.colors.secondary },
          ]}
          onPress={() => openBodyEditor(todo)}
        >
          <Text style={styles.swipeActionText}>Body</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID={`tomorrowActionButton_${testIdSuffix}`}
          style={[
            styles.swipeAction,
            { backgroundColor: getActionColor("tomorrow") },
          ]}
          onPress={() => scheduleTomorrow(todo)}
        >
          <Text style={styles.swipeActionText}>Tomorrow</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID={`scheduleActionButton_${testIdSuffix}`}
          style={[
            styles.swipeAction,
            { backgroundColor: getActionColor("schedule") },
          ]}
          onPress={() => openScheduleModal(todo)}
        >
          <Text style={styles.swipeActionText}>Schedule</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID={`deadlineActionButton_${testIdSuffix}`}
          style={[
            styles.swipeAction,
            { backgroundColor: getActionColor("deadline") },
          ]}
          onPress={() => openDeadlineModal(todo)}
        >
          <Text style={styles.swipeActionText}>Deadline</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID={`todayActionButton_${testIdSuffix}`}
          style={[
            styles.swipeAction,
            { backgroundColor: getActionColor("today") },
          ]}
          onPress={() => scheduleToday(todo)}
        >
          <Text style={styles.swipeActionText}>Today</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID={`remindActionButton_${testIdSuffix}`}
          style={[
            styles.swipeAction,
            { backgroundColor: theme.colors.tertiary },
          ]}
          onPress={() => openRemindModal(todo)}
        >
          <Text style={styles.swipeActionText}>Remind</Text>
        </TouchableOpacity>
      </View>
    );
  }, [
    testIdSuffix,
    getActionColor,
    theme.colors.tertiary,
    theme.colors.secondary,
    todo,
    scheduleToday,
    scheduleTomorrow,
    openScheduleModal,
    openDeadlineModal,
    openRemindModal,
    openBodyEditor,
  ]);

  return (
    <Swipeable
      ref={internalRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      onSwipeableWillOpen={handleSwipeableWillOpen}
    >
      <Pressable onPress={handleBodyPress}>
        <View
          style={[
            styles.todoItem,
            {
              borderBottomColor: theme.colors.outlineVariant,
              backgroundColor: theme.colors.background,
              opacity: isUpdating ? 0.6 : opacity,
            },
          ]}
        >
          <View style={styles.todoHeader}>
            {todo.todo && (
              <Chip
                mode="flat"
                compact
                onPress={isCompleting ? undefined : onTodoChipPress}
                style={[
                  styles.todoChip,
                  { backgroundColor: getTodoStateColor(todo.todo) },
                  isCompleting && styles.todoChipLoading,
                ]}
                textStyle={{ fontSize: 10, color: "white" }}
              >
                {isCompleting ? "..." : todo.todo}
              </Chip>
            )}
            {todo.priority && todo.priority.trim() && (
              <Chip
                mode="flat"
                compact
                onPress={() => openPriorityModal(todo)}
                style={[
                  styles.priorityChip,
                  ["A", "B", "C", "D", "E"].includes(
                    todo.priority.toUpperCase(),
                  )
                    ? {
                        backgroundColor: getPriorityColor(
                          todo.priority.toUpperCase() as PriorityLevel,
                        ),
                      }
                    : { backgroundColor: theme.colors.surfaceVariant },
                ]}
                textStyle={{
                  fontSize: 10,
                  color: ["A", "B", "C", "D", "E"].includes(
                    todo.priority.toUpperCase(),
                  )
                    ? "white"
                    : theme.colors.onSurfaceVariant,
                }}
              >
                #{todo.priority}
              </Chip>
            )}
            <Text
              variant="bodyMedium"
              style={styles.todoTitle}
              numberOfLines={2}
            >
              {todo.title}
            </Text>
          </View>
          {(todo.scheduled || todo.deadline || todo.completedAt || (todo.tags && todo.tags.length > 0)) && (
            <View style={styles.metaRow}>
              <View style={styles.metaLeft}>
                {todo.scheduled && (
                  <View style={styles.metaItem}>
                    <Text style={[styles.metaText, { color: theme.colors.primary }]}>
                      S: {formatDate(todo.scheduled)}
                    </Text>
                    {todo.scheduledRepeater && (
                      <View style={styles.repeaterBadge}>
                        <Icon
                          source="repeat"
                          size={12}
                          color={theme.colors.primary}
                        />
                        <Text
                          style={[
                            styles.repeaterText,
                            { color: theme.colors.primary },
                          ]}
                        >
                          {formatRepeater(todo.scheduledRepeater)}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
                {todo.deadline && (
                  <View style={styles.metaItem}>
                    <Text style={[styles.metaText, { color: theme.colors.error }]}>
                      D: {formatDate(todo.deadline)}
                    </Text>
                    {todo.deadlineRepeater && (
                      <View style={styles.repeaterBadge}>
                        <Icon
                          source="repeat"
                          size={12}
                          color={theme.colors.error}
                        />
                        <Text
                          style={[
                            styles.repeaterText,
                            { color: theme.colors.error },
                          ]}
                        >
                          {formatRepeater(todo.deadlineRepeater)}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
                {todo.completedAt && (
                  <View style={styles.metaItem}>
                    <Text style={[styles.metaText, { color: theme.colors.outline }]}>
                      Completed at {formatCompletedAt(todo.completedAt)}
                    </Text>
                  </View>
                )}
              </View>
              {todo.tags && todo.tags.length > 0 && (
                <View style={styles.tagsContainer}>
                  {todo.tags.map((tag, i) => (
                    <Text
                      key={i}
                      style={[styles.tag, { color: theme.colors.primary }]}
                    >
                      :{tag}:
                    </Text>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      </Pressable>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  todoItem: {
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  todoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  todoChip: {
    minHeight: 24,
    justifyContent: "center",
  },
  todoChipLoading: {
    opacity: 0.6,
  },
  priorityChip: {
    minHeight: 24,
    justifyContent: "center",
  },
  todoTitle: {
    flex: 1,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  metaLeft: {
    flexDirection: "row",
    gap: 12,
    flexShrink: 1,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 11,
  },
  repeaterBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  repeaterText: {
    fontSize: 10,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 4,
    marginLeft: 8,
    flexShrink: 0,
  },
  tag: {
    fontSize: 12,
    fontFamily: "monospace",
  },
  swipeActions: {
    flexDirection: "row",
    alignItems: "stretch",
    width: "100%",
    paddingHorizontal: 4,
  },
  swipeAction: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 4,
    marginHorizontal: 2,
    borderRadius: 10,
  },
  swipeActionText: {
    color: "white",
    fontSize: 11,
    fontWeight: "600",
  },
});

export default TodoItem;
