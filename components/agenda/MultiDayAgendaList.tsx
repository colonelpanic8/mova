import { TodoItem } from "@/components/TodoItem";
import { Todo } from "@/services/api";
import { MultiDaySectionItem } from "@/utils/habitAgenda";
import { isHabitTodo } from "@/utils/habits";
import { getTodoKey } from "@/utils/todoKey";
import { RefreshControl, SectionList, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

interface MultiDayAgendaListProps {
  sections: MultiDaySectionItem[];
  doneStates: string[];
  /** Habit completion check for a given date (graph/miniGraph resolution). */
  isHabitCompletedOnDate: (entry: Todo, dateString: string) => boolean;
  refreshing: boolean;
  onRefresh: () => void;
}

/**
 * The multi-day view: one sticky section per day, with completed items
 * rendered dimmed.
 */
export function MultiDayAgendaList({
  sections,
  doneStates,
  isHabitCompletedOnDate,
  refreshing,
  onRefresh,
}: MultiDayAgendaListProps) {
  const theme = useTheme();

  return (
    <SectionList
      testID="multiDayList"
      sections={sections}
      keyExtractor={(item) => getTodoKey(item)}
      renderItem={({ item, section }) => {
        const completed = isHabitTodo(item)
          ? isHabitCompletedOnDate(item, section.dateString)
          : item.completedAt || doneStates.includes(item.todo);
        return <TodoItem todo={item} opacity={completed ? 0.6 : 1} />;
      }}
      renderSectionHeader={({ section }) => (
        <View
          style={[
            styles.multiDaySectionHeader,
            {
              backgroundColor: section.isToday
                ? theme.colors.primaryContainer
                : theme.colors.surfaceVariant,
            },
          ]}
        >
          <Text
            variant="titleSmall"
            style={{
              color: section.isToday
                ? theme.colors.onPrimaryContainer
                : theme.colors.onSurfaceVariant,
              fontWeight: section.isToday ? "bold" : "normal",
            }}
          >
            {section.title}
            {section.isToday && " (Today)"}
          </Text>
          <Text
            variant="labelSmall"
            style={{
              color: section.isToday
                ? theme.colors.onPrimaryContainer
                : theme.colors.outline,
            }}
          >
            {section.data.length} item
            {section.data.length !== 1 && "s"}
          </Text>
        </View>
      )}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      stickySectionHeadersEnabled={true}
    />
  );
}

const styles = StyleSheet.create({
  multiDaySectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
});
