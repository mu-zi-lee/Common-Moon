import { useCallback, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";
const KEY = "coslog-theme";

function systemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(mode: ThemeMode) {
  const shouldDark = mode === "dark" || (mode === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", shouldDark);
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>("system");

  useEffect(() => {
    try {
      const stored = (localStorage.getItem(KEY) as ThemeMode | null) ?? "system";
      setMode(stored);
      applyTheme(stored);
    } catch {
      /* ignore */
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      try {
        const stored = (localStorage.getItem(KEY) as ThemeMode | null) ?? "system";
        if (stored === "system") applyTheme("system");
      } catch { /* ignore */ }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const set = useCallback((next: ThemeMode) => {
    setMode(next);
    try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
    applyTheme(next);
  }, []);

  return { mode, setMode: set };
}
