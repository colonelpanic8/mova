/**
 * Color Palette Context
 *
 * Provides customizable colors for TODO states and action buttons.
 * Supports both theme-referenced colors (adapt to light/dark) and custom hex colors.
 */

import {
  ActionButtonType,
  ColorPaletteConfig,
  ColorValue,
  DEFAULT_COLOR_PALETTE,
  generateRandomColor,
  getThemeColorKey,
  HabitColorConfig,
  isThemeReference,
  PriorityLevel,
} from "@/types/colors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useTheme } from "react-native-paper";

const STORAGE_KEY = "mova_color_palette";

interface ColorPaletteContextType {
  // Raw configuration
  config: ColorPaletteConfig;
  isLoading: boolean;

  // Resolved color getters (resolve theme references to actual colors)
  getTodoStateColor: (keyword: string) => string;
  getActionColor: (action: ActionButtonType) => string;
  getPriorityColor: (priority: PriorityLevel) => string;
  getHabitColors: () => { conforming: string; notConforming: string };

  // Get all configured todo states (for settings UI)
  getConfiguredTodoStates: () => string[];

  // Updaters
  setTodoStateColor: (keyword: string, color: ColorValue) => Promise<void>;
  removeTodoStateColor: (keyword: string) => Promise<void>;
  setActionColor: (
    action: ActionButtonType,
    color: ColorValue,
  ) => Promise<void>;
  setPriorityColor: (
    priority: PriorityLevel,
    color: ColorValue,
  ) => Promise<void>;
  setHabitColor: (
    key: keyof HabitColorConfig,
    color: ColorValue,
  ) => Promise<void>;
  randomizeTodoStateColors: (states: string[]) => Promise<void>;
  resetToDefaults: () => Promise<void>;
}

const ColorPaletteContext = createContext<ColorPaletteContextType | undefined>(
  undefined,
);

export function ColorPaletteProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ColorPaletteConfig>(
    DEFAULT_COLOR_PALETTE,
  );
  const [isLoading, setIsLoading] = useState(true);
  const theme = useTheme();

  // Load saved configuration on mount
  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ColorPaletteConfig;
        // Merge with defaults to handle new fields in updates
        setConfig({
          ...DEFAULT_COLOR_PALETTE,
          ...parsed,
          todoStateColors: {
            ...DEFAULT_COLOR_PALETTE.todoStateColors,
            ...parsed.todoStateColors,
          },
          actionColors: {
            ...DEFAULT_COLOR_PALETTE.actionColors,
            ...parsed.actionColors,
          },
          priorityColors: {
            ...DEFAULT_COLOR_PALETTE.priorityColors,
            ...parsed.priorityColors,
          },
          habitColors: {
            ...DEFAULT_COLOR_PALETTE.habitColors,
            ...parsed.habitColors,
          },
        });
      }
    } catch (error) {
      console.error("Failed to load color palette:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function saveConfig(newConfig: ColorPaletteConfig) {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
      setConfig(newConfig);
    } catch (error) {
      console.error("Failed to save color palette:", error);
      throw error;
    }
  }

  // Resolve a color value (handles theme references)
  const resolveColor = useCallback(
    (colorValue: ColorValue): string => {
      if (isThemeReference(colorValue)) {
        const key = getThemeColorKey(colorValue);
        if (key && key in theme.colors) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (theme.colors as any)[key] || colorValue;
        }
      }
      return colorValue;
    },
    [theme],
  );

  const getTodoStateColor = useCallback(
    (keyword: string): string => {
      if (!keyword) {
        return resolveColor(
          config.todoStateColors["DEFAULT"] ||
            DEFAULT_COLOR_PALETTE.todoStateColors["DEFAULT"],
        );
      }
      const upperKeyword = keyword.toUpperCase();
      const colorValue =
        config.todoStateColors[upperKeyword] ||
        config.todoStateColors["DEFAULT"] ||
        DEFAULT_COLOR_PALETTE.todoStateColors["DEFAULT"];
      return resolveColor(colorValue);
    },
    [config, resolveColor],
  );

  const getActionColor = useCallback(
    (action: ActionButtonType): string => {
      return resolveColor(config.actionColors[action]);
    },
    [config, resolveColor],
  );

  const getPriorityColor = useCallback(
    (priority: PriorityLevel): string => {
      return resolveColor(config.priorityColors[priority]);
    },
    [config, resolveColor],
  );

  const getHabitColors = useCallback((): {
    conforming: string;
    notConforming: string;
  } => {
    return {
      conforming: resolveColor(config.habitColors.conforming),
      notConforming: resolveColor(config.habitColors.notConforming),
    };
  }, [config, resolveColor]);

  const getConfiguredTodoStates = useCallback((): string[] => {
    return Object.keys(config.todoStateColors).filter(
      (key) => key !== "DEFAULT",
    );
  }, [config]);

  const setTodoStateColor = useCallback(
    async (keyword: string, color: ColorValue) => {
      const newConfig = {
        ...config,
        todoStateColors: {
          ...config.todoStateColors,
          [keyword.toUpperCase()]: color,
        },
      };
      await saveConfig(newConfig);
    },
    [config],
  );

  const removeTodoStateColor = useCallback(
    async (keyword: string) => {
      const upperKeyword = keyword.toUpperCase();
      // Don't allow removing DEFAULT
      if (upperKeyword === "DEFAULT") {
        return;
      }
      const { [upperKeyword]: _, ...rest } = config.todoStateColors;
      const newConfig = {
        ...config,
        todoStateColors: rest,
      };
      await saveConfig(newConfig);
    },
    [config],
  );

  const setActionColor = useCallback(
    async (action: ActionButtonType, color: ColorValue) => {
      const newConfig = {
        ...config,
        actionColors: {
          ...config.actionColors,
          [action]: color,
        },
      };
      await saveConfig(newConfig);
    },
    [config],
  );

  const setPriorityColor = useCallback(
    async (priority: PriorityLevel, color: ColorValue) => {
      const newConfig = {
        ...config,
        priorityColors: {
          ...config.priorityColors,
          [priority]: color,
        },
      };
      await saveConfig(newConfig);
    },
    [config],
  );

  const setHabitColor = useCallback(
    async (key: keyof HabitColorConfig, color: ColorValue) => {
      const newConfig = {
        ...config,
        habitColors: {
          ...config.habitColors,
          [key]: color,
        },
      };
      await saveConfig(newConfig);
    },
    [config],
  );

  const randomizeTodoStateColors = useCallback(
    async (states: string[]) => {
      const newTodoStateColors = { ...config.todoStateColors };
      for (const state of states) {
        const upperState = state.toUpperCase();
        if (upperState !== "DEFAULT") {
          newTodoStateColors[upperState] = generateRandomColor();
        }
      }
      const newConfig = {
        ...config,
        todoStateColors: newTodoStateColors,
      };
      await saveConfig(newConfig);
    },
    [config],
  );

  const resetToDefaults = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setConfig(DEFAULT_COLOR_PALETTE);
  }, []);

  return (
    <ColorPaletteContext.Provider
      value={{
        config,
        isLoading,
        getTodoStateColor,
        getActionColor,
        getPriorityColor,
        getHabitColors,
        getConfiguredTodoStates,
        setTodoStateColor,
        removeTodoStateColor,
        setActionColor,
        setPriorityColor,
        setHabitColor,
        randomizeTodoStateColors,
        resetToDefaults,
      }}
    >
      {children}
    </ColorPaletteContext.Provider>
  );
}

export function useColorPalette() {
  const context = useContext(ColorPaletteContext);
  if (context === undefined) {
    throw new Error(
      "useColorPalette must be used within a ColorPaletteProvider",
    );
  }
  return context;
}
