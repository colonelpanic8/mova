import { HabitGraph } from "@/components/HabitGraph";
import { StatePill } from "@/components/StatePill";
import { useColorPalette } from "@/context/ColorPaletteContext";
import { useTodoEditingContext } from "@/hooks/useTodoEditing";
import { Todo } from "@/services/api";
import { PriorityLevel } from "@/types/colors";
import { formatRepeater } from "@/utils/repeaterFormatting";
import {
  formatCompletedAt,
  formatTimestampShort as formatTimestamp,
} from "@/utils/timeFormatting";
import { getTodoKey } from "@/utils/todoKey";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, TouchableOpacity, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import {
  Chip,
  Divider,
  Icon,
  IconButton,
  Menu,
  Text,
  useTheme,
} from "react-native-paper";

export { getTodoKey };

export interface TodoItemProps {
  todo: Todo & { completedAt?: string | null };
  opacity?: number;
}

export function TodoItem({ todo, opacity = 1 }: TodoItemProps) {
  const router = useRouter();
  const theme = useTheme();
  const { getActionColor, getPriorityColor } = useColorPalette();
  const {
    completingIds,
    updatingIds,
    deletingIds,
    swipeableRefs,
    handleTodoPress,
    scheduleToday,
    scheduleTomorrow,
    openScheduleModal,
    openDeadlineModal,
    openPriorityModal,
    openDeleteConfirm,
  } = useTodoEditingContext();

  const internalRef = useRef<Swipeable>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const key = getTodoKey(todo);
  const isCompleting = completingIds.has(key);
  const isUpdating = updatingIds.has(key);
  const isDeleting = deletingIds.has(key);

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

  const handlePress = useCallback(() => {
    router.push({
      pathname: "/edit",
      params: {
        todo: JSON.stringify(todo),
      },
    });
  }, [router, todo]);

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

  // Define actions once, used for both swipe and menu
  const quickActions = [
    {
      key: "today",
      label: "Today",
      icon: "calendar-today",
      colorKey: "today" as const,
      onPress: () => scheduleToday(todo),
    },
    {
      key: "tomorrow",
      label: "Tomorrow",
      icon: "calendar-arrow-right",
      colorKey: "tomorrow" as const,
      onPress: () => scheduleTomorrow(todo),
    },
    {
      key: "schedule",
      label: "Schedule",
      icon: "calendar",
      colorKey: "schedule" as const,
      onPress: () => openScheduleModal(todo),
    },
    {
      key: "deadline",
      label: "Deadline",
      icon: "calendar-clock",
      colorKey: "deadline" as const,
      onPress: () => openDeadlineModal(todo),
    },
    {
      key: "delete",
      label: "Delete",
      icon: "delete",
      color: theme.colors.error,
      onPress: () => openDeleteConfirm(todo),
      isDividerBefore: true,
    },
  ];

  const renderRightActions = useCallback(() => {
    return (
      <View style={styles.swipeActions}>
        {quickActions.map((action) => (
          <TouchableOpacity
            key={action.key}
            testID={`${action.key}ActionButton_${testIdSuffix}`}
            style={[
              styles.swipeAction,
              {
                backgroundColor:
                  action.color ?? getActionColor(action.colorKey!),
              },
            ]}
            onPress={action.onPress}
          >
            <Text style={styles.swipeActionText}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }, [testIdSuffix, getActionColor, quickActions]);

  return (
    <Swipeable
      ref={internalRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      onSwipeableWillOpen={handleSwipeableWillOpen}
    >
      <Pressable onPress={handlePress}>
        <View
          style={[
            styles.todoItem,
            {
              borderBottomColor: theme.colors.outlineVariant,
              backgroundColor: theme.colors.background,
              opacity: isUpdating || isDeleting ? 0.6 : opacity,
            },
          ]}
        >
          <View style={styles.todoHeader}>
            {todo.todo && (
              <StatePill
                state={todo.todo}
                selected={false}
                onPress={onTodoChipPress}
                loading={isCompleting}
              />
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
            <Menu
              visible={menuVisible}
              onDismiss={() => setMenuVisible(false)}
              anchor={
                <IconButton
                  icon="dots-vertical"
                  size={20}
                  onPress={() => setMenuVisible(true)}
                  style={styles.menuButton}
                />
              }
            >
              {quickActions.map((action) => (
                <React.Fragment key={action.key}>
                  {action.isDividerBefore && <Divider />}
                  <Menu.Item
                    onPress={() => {
                      setMenuVisible(false);
                      action.onPress();
                    }}
                    title={action.label}
                    leadingIcon={action.icon}
                    titleStyle={action.color ? { color: action.color } : undefined}
                  />
                </React.Fragment>
              ))}
            </Menu>
          </View>
          {(todo.scheduled ||
            todo.deadline ||
            todo.completedAt ||
            (todo.tags && todo.tags.length > 0)) && (
            <View style={styles.metaRow}>
              <View style={styles.metaLeft}>
                {todo.scheduled && (
                  <View style={styles.metaItem}>
                    <Text
                      style={[styles.metaText, { color: theme.colors.primary }]}
                    >
                      S: {formatTimestamp(todo.scheduled)}
                    </Text>
                    {todo.scheduled.repeater && (
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
                          {formatRepeater(todo.scheduled.repeater)}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
                {todo.deadline && (
                  <View style={styles.metaItem}>
                    <Text
                      style={[styles.metaText, { color: theme.colors.error }]}
                    >
                      D: {formatTimestamp(todo.deadline)}
                    </Text>
                    {todo.deadline.repeater && (
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
                          {formatRepeater(todo.deadline.repeater)}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
                {todo.completedAt && (
                  <View style={styles.metaItem}>
                    <Text
                      style={[styles.metaText, { color: theme.colors.outline }]}
                    >
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
          {/* Habit Graph */}
          {todo.isWindowHabit && todo.habitSummary?.miniGraph && (
            <HabitGraph miniGraph={todo.habitSummary.miniGraph} />
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
  priorityChip: {
    minHeight: 24,
    justifyContent: "center",
  },
  todoTitle: {
    flex: 1,
  },
  menuButton: {
    margin: 0,
    marginRight: -8,
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
