import { DateRange, FilterState } from "@/context/FilterContext";
import { Todo } from "@/services/api";

function formatDateForComparison(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getEndOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() + (6 - day);
  d.setDate(diff);
  d.setHours(23, 59, 59, 999);
  return d;
}

function matchesDateRange(todo: Todo, dateRange: DateRange): boolean {
  if (!dateRange) return true;

  const scheduledDate = todo.scheduled ? todo.scheduled.split("T")[0] : null;
  const deadlineDate = todo.deadline ? todo.deadline.split("T")[0] : null;
  const todoDate = scheduledDate || deadlineDate;

  if (!todoDate) {
    // No date on the todo - only show if filtering for "overdue"
    return false;
  }

  const today = formatDateForComparison(new Date());

  if (dateRange === "today") {
    return todoDate === today;
  }

  if (dateRange === "overdue") {
    return todoDate < today;
  }

  if (dateRange === "week") {
    const now = new Date();
    const startOfWeek = formatDateForComparison(getStartOfWeek(now));
    const endOfWeek = formatDateForComparison(getEndOfWeek(now));
    return todoDate >= startOfWeek && todoDate <= endOfWeek;
  }

  // Custom date range
  if (typeof dateRange === "object" && dateRange !== null) {
    const { start, end } = dateRange;
    if (start && end) {
      const startStr = formatDateForComparison(start);
      const endStr = formatDateForComparison(end);
      return todoDate >= startStr && todoDate <= endStr;
    }
    if (start) {
      return todoDate >= formatDateForComparison(start);
    }
    if (end) {
      return todoDate <= formatDateForComparison(end);
    }
  }

  return true;
}

export function filterTodos<T extends Todo>(
  todos: T[],
  filters: FilterState,
): T[] {
  // If no filters active, return all todos
  const hasActiveFilters =
    filters.tags.include.length > 0 ||
    filters.tags.exclude.length > 0 ||
    filters.states.length > 0 ||
    filters.priorities.length > 0 ||
    filters.dateRange !== null ||
    filters.files.length > 0 ||
    filters.categories.length > 0 ||
    !filters.showHabits;

  if (!hasActiveFilters) {
    return todos;
  }

  return todos.filter((todo) => {
    // Filter out habits if showHabits is false
    if (!filters.showHabits && todo.isWindowHabit) {
      return false;
    }

    // Tag include filter: todo must have at least one of the included tags
    if (filters.tags.include.length > 0) {
      const todoTags = todo.tags || [];
      const hasIncludedTag = filters.tags.include.some((tag) =>
        todoTags.includes(tag),
      );
      if (!hasIncludedTag) return false;
    }

    // Tag exclude filter: todo must not have any of the excluded tags
    if (filters.tags.exclude.length > 0) {
      const todoTags = todo.tags || [];
      const hasExcludedTag = filters.tags.exclude.some((tag) =>
        todoTags.includes(tag),
      );
      if (hasExcludedTag) return false;
    }

    // State filter: todo state must be one of the selected states
    if (filters.states.length > 0) {
      if (!filters.states.includes(todo.todo)) return false;
    }

    // Priority filter: todo priority must be one of the selected priorities
    if (filters.priorities.length > 0) {
      if (!todo.priority || !filters.priorities.includes(todo.priority))
        return false;
    }

    // Date range filter
    if (filters.dateRange !== null) {
      if (!matchesDateRange(todo, filters.dateRange)) return false;
    }

    // File filter: todo file must match one of the selected files
    if (filters.files.length > 0) {
      if (!todo.file || !filters.files.some((f) => todo.file?.includes(f)))
        return false;
    }

    // Category filter
    // Note: We need to extract category from file path or use a category field if available
    // For now, match on file path containing the category
    if (filters.categories.length > 0) {
      // Categories might be stored differently - for now, check if file path contains category
      const todoFile = todo.file || "";
      const matchesCategory = filters.categories.some((cat) =>
        todoFile.toLowerCase().includes(cat.toLowerCase()),
      );
      if (!matchesCategory) return false;
    }

    return true;
  });
}
