import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";

export type DateRangePreset = "today" | "week" | "overdue";

export interface DateRangeCustom {
  start: Date | null;
  end: Date | null;
}

export type DateRange = DateRangePreset | DateRangeCustom | null;

export interface FilterState {
  tags: { include: string[]; exclude: string[] };
  states: string[];
  priorities: string[];
  dateRange: DateRange;
  files: string[];
  categories: string[];
}

export type FilterType = "tag" | "state" | "priority" | "dateRange" | "file" | "category";

export interface ActiveFilter {
  type: FilterType;
  value: string;
  exclude?: boolean; // For tags only
}

interface FilterContextType {
  filters: FilterState;
  activeFilters: ActiveFilter[];
  hasActiveFilters: boolean;
  addTagFilter: (tag: string, exclude?: boolean) => void;
  removeTagFilter: (tag: string) => void;
  addStateFilter: (state: string) => void;
  removeStateFilter: (state: string) => void;
  addPriorityFilter: (priority: string) => void;
  removePriorityFilter: (priority: string) => void;
  setDateRangeFilter: (range: DateRange) => void;
  addFileFilter: (file: string) => void;
  removeFileFilter: (file: string) => void;
  addCategoryFilter: (category: string) => void;
  removeCategoryFilter: (category: string) => void;
  removeFilter: (filter: ActiveFilter) => void;
  clearAllFilters: () => void;
}

const initialFilterState: FilterState = {
  tags: { include: [], exclude: [] },
  states: [],
  priorities: [],
  dateRange: null,
  files: [],
  categories: [],
};

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<FilterState>(initialFilterState);

  const addTagFilter = useCallback((tag: string, exclude = false) => {
    setFilters((prev) => {
      const key = exclude ? "exclude" : "include";
      const otherKey = exclude ? "include" : "exclude";
      if (prev.tags[key].includes(tag)) return prev;
      return {
        ...prev,
        tags: {
          ...prev.tags,
          [key]: [...prev.tags[key], tag],
          // Remove from other list if present
          [otherKey]: prev.tags[otherKey].filter((t) => t !== tag),
        },
      };
    });
  }, []);

  const removeTagFilter = useCallback((tag: string) => {
    setFilters((prev) => ({
      ...prev,
      tags: {
        include: prev.tags.include.filter((t) => t !== tag),
        exclude: prev.tags.exclude.filter((t) => t !== tag),
      },
    }));
  }, []);

  const addStateFilter = useCallback((state: string) => {
    setFilters((prev) => {
      if (prev.states.includes(state)) return prev;
      return { ...prev, states: [...prev.states, state] };
    });
  }, []);

  const removeStateFilter = useCallback((state: string) => {
    setFilters((prev) => ({
      ...prev,
      states: prev.states.filter((s) => s !== state),
    }));
  }, []);

  const addPriorityFilter = useCallback((priority: string) => {
    setFilters((prev) => {
      if (prev.priorities.includes(priority)) return prev;
      return { ...prev, priorities: [...prev.priorities, priority] };
    });
  }, []);

  const removePriorityFilter = useCallback((priority: string) => {
    setFilters((prev) => ({
      ...prev,
      priorities: prev.priorities.filter((p) => p !== priority),
    }));
  }, []);

  const setDateRangeFilter = useCallback((range: DateRange) => {
    setFilters((prev) => ({ ...prev, dateRange: range }));
  }, []);

  const addFileFilter = useCallback((file: string) => {
    setFilters((prev) => {
      if (prev.files.includes(file)) return prev;
      return { ...prev, files: [...prev.files, file] };
    });
  }, []);

  const removeFileFilter = useCallback((file: string) => {
    setFilters((prev) => ({
      ...prev,
      files: prev.files.filter((f) => f !== file),
    }));
  }, []);

  const addCategoryFilter = useCallback((category: string) => {
    setFilters((prev) => {
      if (prev.categories.includes(category)) return prev;
      return { ...prev, categories: [...prev.categories, category] };
    });
  }, []);

  const removeCategoryFilter = useCallback((category: string) => {
    setFilters((prev) => ({
      ...prev,
      categories: prev.categories.filter((c) => c !== category),
    }));
  }, []);

  const removeFilter = useCallback((filter: ActiveFilter) => {
    switch (filter.type) {
      case "tag":
        removeTagFilter(filter.value);
        break;
      case "state":
        removeStateFilter(filter.value);
        break;
      case "priority":
        removePriorityFilter(filter.value);
        break;
      case "dateRange":
        setDateRangeFilter(null);
        break;
      case "file":
        removeFileFilter(filter.value);
        break;
      case "category":
        removeCategoryFilter(filter.value);
        break;
    }
  }, [removeTagFilter, removeStateFilter, removePriorityFilter, setDateRangeFilter, removeFileFilter, removeCategoryFilter]);

  const clearAllFilters = useCallback(() => {
    setFilters(initialFilterState);
  }, []);

  // Compute active filters as a flat list for display
  const activeFilters: ActiveFilter[] = [
    ...filters.tags.include.map((tag) => ({ type: "tag" as const, value: tag })),
    ...filters.tags.exclude.map((tag) => ({ type: "tag" as const, value: tag, exclude: true })),
    ...filters.states.map((state) => ({ type: "state" as const, value: state })),
    ...filters.priorities.map((priority) => ({ type: "priority" as const, value: priority })),
    ...(filters.dateRange ? [{ type: "dateRange" as const, value: typeof filters.dateRange === "string" ? filters.dateRange : "custom" }] : []),
    ...filters.files.map((file) => ({ type: "file" as const, value: file })),
    ...filters.categories.map((category) => ({ type: "category" as const, value: category })),
  ];

  const hasActiveFilters = activeFilters.length > 0;

  return (
    <FilterContext.Provider
      value={{
        filters,
        activeFilters,
        hasActiveFilters,
        addTagFilter,
        removeTagFilter,
        addStateFilter,
        removeStateFilter,
        addPriorityFilter,
        removePriorityFilter,
        setDateRangeFilter,
        addFileFilter,
        removeFileFilter,
        addCategoryFilter,
        removeCategoryFilter,
        removeFilter,
        clearAllFilters,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters(): FilterContextType {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error("useFilters must be used within a FilterProvider");
  }
  return context;
}
