/**
 * The reader's theme: dark or light. Starlight's key and rule: `starlight-theme` holds a theme only
 * while it differs from the system's colour scheme; with nothing saved the page follows the
 * system, live. `ThemeProvider.astro` applies the same rule inline before first paint, and this
 * module changes it afterwards: the header's settings panel has a "Dark theme" switch.
 */

/** The `localStorage` key. `ThemeProvider.astro` reads the same key inline. */
export const THEME_KEY = "starlight-theme";

export type Theme = "light" | "dark";

const LIGHT_QUERY = "(prefers-color-scheme: light)";

function systemTheme(): Theme {
  return matchMedia(LIGHT_QUERY).matches ? "light" : "dark";
}

function savedTheme(): Theme | undefined {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" ? value : undefined;
  } catch {
    return undefined;
  }
}

/** The theme the page shows: the saved one, or the system's. */
export function readTheme(): Theme {
  return savedTheme() ?? systemTheme();
}

/** Show `theme`, and save it only while it differs from the system's. */
export function writeTheme(theme: Theme): void {
  try {
    if (theme === systemTheme()) localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage blocked: the choice lasts for this page only.
  }
  document.documentElement.dataset.theme = theme;
}

/**
 * Wire a "Dark theme" switch: it shows the theme, writes the reader's change, and follows the
 * system's scheme (with nothing saved) and another tab's choice.
 */
export function mountThemeSwitch(
  input: HTMLInputElement,
  signal: AbortSignal,
): void {
  const show = (): void => {
    const theme = readTheme();
    document.documentElement.dataset.theme = theme;
    input.checked = theme === "dark";
  };
  input.checked = readTheme() === "dark";
  input.addEventListener(
    "change",
    () => writeTheme(input.checked ? "dark" : "light"),
    { signal },
  );
  matchMedia(LIGHT_QUERY).addEventListener(
    "change",
    () => {
      if (savedTheme() === undefined) show();
    },
    { signal },
  );
  window.addEventListener(
    "storage",
    (event) => {
      if (event.key === THEME_KEY || event.key === null) show();
    },
    { signal },
  );
}
