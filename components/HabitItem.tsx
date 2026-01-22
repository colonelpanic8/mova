import { TodoItem } from "@/components/TodoItem";
import { useSettings } from "@/context/SettingsContext";
import { useTemplates } from "@/context/TemplatesContext";
import { useTodoEditingContext } from "@/hooks/useTodoEditing";
import { Todo } from "@/services/api";
import React, { useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Button, useTheme } from "react-native-paper";

export interface HabitItemProps {
  todo: Todo;
}

export function HabitItem({ todo }: HabitItemProps) {
  const theme = useTheme();
  const { quickComplete, completingIds } = useTodoEditingContext();
  const { defaultDoneState } = useSettings();
  const { todoStates } = useTemplates();

  // Compute effective default done state
  const effectiveDoneState = useMemo(() => {
    if (defaultDoneState) return defaultDoneState;
    if (!todoStates?.done?.length) return "DONE";
    return todoStates.done.includes("DONE") ? "DONE" : todoStates.done[0];
  }, [defaultDoneState, todoStates]);

  const key = todo.id || `${todo.file}:${todo.pos}:${todo.title}`;
  const isCompleting = completingIds.has(key);

  const handleCompleteToday = useCallback(() => {
    quickComplete(todo, effectiveDoneState, new Date());
  }, [todo, effectiveDoneState, quickComplete]);

  const handleCompleteYesterday = useCallback(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    quickComplete(todo, effectiveDoneState, yesterday);
  }, [todo, effectiveDoneState, quickComplete]);

  // Only show quick buttons if habit needs completion today
  const needsCompletion = todo.habitSummary?.completionNeededToday;

  return (
    <View>
      <TodoItem todo={todo} />
      {needsCompletion && (
        <View
          style={[
            styles.quickButtons,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
        >
          <Button
            mode="contained-tonal"
            compact
            onPress={handleCompleteYesterday}
            disabled={isCompleting}
            icon="calendar-minus"
            style={styles.quickButton}
          >
            Yesterday
          </Button>
          <Button
            mode="contained"
            compact
            onPress={handleCompleteToday}
            disabled={isCompleting}
            loading={isCompleting}
            icon="check"
            style={styles.quickButton}
          >
            Complete Today
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  quickButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  quickButton: {
    minWidth: 100,
  },
});

export default HabitItem;
