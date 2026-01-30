// utils/categoryColors.ts

export const CATEGORY_COLOR_PALETTE = [
  "#4A90D9", // blue
  "#50C878", // green
  "#E57373", // red
  "#FFB74D", // orange
  "#9575CD", // purple
  "#4DB6AC", // teal
  "#F06292", // pink
  "#7986CB", // indigo
  "#AED581", // light green
  "#FFD54F", // amber
];

export function getAutoColorForCategory(category: string): string {
  const hash = category
    .toLowerCase()
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return CATEGORY_COLOR_PALETTE[hash % CATEGORY_COLOR_PALETTE.length];
}
