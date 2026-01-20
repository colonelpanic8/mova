import { api, HabitConfig } from "@/services/api";
import { DEFAULT_HABIT_COLORS, HabitColors } from "@/utils/habitColors";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

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
  undefined
);

export function HabitConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<HabitConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.getHabitConfig();
      setConfig(result);
    } catch (err) {
      console.error("Failed to fetch habit config:", err);
      setError("Failed to load habit configuration");
      // Set default config so app still works
      setConfig({ status: "ok", enabled: false });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const colors: HabitColors = config?.colors
    ? {
        conforming: config.colors.conforming,
        notConforming: config.colors.notConforming,
      }
    : DEFAULT_HABIT_COLORS;

  const glyphs = config?.display
    ? {
        completionNeededToday: config.display.completionNeededTodayGlyph,
        completed: config.display.completedGlyph,
      }
    : DEFAULT_GLYPHS;

  return (
    <HabitConfigContext.Provider
      value={{
        config,
        isLoading,
        error,
        colors,
        glyphs,
        refetch: fetchConfig,
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
