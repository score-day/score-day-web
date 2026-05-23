import { Capacitor } from "@capacitor/core";
import { Network } from "@capacitor/network";

// Tracks real-time online/offline status.
// Works on native (Capacitor Network plugin) and web (browser events).
// Call initNetwork() once at app startup; isOnline() is then synchronous.

let _online = true;
const _listeners = new Set<(online: boolean) => void>();

function _notify(online: boolean): void {
  if (_online === online) return;
  _online = online;
  _listeners.forEach((fn) => fn(online));
}

export function isOnline(): boolean {
  return _online;
}

export function addNetworkListener(fn: (online: boolean) => void): () => void {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

let _initialized = false;

export async function initNetwork(): Promise<void> {
  if (_initialized) return;
  _initialized = true;

  if (Capacitor.isNativePlatform()) {
    const status = await Network.getStatus();
    _online = status.connected;
    Network.addListener("networkStatusChange", (s) => _notify(s.connected));
  } else {
    _online = navigator.onLine;
    const _onOnline = () => _notify(true);
    const _onOffline = () => _notify(false);
    window.addEventListener("online", _onOnline);
    window.addEventListener("offline", _onOffline);
  }
}
