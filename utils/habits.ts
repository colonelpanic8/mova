import { Todo } from "@/services/api";

/**
 * Whether a todo is a habit: either a window habit (org-window-habit) or a
 * standard org habit (STYLE property set to "habit").
 */
export function isHabitTodo(todo: Todo): boolean {
  return Boolean(todo.isWindowHabit || todo.properties?.STYLE === "habit");
}
