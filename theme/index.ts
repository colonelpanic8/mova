/**
 * App theme configuration
 *
 * Customizes react-native-paper's MD3 theme with app-specific styling.
 * This controls the look and feel of all Paper components.
 */

import { MD3DarkTheme, MD3LightTheme } from "react-native-paper";

/**
 * Roundness value for buttons and other interactive elements.
 * In MD3, actual border radius = roundness * 5.
 * Default MD3 roundness is 4 (= 20px radius).
 * We use 2 for a subtle squircle look (= 10px radius).
 */
const BUTTON_ROUNDNESS = 2;

export const lightTheme = {
  ...MD3LightTheme,
  roundness: BUTTON_ROUNDNESS,
};

export const darkTheme = {
  ...MD3DarkTheme,
  roundness: BUTTON_ROUNDNESS,
};

export function getTheme(colorScheme: "light" | "dark" | null | undefined) {
  return colorScheme === "dark" ? darkTheme : lightTheme;
}
