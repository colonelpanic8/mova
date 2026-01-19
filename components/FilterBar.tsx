import { FilterChip } from "@/components/FilterChip";
import { useFilters } from "@/context/FilterContext";
import React, { useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Icon, Text, useTheme } from "react-native-paper";
import { FilterModal } from "./FilterModal";

interface FilterBarProps {
  testID?: string;
}

export function FilterBar({ testID }: FilterBarProps) {
  const theme = useTheme();
  const { activeFilters, hasActiveFilters, removeFilter, clearAllFilters } = useFilters();
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <>
      <View
        testID={testID}
        style={[styles.container, { borderBottomColor: theme.colors.outlineVariant }]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <TouchableOpacity
            testID="filterAddButton"
            style={[styles.addButton, { backgroundColor: theme.colors.primaryContainer }]}
            onPress={() => setModalVisible(true)}
          >
            <Icon source="plus" size={16} color={theme.colors.onPrimaryContainer} />
            <Text style={[styles.addButtonText, { color: theme.colors.onPrimaryContainer }]}>
              Filter
            </Text>
          </TouchableOpacity>

          {activeFilters.map((filter, index) => (
            <FilterChip
              key={`${filter.type}-${filter.value}-${filter.exclude ? "exclude" : "include"}-${index}`}
              filter={filter}
              onRemove={() => removeFilter(filter)}
            />
          ))}

          {hasActiveFilters && (
            <TouchableOpacity
              testID="filterClearAllButton"
              style={styles.clearButton}
              onPress={clearAllFilters}
            >
              <Text style={{ color: theme.colors.error }}>Clear All</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      <FilterModal
        visible={modalVisible}
        onDismiss={() => setModalVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scrollContent: {
    paddingHorizontal: 12,
    alignItems: "center",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
  },
  addButtonText: {
    fontSize: 13,
    marginLeft: 4,
    fontWeight: "500",
  },
  clearButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
});
