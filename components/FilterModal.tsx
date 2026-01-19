import { DateRange, useFilters } from "@/context/FilterContext";
import { useTemplates } from "@/context/TemplatesContext";
import React, { useCallback } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import {
  ActivityIndicator,
  Divider,
  IconButton,
  Modal,
  Portal,
  Text,
  useTheme,
} from "react-native-paper";

interface FilterModalProps {
  visible: boolean;
  onDismiss: () => void;
}

interface FilterOptionProps {
  label: string;
  selected: boolean;
  excluded?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  testID?: string;
}

function FilterOption({ label, selected, excluded, onPress, onLongPress, testID }: FilterOptionProps) {
  const theme = useTheme();

  let backgroundColor = "transparent";
  let textColor = theme.colors.onSurface;
  let borderColor = theme.colors.outline;

  if (selected) {
    if (excluded) {
      backgroundColor = theme.colors.errorContainer;
      textColor = theme.colors.onErrorContainer;
      borderColor = theme.colors.error;
    } else {
      backgroundColor = theme.colors.primaryContainer;
      textColor = theme.colors.onPrimaryContainer;
      borderColor = theme.colors.primary;
    }
  }

  return (
    <TouchableOpacity
      testID={testID}
      style={[
        styles.option,
        { backgroundColor, borderColor },
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <Text style={{ color: textColor }}>
        {excluded ? `NOT ${label}` : label}
      </Text>
    </TouchableOpacity>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <Text variant="labelLarge" style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
        {title}
      </Text>
      <View style={styles.optionsGrid}>
        {children}
      </View>
    </View>
  );
}

export function FilterModal({ visible, onDismiss }: FilterModalProps) {
  const theme = useTheme();
  const { filterOptions, isLoading } = useTemplates();
  const {
    filters,
    addTagFilter,
    removeTagFilter,
    addStateFilter,
    removeStateFilter,
    addPriorityFilter,
    removePriorityFilter,
    setDateRangeFilter,
    addCategoryFilter,
    removeCategoryFilter,
  } = useFilters();

  const handleTagPress = useCallback((tag: string) => {
    if (filters.tags.include.includes(tag)) {
      removeTagFilter(tag);
    } else if (filters.tags.exclude.includes(tag)) {
      removeTagFilter(tag);
    } else {
      addTagFilter(tag, false);
    }
  }, [filters.tags, addTagFilter, removeTagFilter]);

  const handleTagLongPress = useCallback((tag: string) => {
    if (filters.tags.exclude.includes(tag)) {
      removeTagFilter(tag);
    } else {
      addTagFilter(tag, true);
    }
  }, [filters.tags.exclude, addTagFilter, removeTagFilter]);

  const handleStatePress = useCallback((state: string) => {
    if (filters.states.includes(state)) {
      removeStateFilter(state);
    } else {
      addStateFilter(state);
    }
  }, [filters.states, addStateFilter, removeStateFilter]);

  const handlePriorityPress = useCallback((priority: string) => {
    if (filters.priorities.includes(priority)) {
      removePriorityFilter(priority);
    } else {
      addPriorityFilter(priority);
    }
  }, [filters.priorities, addPriorityFilter, removePriorityFilter]);

  const handleDateRangePress = useCallback((range: DateRange) => {
    const currentRange = filters.dateRange;
    if (typeof currentRange === "string" && currentRange === range) {
      setDateRangeFilter(null);
    } else if (range === currentRange) {
      setDateRangeFilter(null);
    } else {
      setDateRangeFilter(range);
    }
  }, [filters.dateRange, setDateRangeFilter]);

  const handleCategoryPress = useCallback((category: string) => {
    if (filters.categories.includes(category)) {
      removeCategoryFilter(category);
    } else {
      addCategoryFilter(category);
    }
  }, [filters.categories, addCategoryFilter, removeCategoryFilter]);

  const isTagSelected = (tag: string) =>
    filters.tags.include.includes(tag) || filters.tags.exclude.includes(tag);

  const isTagExcluded = (tag: string) => filters.tags.exclude.includes(tag);

  const isDateRangeSelected = (range: string) => {
    return typeof filters.dateRange === "string" && filters.dateRange === range;
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.modal,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        <View style={styles.header}>
          <Text variant="titleLarge">Add Filter</Text>
          <IconButton
            icon="close"
            onPress={onDismiss}
            testID="filterModalClose"
          />
        </View>
        <Divider />

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator />
          </View>
        ) : (
          <ScrollView style={styles.scrollView}>
            {/* Tags Section */}
            {filterOptions?.tags && filterOptions.tags.length > 0 && (
              <Section title="Tags (long press to exclude)">
                {filterOptions.tags.map((tag) => (
                  <FilterOption
                    key={tag}
                    label={`:${tag}:`}
                    selected={isTagSelected(tag)}
                    excluded={isTagExcluded(tag)}
                    onPress={() => handleTagPress(tag)}
                    onLongPress={() => handleTagLongPress(tag)}
                    testID={`filterTag-${tag}`}
                  />
                ))}
              </Section>
            )}

            {/* TODO States Section */}
            {filterOptions?.todoStates && filterOptions.todoStates.length > 0 && (
              <Section title="TODO State">
                {filterOptions.todoStates.map((state) => (
                  <FilterOption
                    key={state}
                    label={state}
                    selected={filters.states.includes(state)}
                    onPress={() => handleStatePress(state)}
                    testID={`filterState-${state}`}
                  />
                ))}
              </Section>
            )}

            {/* Priority Section */}
            {filterOptions?.priorities && filterOptions.priorities.length > 0 && (
              <Section title="Priority">
                {filterOptions.priorities.map((priority) => (
                  <FilterOption
                    key={priority}
                    label={`[#${priority}]`}
                    selected={filters.priorities.includes(priority)}
                    onPress={() => handlePriorityPress(priority)}
                    testID={`filterPriority-${priority}`}
                  />
                ))}
              </Section>
            )}

            {/* Date Range Section */}
            <Section title="Date Range">
              <FilterOption
                label="Today"
                selected={isDateRangeSelected("today")}
                onPress={() => handleDateRangePress("today")}
                testID="filterDateToday"
              />
              <FilterOption
                label="This Week"
                selected={isDateRangeSelected("week")}
                onPress={() => handleDateRangePress("week")}
                testID="filterDateWeek"
              />
              <FilterOption
                label="Overdue"
                selected={isDateRangeSelected("overdue")}
                onPress={() => handleDateRangePress("overdue")}
                testID="filterDateOverdue"
              />
            </Section>

            {/* Category Section */}
            {filterOptions?.categories && filterOptions.categories.length > 0 && (
              <Section title="Category">
                {filterOptions.categories.map((category) => (
                  <FilterOption
                    key={category}
                    label={category}
                    selected={filters.categories.includes(category)}
                    onPress={() => handleCategoryPress(category)}
                    testID={`filterCategory-${category}`}
                  />
                ))}
              </Section>
            )}
          </ScrollView>
        )}
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    margin: 20,
    borderRadius: 12,
    maxHeight: "80%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingLeft: 20,
    paddingRight: 8,
    paddingVertical: 8,
  },
  scrollView: {
    padding: 16,
  },
  loading: {
    padding: 40,
    alignItems: "center",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    marginBottom: 8,
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  option: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
});
