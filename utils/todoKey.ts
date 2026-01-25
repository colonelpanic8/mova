import { Todo } from "@/services/api";

/**
 * Generate a unique key for a Todo item.
 * Uses the org-id if available, otherwise falls back to file:pos:title
 */
export function getTodoKey(todo: Todo): string {
  return todo.id || `${todo.file}:${todo.pos}:${todo.title}`;
}
