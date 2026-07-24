import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { IconButton, Menu, Text, useTheme } from "react-native-paper";

export type AgendaViewMode = "list" | "schedule" | "multiday";

interface AgendaHeaderProps {
  /** Formatted date (single day) or date range (multi-day) for the title. */
  dateLabel: string;
  /** Whether the selected date is today (hides the "Go to Today" link). */
  isToday: boolean;
  showCompleted: boolean;
  viewMode: AgendaViewMode;
  refreshing: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onShowDatePicker: () => void;
  onToggleShowCompleted: () => void;
  onSelectViewMode: (mode: AgendaViewMode) => void;
  onRefresh: () => void;
}

/**
 * The agenda screen header: date navigation row (previous/next, date picker
 * trigger, completed toggle, view-mode menu, refresh) plus the "Go to Today"
 * link when the selected date isn't today.
 */
export function AgendaHeader({
  dateLabel,
  isToday,
  showCompleted,
  viewMode,
  refreshing,
  onPrevious,
  onNext,
  onToday,
  onShowDatePicker,
  onToggleShowCompleted,
  onSelectViewMode,
  onRefresh,
}: AgendaHeaderProps) {
  const theme = useTheme();
  const [viewModeMenuVisible, setViewModeMenuVisible] = useState(false);

  const getViewModeIcon = () => {
    if (viewMode === "list") return "view-list";
    if (viewMode === "schedule") return "clock-outline";
    return "calendar-range";
  };

  const selectViewMode = (mode: AgendaViewMode) => {
    onSelectViewMode(mode);
    setViewModeMenuVisible(false);
  };

  return (
    <View
      style={[
        styles.header,
        { borderBottomColor: theme.colors.outlineVariant },
      ]}
    >
      <View style={styles.dateNavigation}>
        <IconButton
          icon="chevron-left"
          onPress={onPrevious}
          testID="agendaPrevDay"
        />
        <TouchableOpacity
          onPress={onShowDatePicker}
          style={styles.dateButton}
          testID="agendaDateButton"
        >
          <Text
            testID="agendaDateHeader"
            variant="titleMedium"
            style={styles.dateText}
          >
            {dateLabel}
          </Text>
        </TouchableOpacity>
        <IconButton
          icon="chevron-right"
          onPress={onNext}
          testID="agendaNextDay"
        />
        <IconButton
          icon={showCompleted ? "check-circle" : "check-circle-outline"}
          onPress={onToggleShowCompleted}
          testID="agendaShowCompletedToggle"
        />
        <Menu
          visible={viewModeMenuVisible}
          onDismiss={() => setViewModeMenuVisible(false)}
          anchor={
            <IconButton
              icon={getViewModeIcon()}
              onPress={() => setViewModeMenuVisible(true)}
              testID="agendaViewModeToggle"
            />
          }
        >
          <Menu.Item
            leadingIcon="view-list"
            onPress={() => selectViewMode("list")}
            title="List"
            testID="viewModeList"
          />
          <Menu.Item
            leadingIcon="clock-outline"
            onPress={() => selectViewMode("schedule")}
            title="Schedule"
            testID="viewModeSchedule"
          />
          <Menu.Item
            leadingIcon="calendar-range"
            onPress={() => selectViewMode("multiday")}
            title="Multi-day"
            testID="viewModeMultiday"
          />
        </Menu>
        <IconButton
          icon="refresh"
          onPress={onRefresh}
          disabled={refreshing}
          testID="agendaRefreshButton"
        />
      </View>
      {!isToday && (
        <TouchableOpacity
          onPress={onToday}
          style={styles.todayButton}
          testID="agendaTodayButton"
        >
          <Text style={{ color: theme.colors.primary }}>Go to Today</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
  },
  dateNavigation: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  dateButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
  },
  dateText: {
    textAlign: "center",
  },
  todayButton: {
    alignItems: "center",
    paddingVertical: 8,
  },
});
