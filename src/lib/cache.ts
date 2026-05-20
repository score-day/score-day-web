import { Preferences } from "@capacitor/preferences";

// Thin read cache backed by Capacitor Preferences (persistent on native, localStorage on web).
// Used to serve stale data when offline. Not a TTL cache — data is always refreshed when online.

const PREFIX = "cache:";

export async function cacheWrite<T>(key: string, data: T): Promise<void> {
  try {
    await Preferences.set({
      key: PREFIX + key,
      value: JSON.stringify(data),
    });
  } catch {
    // storage full or unavailable — non-fatal
  }
}

export async function cacheRead<T>(key: string): Promise<T | null> {
  try {
    const { value } = await Preferences.get({ key: PREFIX + key });
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export async function cacheDelete(key: string): Promise<void> {
  try {
    await Preferences.remove({ key: PREFIX + key });
  } catch {}
}

export async function clearAllCache(): Promise<void> {
  try {
    const { keys } = await Preferences.keys();
    await Promise.all(
      keys.filter((k) => k.startsWith(PREFIX)).map((k) => Preferences.remove({ key: k }))
    );
  } catch {}
}
