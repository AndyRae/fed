import { theme } from "../core/theme.ts";

/** Formats a numeric hex colour (as used by theme.ts / three.js) as a CSS hex string. */
export function hexToCssColor(hex: number): string {
  return `#${hex.toString(16).padStart(6, "0")}`;
}

/**
 * Flattens theme.ts into CSS custom properties, so the exact same colour
 * values that drive the three.js materials also drive the HUD's CSS — one
 * source of truth in practice, not just in intent. See core/theme.ts.
 */
export function themeCssVariables(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [groupName, group] of Object.entries(theme)) {
    for (const [colorName, hex] of Object.entries(group)) {
      vars[`--fsa-${groupName}-${colorName}`] = hexToCssColor(hex);
    }
  }
  return vars;
}

/** Applies themeCssVariables() to the document root. Call once at startup. */
export function applyThemeCssVariables(): void {
  const vars = themeCssVariables();
  for (const [name, value] of Object.entries(vars)) {
    document.documentElement.style.setProperty(name, value);
  }
}
