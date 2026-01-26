import { useColorPalette } from "@/context/ColorPaletteContext";
import { useTemplates } from "@/context/TemplatesContext";
import { HabitConfig } from "@/services/api";
import { HabitColors } from "@/utils/habitColors";
import React, { createContext, ReactNode, useContext } from "react";

interface HabitConfigContextType {
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
}

const DEFAULT_GLYPHS = {
  completionNeededToday: "\u2610", // ☐
  completed: "\u2713", // ✓
  nextRequired: "\u25B6", // ▶
};

const HabitConfigContext = createContext<HabitConfigContextType | undefined>(
  undefined,
);

export function HabitConfigProvider({ children }: { children: ReactNode }) {
  // Get habitConfig from TemplatesContext (loaded via /metadata endpoint)
  const { habitConfig, isLoading, error, reloadTemplates } = useTemplates();
  // Get colors from ColorPalette (user-customizable)
  const { getHabitColors } = useColorPalette();

  // Priority: 1) User settings from ColorPalette, 2) Server config, 3) defaults (in ColorPalette)
  // ColorPalette already handles defaults, so we just use it directly
  // Server config could override user settings if needed, but for now user settings take precedence
  const colors: HabitColors = getHabitColors();

  const glyphs = habitConfig?.display
    ? {
        completionNeededToday: habitConfig.display.completionNeededTodayGlyph,
        completed: habitConfig.display.completedGlyph,
        nextRequired: DEFAULT_GLYPHS.nextRequired,
      }
    : DEFAULT_GLYPHS;

  return (
    <HabitConfigContext.Provider
      value={{
        config: habitConfig,
        isLoading,
        error,
        colors,
        glyphs,
        refetch: reloadTemplates,
      }}
    >
      {children}
    </HabitConfigContext.Provider>
  );
}

export function useHabitConfig(): HabitConfigContextType {
  const context = useContext(HabitConfigContext);
  if (context === undefined) {
    throw new Error("useHabitConfig must be used within a HabitConfigProvider");
  }
  return context;
}
