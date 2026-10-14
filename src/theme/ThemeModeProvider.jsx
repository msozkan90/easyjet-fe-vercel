"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { THEME_MODES } from "@/theme/tokens";
import { THEME_STORAGE_KEY } from "@/theme/themeScript";

const ThemeModeContext = createContext({
  mode: THEME_MODES.LIGHT,
  setMode: () => {},
  toggleMode: () => {},
});

const readStoredMode = () => {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === THEME_MODES.DARK ? THEME_MODES.DARK : THEME_MODES.LIGHT;
  } catch {
    return THEME_MODES.LIGHT;
  }
};

/**
 * Holds the light/dark preference, persists it in localStorage and mirrors it
 * on <html data-theme>. The server always renders light; the inline script in
 * the root layout applies a stored dark preference before first paint.
 */
export function ThemeModeProvider({ children }) {
  // null until the stored preference is read, so the first effect pass
  // does not overwrite what the inline init script already applied.
  const [storedMode, setModeState] = useState(null);
  const mode = storedMode ?? THEME_MODES.LIGHT;

  useEffect(() => {
    setModeState(readStoredMode());
  }, []);

  useEffect(() => {
    if (storedMode === null) return;
    document.documentElement.dataset.theme = storedMode;
    document.documentElement.style.colorScheme = storedMode;
  }, [storedMode]);

  const setMode = useCallback((next) => {
    const value =
      next === THEME_MODES.DARK ? THEME_MODES.DARK : THEME_MODES.LIGHT;
    setModeState(value);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, value);
    } catch {
      // Storage can be unavailable (private mode); the choice still applies.
    }
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === THEME_MODES.DARK ? THEME_MODES.LIGHT : THEME_MODES.DARK);
  }, [mode, setMode]);

  const value = useMemo(
    () => ({ mode, setMode, toggleMode }),
    [mode, setMode, toggleMode],
  );

  return (
    <ThemeModeContext.Provider value={value}>
      {children}
    </ThemeModeContext.Provider>
  );
}

export const useThemeMode = () => useContext(ThemeModeContext);
