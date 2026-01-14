import { useColorPalette } from "@/context/ColorPaletteContext";
import { Todo } from "@/services/api";
import React, { forwardRef, useCallback } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Chip, Text, useTheme } from "react-native-paper";

export interface TodoItemProps {
  todo: Todo;
  isCompleting?: boolean;
  isUpdating?: boolean;
  onTodoPress?: (todo: Todo) => void;
  onTomorrowPress?: (todo: Todo) => void;
  onSchedulePress?: (todo: Todo) => void;
  onDeadlinePress?: (todo: Todo) => void;
  onPriorityPress?: (todo: Todo) => void;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const hasTime = dateString.includes("T") && dateString.includes(":");
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

export function getTodoKey(todo: Todo): string {
  return todo.id || `${todo.file}:${todo.pos}:${todo.title}`;
}

export const TodoItem = forwardRef<Swipeable, TodoItemProps>(function TodoItem(
  {
    todo,
    isCompleting,
    isUpdating,
    onTodoPress,
    onTomorrowPress,
    onSchedulePress,
    onDeadlinePress,
    onPriorityPress,
  },
  ref,
) {
  const theme = useTheme();
  const { getTodoStateColor, getActionColor } = useColorPalette();

  const handleTodoPress = useCallback(() => {
    onTodoPress?.(todo);
  }, [onTodoPress, todo]);

  const renderRightActions = useCallback(() => {
    if (
      !onTomorrowPress &&
      !onSchedulePress &&
      !onDeadlinePress &&
      !onPriorityPress
    ) {
      return null;
    }

    // Create a unique suffix for testIDs based on todo title (sanitized for testID)
    const testIdSuffix = todo.title
      .replace(/[^a-zA-Z0-9]/g, "_")
      .substring(0, 20);

    return (
      <View style={styles.swipeActions}>
        {onTomorrowPress && (
          <TouchableOpacity
            testID={`tomorrowActionButton_${testIdSuffix}`}
            style={[
              styles.swipeAction,
              { backgroundColor: getActionColor("tomorrow") },
            ]}
            onPress={() => onTomorrowPress(todo)}
          >
            <Text style={styles.swipeActionText}>Tomorrow</Text>
          </TouchableOpacity>
        )}
        {onSchedulePress && (
          <TouchableOpacity
            testID={`scheduleActionButton_${testIdSuffix}`}
            style={[
              styles.swipeAction,
              { backgroundColor: getActionColor("schedule") },
            ]}
            onPress={() => onSchedulePress(todo)}
          >
            <Text style={styles.swipeActionText}>Schedule</Text>
          </TouchableOpacity>
        )}
        {onDeadlinePress && (
          <TouchableOpacity
            testID={`deadlineActionButton_${testIdSuffix}`}
            style={[
              styles.swipeAction,
              { backgroundColor: getActionColor("deadline") },
            ]}
            onPress={() => onDeadlinePress(todo)}
          >
            <Text style={styles.swipeActionText}>Deadline</Text>
          </TouchableOpacity>
        )}
        {onPriorityPress && (
          <TouchableOpacity
            testID={`priorityActionButton_${testIdSuffix}`}
            style={[
              styles.swipeAction,
              { backgroundColor: getActionColor("priority") },
            ]}
            onPress={() => onPriorityPress(todo)}
          >
            <Text style={styles.swipeActionText}>Priority</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [
    onTomorrowPress,
    onSchedulePress,
    onDeadlinePress,
    onPriorityPress,
    getActionColor,
    todo,
  ]);

  const hasSwipeActions =
    onTomorrowPress || onSchedulePress || onDeadlinePress || onPriorityPress;

  const content = (
    <View
      style={[
        styles.todoItem,
        {
          borderBottomColor: theme.colors.outlineVariant,
          backgroundColor: theme.colors.background,
          opacity: isUpdating ? 0.6 : 1,
        },
      ]}
    >
      <View style={styles.todoHeader}>
        {todo.todo && (
          <TouchableOpacity
            onPress={handleTodoPress}
            disabled={isCompleting || !onTodoPress}
            activeOpacity={0.7}
          >
            <Chip
              mode="flat"
              compact
              style={[
                styles.todoChip,
                { backgroundColor: getTodoStateColor(todo.todo) },
                isCompleting && styles.todoChipLoading,
              ]}
              textStyle={{ fontSize: 10, color: "white" }}
            >
              {isCompleting ? "..." : todo.todo}
            </Chip>
          </TouchableOpacity>
        )}
        {todo.priority && todo.priority.trim() && (
          <Chip
            mode="outlined"
            compact
            style={styles.priorityChip}
            textStyle={{ fontSize: 10 }}
          >
            #{todo.priority}
          </Chip>
        )}
        <Text variant="bodyMedium" style={styles.todoTitle} numberOfLines={2}>
          {todo.title}
        </Text>
      </View>
      <View style={styles.metaRow}>
        {todo.scheduled && (
          <Text style={[styles.metaText, { color: theme.colors.primary }]}>
            S: {formatDate(todo.scheduled)}
          </Text>
        )}
        {todo.deadline && (
          <Text style={[styles.metaText, { color: theme.colors.error }]}>
            D: {formatDate(todo.deadline)}
          </Text>
        )}
      </View>
      {todo.tags && todo.tags.length > 0 && (
        <View style={styles.tagsContainer}>
          {todo.tags.map((tag, i) => (
            <Text key={i} style={[styles.tag, { color: theme.colors.primary }]}>
              :{tag}:
            </Text>
          ))}
        </View>
      )}
    </View>
  );

  if (hasSwipeActions) {
    return (
      <Swipeable
        ref={ref}
        renderRightActions={renderRightActions}
        overshootRight={false}
      >
        {content}
      </Swipeable>
    );
  }

  return content;
});

const styles = StyleSheet.create({
  todoItem: {
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  todoHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
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
    height: 20,
  },
  todoTitle: {
    flex: 1,
  },
  metaRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  metaText: {
    fontSize: 11,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
    gap: 4,
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
