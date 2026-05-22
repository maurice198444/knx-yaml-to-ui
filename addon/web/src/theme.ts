export type Theme = "light" | "dark";
export type ThemePref = Theme | "auto";

const STORAGE_KEY = "knx-yaml-theme";

export function readThemePref(): ThemePref {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" || v === "auto" ? v : "auto";
}

export function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function effectiveTheme(pref: ThemePref): Theme {
  return pref === "auto" ? systemTheme() : pref;
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
}

export function setThemePref(pref: ThemePref): void {
  localStorage.setItem(STORAGE_KEY, pref);
  applyTheme(effectiveTheme(pref));
  window.dispatchEvent(new CustomEvent("knx-theme-change", { detail: pref }));
}

export function initTheme(): ThemePref {
  const pref = readThemePref();
  applyTheme(effectiveTheme(pref));
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (readThemePref() === "auto") applyTheme(systemTheme());
    });
  return pref;
}
