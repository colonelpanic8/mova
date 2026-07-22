import { useColorPalette } from "@/context/ColorPaletteContext";
import { useTemplates } from "@/context/TemplatesContext";
import { HabitConfig } from "@/services/api";
import { HabitColors } from "@/utils/habitColors";
import { useMemo } from "react";

interface HabitConfigValue {
  config: HabitConfig | null;
  isLoading: boolean;
  error: string | null;
  colors: HabitColors;
  glyphs: {
    completionNeededToday: string;
    completed: string;
    nextRequired: string;
  };
  refetch: () => Promise<void>;
  ensureFresh: () => Promise<void>;
}

const DEFAULT_GLYPHS = {
  completionNeededToday: "☐", // ☐
  completed: "✓", // ✓
  nextRequired: "☐", // ☐ (same as completionNeededToday - indicates where next repetition is needed)
};

/**
 * Habit configuration derived from TemplatesContext (server config loaded via
 * the /metadata endpoint) and ColorPaletteContext (user-customizable colors).
 */
export function useHabitConfig(): HabitConfigValue {
  const {
    habitConfig,
    isLoading,
    error,
    reloadTemplates,
    ensureFreshTemplates,
  } = useTemplates();
  // Priority: 1) User settings from ColorPalette, 2) Server config, 3) defaults (in ColorPalette)
  // ColorPalette already handles defaults, so we just use it directly
  // Server config could override user settings if needed, but for now user settings take precedence
  const { getHabitColors } = useColorPalette();

  return useMemo(() => {
    const glyphs = habitConfig?.display
      ? {
          completionNeededToday: habitConfig.display.completionNeededTodayGlyph,
          completed: habitConfig.display.completedGlyph,
          nextRequired: DEFAULT_GLYPHS.nextRequired,
        }
      : DEFAULT_GLYPHS;

    return {
      config: habitConfig,
      isLoading,
      error,
      colors: getHabitColors(),
      glyphs,
      refetch: reloadTemplates,
      ensureFresh: ensureFreshTemplates,
    };
  }, [
    habitConfig,
    isLoading,
    error,
    getHabitColors,
    reloadTemplates,
    ensureFreshTemplates,
  ]);
}
