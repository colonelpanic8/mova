/**
 * Color utility functions
 */

/**
 * Parse a hex color string to RGB values
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // Remove # if present
  const cleanHex = hex.replace(/^#/, "");

  // Handle shorthand (#RGB) and full (#RRGGBB) formats
  let fullHex = cleanHex;
  if (cleanHex.length === 3) {
    fullHex = cleanHex
      .split("")
      .map((c) => c + c)
      .join("");
  }

  if (fullHex.length !== 6) {
    return null;
  }

  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Calculate relative luminance of a color
 * Based on WCAG 2.0 formula
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const sRGB = c / 255;
    return sRGB <= 0.03928
      ? sRGB / 12.92
      : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Determine if a color is light or dark based on luminance
 */
export function isLightColor(color: string): boolean {
  const rgb = hexToRgb(color);
  if (!rgb) {
    // Default to assuming light if we can't parse
    return true;
  }
  const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
  return luminance > 0.179; // Threshold for WCAG AA contrast
}

/**
 * Get a contrasting text color (black or white) for a given background color
 */
export function getContrastColor(backgroundColor: string): string {
  return isLightColor(backgroundColor) ? "#000000" : "#FFFFFF";
}

/**
 * Lighten or darken a color by a percentage
 * @param color Hex color string
 * @param percent Positive to lighten, negative to darken (-100 to 100)
 */
export function adjustColorBrightness(color: string, percent: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) {
    return color;
  }

  const adjust = (value: number) => {
    const delta = percent > 0 ? (255 - value) * (percent / 100) : value * (percent / 100);
    return Math.round(Math.min(255, Math.max(0, value + delta)));
  };

  const r = adjust(rgb.r);
  const g = adjust(rgb.g);
  const b = adjust(rgb.b);

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
