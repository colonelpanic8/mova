import { ActiveFilter, FilterType } from "@/context/FilterContext";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Icon, Text, useTheme } from "react-native-paper";

interface FilterChipProps {
  filter: ActiveFilter;
  onRemove: () => void;
}

function getFilterLabel(filter: ActiveFilter): string {
  switch (filter.type) {
    case "tag":
      return filter.exclude ? `NOT :${filter.value}:` : `:${filter.value}:`;
    case "state":
      return filter.value;
    case "priority":
      return `[#${filter.value}]`;
    case "dateRange":
      switch (filter.value) {
        case "today":
          return "Today";
        case "week":
          return "This Week";
        case "overdue":
          return "Overdue";
        case "custom":
          return "Custom Range";
        default:
          return filter.value;
      }
    case "file":
      // Show just the filename, not the full path
      const parts = filter.value.split("/");
      return parts[parts.length - 1];
    case "category":
      return filter.value;
    default:
      return filter.value;
  }
}

function getChipColor(type: FilterType, theme: ReturnType<typeof useTheme>): string {
  switch (type) {
    case "tag":
      return theme.colors.primaryContainer;
    case "state":
      return theme.colors.secondaryContainer;
    case "priority":
      return theme.colors.tertiaryContainer;
    case "dateRange":
      return theme.colors.errorContainer;
    case "file":
    case "category":
      return theme.colors.surfaceVariant;
    default:
      return theme.colors.surfaceVariant;
  }
}

function getChipTextColor(type: FilterType, theme: ReturnType<typeof useTheme>): string {
  switch (type) {
    case "tag":
      return theme.colors.onPrimaryContainer;
    case "state":
      return theme.colors.onSecondaryContainer;
    case "priority":
      return theme.colors.onTertiaryContainer;
    case "dateRange":
      return theme.colors.onErrorContainer;
    case "file":
    case "category":
      return theme.colors.onSurfaceVariant;
    default:
      return theme.colors.onSurfaceVariant;
  }
}

export function FilterChip({ filter, onRemove }: FilterChipProps) {
  const theme = useTheme();
  const backgroundColor = getChipColor(filter.type, theme);
  const textColor = getChipTextColor(filter.type, theme);
  const label = getFilterLabel(filter);

  return (
    <View style={[styles.chip, { backgroundColor }]}>
      <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>
        {label}
      </Text>
      <TouchableOpacity
        onPress={onRemove}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
        testID={`filterChipRemove-${filter.type}-${filter.value}`}
      >
        <Icon source="close" size={16} color={textColor} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: 16,
    marginRight: 8,
    maxWidth: 150,
  },
  label: {
    fontSize: 13,
    marginRight: 4,
  },
});
