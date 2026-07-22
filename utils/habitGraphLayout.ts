/**
 * Shared layout math for habit graphs. The habits screen fetches habit
 * statuses with the same preceding/following window that HabitItem renders,
 * so both must derive the cell window from the same constants.
 */

// Layout constants
export const CELL_WIDTH = 24;
export const TODAY_CELL_EXTRA = 4; // Today cell is 28 instead of 24
export const CELL_GAP = 3;
export const GRAPH_OUTER_PADDING = 6;
export const ITEM_CONTAINER_PADDING = 12;

/**
 * Calculate how many habit-graph cells fit on screen and split them into
 * preceding (past, excluding today) and following (future) days.
 */
export function computeHabitGraphWindow(screenWidth: number): {
  preceding: number;
  following: number;
} {
  // Available width for cells after accounting for all padding
  const availableWidth =
    screenWidth - ITEM_CONTAINER_PADDING * 2 - GRAPH_OUTER_PADDING * 2;

  // Calculate max cells that fit (accounting for today's larger cell)
  // Each cell slot is cellWidth + gap, except last one doesn't need gap
  // Formula: n * CELL_WIDTH + (n-1) * CELL_GAP + TODAY_CELL_EXTRA <= availableWidth
  // Simplify: n * (CELL_WIDTH + CELL_GAP) - CELL_GAP + TODAY_CELL_EXTRA <= availableWidth
  // n <= (availableWidth + CELL_GAP - TODAY_CELL_EXTRA) / (CELL_WIDTH + CELL_GAP)
  const maxCells = Math.floor(
    (availableWidth + CELL_GAP - TODAY_CELL_EXTRA) / (CELL_WIDTH + CELL_GAP),
  );

  // Split cells evenly between past (including today) and future
  // Give slightly more to past since that's the primary view
  const pastCells = Math.ceil(maxCells / 2);
  const futureCells = Math.floor(maxCells / 2);

  // preceding is past cells minus today (which is always shown)
  // Cap at reasonable values to avoid overwhelming the server
  const preceding = Math.min(14, Math.max(1, pastCells - 1));
  const following = Math.min(14, Math.max(1, futureCells));

  return { preceding, following };
}
