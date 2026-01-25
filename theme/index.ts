/**
 * App theme configuration
 *
 * Customizes react-native-paper's MD3 theme with app-specific styling.
 * This controls the look and feel of all Paper components.
 */

import { MD3DarkTheme, MD3LightTheme } from "react-native-paper";

/**
 * Roundness value for buttons and other interactive elements.
 * Lower values = more squircle/squared, higher values = more rounded/pill.
 * Default MD3 is 20. We use 6 for a subtle squircle look.
 */
const BUTTON_ROUNDNESS = 6;

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
