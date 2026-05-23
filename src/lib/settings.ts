import { Capacitor } from "@capacitor/core";

const KEY = "daily-score-streak-threshold";
const IS_NATIVE = Capacitor.isNativePlatform();

let _threshold = 80;

function clamp(v: number): number {
  return isNaN(v) ? 80 : Math.max(1, Math.min(100, v));
}

export async function loadSettings(): Promise<void> {
  if (IS_NATIVE) {
    const { Preferences } = await import("@capacitor/preferences");
    const { value } = await Preferences.get({ key: KEY });
    _threshold = clamp(parseInt(value ?? "80", 10));
  } else {
    _threshold = clamp(parseInt(localStorage.getItem(KEY) ?? "80", 10));
  }
}

export function getThreshold(): number {
  return _threshold;
}

export function setThreshold(v: number): void {
  _threshold = v;
  if (IS_NATIVE) {
    import("@capacitor/preferences").then(({ Preferences }) => {
      Preferences.set({ key: KEY, value: String(v) }).catch(() => {});
    }).catch(() => {});
  } else {
    localStorage.setItem(KEY, String(v));
  }
}
