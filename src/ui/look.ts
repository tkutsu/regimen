import { useEffect, useState } from "react";
import type { Theme } from "../domain/types";

type Look = { theme: Theme };

const KEY = "look";

/** Puts the theme on the page. */
function applyLook({ theme }: Look) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
}

/**
 * The look comes from the synced settings, which load after the first paint. The last
 * one is kept on this device so the app opens in it instead of flashing the default.
 */
export function restoreLook() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) applyLook(JSON.parse(saved));
  } catch {
    // no storage: the default look until settings load
  }
}

export function useLook(look: Look | undefined) {
  const theme = look?.theme;
  useEffect(() => {
    if (theme === undefined) return;
    applyLook({ theme });
    try {
      localStorage.setItem(KEY, JSON.stringify({ theme }));
    } catch {
      // the look still applies, it just isn't remembered for the next start
    }
  }, [theme]);
}

/** A per-device view choice (a chart range, say) that survives tab switches and restarts. */
export function useRemembered<T extends string | number>(key: string, initial: T, allowed: readonly T[]) {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? "null");
      return allowed.includes(saved) ? saved : initial;
    } catch {
      return initial;
    }
  });
  const remember = (next: T) => {
    setValue(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // kept for this session only
    }
  };
  return [value, remember] as const;
}
