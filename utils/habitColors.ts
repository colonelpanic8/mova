/**
 * Linearly interpolate between two hex colors.
 * @param color1 Starting hex color (e.g., "#ff0000")
 * @param color2 Ending hex color (e.g., "#00ff00")
 * @param ratio Value between 0 and 1 (0 = color1, 1 = color2)
 * @returns Interpolated hex color
 */
export function lerpColor(
  color1: string,
  color2: string,
  ratio: number,
): string {
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);

  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);

  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const b = Math.round(b1 + (b2 - b1) * ratio);

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export interface HabitColors {
  conforming: string;
  notConforming: string;
}

export const DEFAULT_HABIT_COLORS: HabitColors = {
  conforming: "#9B4DB8", // Mova purple
  notConforming: "#E57373", // Soft coral red
};

/**
 * Get the background color for a habit graph cell based on conforming ratio.
 * @param conformingRatio Value between 0 and 1
 * @param colors Habit color configuration
 * @returns Hex color string
 */
export function getHabitCellColor(
  conformingRatio: number,
  colors: HabitColors = DEFAULT_HABIT_COLORS,
): string {
  const clampedRatio = Math.max(0, Math.min(1, conformingRatio));
  return lerpColor(colors.notConforming, colors.conforming, clampedRatio);
}
