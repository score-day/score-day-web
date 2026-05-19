import { Preferences } from "@capacitor/preferences";

export type Theme = "light" | "dark-knight" | "solo-leveling";

const PREF_KEY = "score-day-theme";
const VALID = ["light", "dark-knight", "solo-leveling"] as const;
export const DEFAULT_THEME: Theme = "dark-knight";

export async function loadTheme(): Promise<Theme> {
  try {
    const { value } = await Preferences.get({ key: PREF_KEY });
    if (VALID.includes(value as Theme)) return value as Theme;
  } catch {}
  return DEFAULT_THEME;
}

export async function saveTheme(theme: Theme): Promise<void> {
  try {
    await Preferences.set({ key: PREF_KEY, value: theme });
  } catch {}
}

export type ThemeColors = {
  chartGrid: string;
  chartAxis: string;
  chartTooltipBg: string;
  chartTooltipBorder: string;
  chartLine: string;
  chartRolling: string;
  chartThreshold: string;
  heatmapHigh: string;
  heatmapMid: string;
};

export function getThemeColors(theme: Theme): ThemeColors {
  switch (theme) {
    case "light":
      return {
        chartGrid: "#e5e7eb",
        chartAxis: "#9ca3af",
        chartTooltipBg: "#ffffff",
        chartTooltipBorder: "#e5e7eb",
        chartLine: "#9ca3af",
        chartRolling: "#059669",
        chartThreshold: "#059669",
        heatmapHigh: "bg-emerald-500/80 border-emerald-500",
        heatmapMid:  "bg-emerald-700/50 border-emerald-700",
      };
    case "dark-knight":
      return {
        chartGrid: "#1a1d26",
        chartAxis: "#4a5268",
        chartTooltipBg: "#0c0d10",
        chartTooltipBorder: "#1a1d26",
        chartLine: "#4a5268",
        chartRolling: "#2e83ff",
        chartThreshold: "#2e83ff",
        heatmapHigh: "bg-blue-500/80 border-blue-500",
        heatmapMid:  "bg-blue-800/60 border-blue-800",
      };
    case "solo-leveling":
      return {
        chartGrid: "#1a1a30",
        chartAxis: "#6b7dab",
        chartTooltipBg: "#0a0a16",
        chartTooltipBorder: "#1a1a30",
        chartLine: "#6b7dab",
        chartRolling: "#a855f7",
        chartThreshold: "#a855f7",
        heatmapHigh: "bg-violet-500/80 border-violet-500",
        heatmapMid:  "bg-violet-800/60 border-violet-800",
      };
  }
}
