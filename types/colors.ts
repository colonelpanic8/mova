/**
 * Color palette type definitions and defaults.
 *
 * Supports both theme-referenced colors (e.g., 'theme:primary') that adapt
 * to light/dark mode, and custom hex colors (e.g., '#FF5722').
 */

// Core color value - supports both preset hex colors and theme references
export type ColorValue = string;

// Theme color reference type
export type ThemeColorKey =
  | "primary"
  | "secondary"
  | "tertiary"
  | "error"
  | "outline"
  | "background"
  | "surface"
  | "onSurface"
  | "onPrimary"
  | "onSecondary"
  | "onTertiary"
  | "onError";

// Preset palette colors (16 curated Material Design colors)
export const PRESET_COLORS = [
  "#F44336", // Red
  "#E91E63", // Pink
  "#9C27B0", // Purple
  "#673AB7", // Deep Purple
  "#3F51B5", // Indigo
  "#2196F3", // Blue
  "#03A9F4", // Light Blue
  "#00BCD4", // Cyan
  "#009688", // Teal
  "#4CAF50", // Green
  "#8BC34A", // Light Green
  "#CDDC39", // Lime
  "#FFEB3B", // Yellow
  "#FFC107", // Amber
  "#FF9800", // Orange
  "#FF5722", // Deep Orange
] as const;

// Action button types
export type ActionButtonType = "tomorrow" | "today" | "schedule" | "deadline";

// Priority levels
export type PriorityLevel = "A" | "B" | "C" | "D" | "E";

// Action button color configuration
export interface ActionButtonColorConfig {
  tomorrow: ColorValue;
  today: ColorValue;
  schedule: ColorValue;
  deadline: ColorValue;
}

// Priority color configuration
export interface PriorityColorConfig {
  A: ColorValue;
  B: ColorValue;
  C: ColorValue;
  D: ColorValue;
  E: ColorValue;
}

// Complete color palette configuration
export interface ColorPaletteConfig {
  // Map of todo keyword (uppercase) -> color
  todoStateColors: Record<string, ColorValue>;
  // Action button colors
  actionColors: ActionButtonColorConfig;
  // Priority colors (A, B, C)
  priorityColors: PriorityColorConfig;
  // Version for migration purposes
  version: number;
}

// Default color values (matching current behavior)
export const DEFAULT_COLOR_PALETTE: ColorPaletteConfig = {
  version: 2,
  todoStateColors: {
    TODO: "theme:error",
    NEXT: "theme:primary",
    DONE: "theme:outline",
    WAITING: "theme:tertiary",
    STARTED: "theme:primary",
    CANCELLED: "theme:outline",
    DEFAULT: "theme:secondary",
  },
  actionColors: {
    tomorrow: "theme:secondary",
    today: "theme:primary",
    schedule: "theme:tertiary",
    deadline: "theme:error",
  },
  priorityColors: {
    A: "theme:error",
    B: "#FF9800",
    C: "#FFC107",
    D: "#8BC34A",
    E: "theme:outline",
  },
};

// Theme color options for the color picker
export const THEME_COLOR_OPTIONS: {
  key: string;
  label: string;
  themeKey: ThemeColorKey;
}[] = [
  { key: "theme:primary", label: "Primary", themeKey: "primary" },
  { key: "theme:secondary", label: "Secondary", themeKey: "secondary" },
  { key: "theme:tertiary", label: "Tertiary", themeKey: "tertiary" },
  { key: "theme:error", label: "Error", themeKey: "error" },
  { key: "theme:outline", label: "Outline", themeKey: "outline" },
];

/**
 * Check if a color value is a theme reference
 */
export function isThemeReference(color: string): boolean {
  return color.startsWith("theme:");
}

/**
 * Extract the theme color key from a theme reference
 */
export function getThemeColorKey(ref: string): ThemeColorKey | null {
  if (!isThemeReference(ref)) {
    return null;
  }
  return ref.replace("theme:", "") as ThemeColorKey;
}

/**
 * Validate a hex color string
 */
export function isValidHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}
