import { HabitItem } from "@/components/HabitItem";
import { TodoItem } from "@/components/TodoItem";
import { AgendaEntry, HabitStatus } from "@/services/api";
import { isHabitTodo } from "@/utils/habits";
import { getTodoKey } from "@/utils/todoKey";
import {
  RefreshControl,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon, Text, useTheme } from "react-native-paper";

/** Pseudo-item marking the start of a category group in the list. */
export interface CategoryHeader {
  type: "category-header";
  category: string;
  count: number;
  color: string;
}

export type AgendaListItem = AgendaEntry | CategoryHeader;

export interface AgendaListSection {
  key: string;
  title?: string;
  data: AgendaListItem[];
}

/**
 * Interleave category header pseudo-items into a list of entries (sorted by
 * category name), omitting the items of collapsed categories. Returns the
 * items unchanged when grouping is disabled.
 */
export function groupItemsByCategory(
  items: AgendaEntry[],
  options: {
    groupByCategory: boolean;
    collapsedCategories: Set<string>;
    getCategoryColor: (category: string) => string;
  },
): AgendaListItem[] {
  const { groupByCategory, collapsedCategories, getCategoryColor } = options;
  if (!groupByCategory) return items;

  const categoryMap = new Map<string, AgendaEntry[]>();
  items.forEach((item) => {
    const category = item.effectiveCategory || "Uncategorized";
    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }
    categoryMap.get(category)!.push(item);
  });

  const result: AgendaListItem[] = [];
  Array.from(categoryMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([category, categoryItems]) => {
      result.push({
        type: "category-header",
        category,
        count: categoryItems.length,
        color: getCategoryColor(category),
      });
      const categoryKey = `category:${category}`;
      if (!collapsedCategories.has(categoryKey)) {
        result.push(...categoryItems);
      }
    });

  return result;
}

interface CategoryHeaderRowProps {
  item: CategoryHeader;
  isCollapsed: boolean;
  onToggle: () => void;
}

/** Collapsible category group header row (when group-by-category is on). */
function CategoryHeaderRow({
  item,
  isCollapsed,
  onToggle,
}: CategoryHeaderRowProps) {
  const theme = useTheme();

  return (
    <TouchableOpacity
      onPress={onToggle}
      style={[
        styles.categoryHeader,
        {
          borderLeftColor: item.color,
          backgroundColor: theme.colors.surface,
        },
      ]}
      testID={`categoryHeader-${item.category}`}
    >
      <View style={styles.categoryHeaderLeft}>
        <Icon
          source={isCollapsed ? "chevron-right" : "chevron-down"}
          size={20}
          color={theme.colors.onSurface}
        />
        <Text
          style={[styles.categoryHeaderText, { color: theme.colors.onSurface }]}
        >
          {item.category}
        </Text>
      </View>
      <Text
        style={[
          styles.categoryHeaderCount,
          { color: theme.colors.onSurfaceVariant },
        ]}
      >
        {item.count}
      </Text>
    </TouchableOpacity>
  );
}

interface AgendaListProps {
  sections: AgendaListSection[];
  habitStatusMap: Map<string, HabitStatus>;
  collapsedCategories: Set<string>;
  onToggleCategory: (categoryKey: string) => void;
  refreshing: boolean;
  onRefresh: () => void;
}

/**
 * The single-day list view: a SectionList of active (and optionally
 * completed) entries, with collapsible category header rows when grouping by
 * category is enabled.
 */
export function AgendaList({
  sections,
  habitStatusMap,
  collapsedCategories,
  onToggleCategory,
  refreshing,
  onRefresh,
}: AgendaListProps) {
  const theme = useTheme();

  return (
    <SectionList<AgendaListItem>
      testID="agendaList"
      sections={sections}
      keyExtractor={(item) =>
        "type" in item && item.type === "category-header"
          ? `header-${item.category}`
          : getTodoKey(item as AgendaEntry)
      }
      renderItem={({ item, section }) => {
        // Handle category headers
        if ("type" in item && item.type === "category-header") {
          const categoryKey = `category:${item.category}`;
          return (
            <CategoryHeaderRow
              item={item}
              isCollapsed={collapsedCategories.has(categoryKey)}
              onToggle={() => onToggleCategory(categoryKey)}
            />
          );
        }

        // Handle regular items
        const todoItem = item as AgendaEntry;
        if (isHabitTodo(todoItem)) {
          return (
            <HabitItem
              todo={todoItem}
              habitStatus={
                todoItem.id ? habitStatusMap.get(todoItem.id) : undefined
              }
            />
          );
        }
        return (
          <TodoItem
            todo={todoItem}
            opacity={section.key === "completed" ? 0.6 : 1}
          />
        );
      }}
      renderSectionHeader={({ section }) =>
        section.title ? (
          <View
            style={[
              styles.sectionHeader,
              {
                backgroundColor: theme.colors.background,
                borderBottomColor: theme.colors.outlineVariant,
              },
            ]}
          >
            <Text variant="labelMedium" style={{ color: theme.colors.outline }}>
              {section.title}
            </Text>
          </View>
        ) : null
      }
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      stickySectionHeadersEnabled={false}
    />
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderLeftWidth: 4,
  },
  categoryHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  categoryHeaderText: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 4,
  },
  categoryHeaderCount: {
    fontSize: 12,
  },
});
