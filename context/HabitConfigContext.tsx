import { useTemplates } from "@/context/TemplatesContext";
import { HabitConfig } from "@/services/api";
import { DEFAULT_HABIT_COLORS, HabitColors } from "@/utils/habitColors";
import React, { createContext, ReactNode, useContext } from "react";

interface HabitConfigContextType {
  config: HabitConfig | null;
  isLoading: boolean;
  error: string | null;
  colors: HabitColors;
  glyphs: {
    completionNeededToday: string;
    completed: string;
  };
  refetch: () => Promise<void>;
}

const DEFAULT_GLYPHS = {
  completionNeededToday: "\u2610", // ☐
  completed: "\u2713", // ✓
};

const HabitConfigContext = createContext<HabitConfigContextType | undefined>(
  undefined,
);

export function HabitConfigProvider({ children }: { children: ReactNode }) {
  // Get habitConfig from TemplatesContext (loaded via /metadata endpoint)
  const { habitConfig, isLoading, error, reloadTemplates } = useTemplates();

  const colors: HabitColors = habitConfig?.colors
    ? {
        conforming: habitConfig.colors.conforming,
        notConforming: habitConfig.colors.notConforming,
      }
    : DEFAULT_HABIT_COLORS;

  const glyphs = habitConfig?.display
    ? {
        completionNeededToday: habitConfig.display.completionNeededTodayGlyph,
        completed: habitConfig.display.completedGlyph,
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
