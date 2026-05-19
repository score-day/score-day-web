import { Capacitor } from "@capacitor/core";
import { getQueue, dequeue, bumpAttempts, reconcileId, MAX_ATTEMPTS } from "./queue";
import { isOnline, addNetworkListener } from "./network";
import { rawApi, HttpError } from "./api";

type SyncListener = (synced: number) => void;
type SyncStartListener = () => void;
type DropListener = (count: number) => void;

const _listeners = new Set<SyncListener>();
const _startListeners = new Set<SyncStartListener>();
const _dropListeners = new Set<DropListener>();

let _syncing = false;
let _autoStarted = false;
let _cleanupNetwork: (() => void) | null = null;
let _cleanupForeground: (() => void) | null = null;

export function addSyncListener(fn: SyncListener): () => void {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

export function addSyncStartListener(fn: SyncStartListener): () => void {
  _startListeners.add(fn);
  return () => { _startListeners.delete(fn); };
}

export function addDropListener(fn: DropListener): () => void {
  _dropListeners.add(fn);
  return () => { _dropListeners.delete(fn); };
}

export function isSyncing(): boolean {
  return _syncing;
}

export async function syncNow(): Promise<number> {
  if (_syncing || !isOnline()) return 0;

  // Check queue before announcing sync start — avoids false "syncing…" when idle.
  const queue = await getQueue();
  if (queue.length === 0) return 0;

  _syncing = true;
  _startListeners.forEach((fn) => fn());
  let synced = 0;

  try {
    for (const mutation of queue) {
      if (!isOnline()) break;

      try {
        let tempId: string | undefined;
        let realId: number | undefined;

        switch (mutation.type) {
          case "addTask": {
            const task = await rawApi.addTask(mutation.dayId, mutation.title, mutation.weight, mutation.category);
            tempId = mutation.tempId;
            realId = task.id;
            break;
          }
          case "updateTask":
            await rawApi.updateTask(mutation.taskId, mutation.patch);
            break;
          case "deleteTask":
            await rawApi.deleteTask(mutation.taskId);
            break;
          case "startDay":
            await rawApi.startDay(mutation.dayId);
            break;
          case "lockDay":
            await rawApi.lockDay(mutation.dayId);
            break;
          case "saveNote":
            await rawApi.saveNote(mutation.dayId, mutation.note);
            break;
          case "updateMe":
            await rawApi.updateMe(mutation.patch);
            break;
        }

        if (tempId !== undefined && realId !== undefined) {
          await reconcileId(tempId, realId);
        }

        await dequeue(mutation.id);
        synced++;
      } catch (err) {
        if (err instanceof HttpError && err.status >= 400 && err.status < 500) {
          // 4xx = permanent client error (bad data, already deleted, conflict, etc.)
          // Drop it and keep going — it will never succeed.
          await dequeue(mutation.id);
          continue;
        }
        // Temporary failure (network error, 5xx) — bump counter and stop.
        // Mutations must stay ordered, so we don't skip ahead.
        await bumpAttempts(mutation.id);
        const fresh = await getQueue();
        const stuck = fresh.find((m) => m.id === mutation.id);
        if (stuck && stuck.attempts >= MAX_ATTEMPTS) {
          await dequeue(mutation.id);
          _dropListeners.forEach((fn) => fn(1));
        }
        break;
      }
    }
  } finally {
    _syncing = false;
    // Always fire done listeners when sync started — resets the "syncing…" indicator
    // even if synced=0 (e.g. all mutations were 4xx-dropped or network cut out).
    _listeners.forEach((fn) => fn(synced));
  }

  return synced;
}

// Removes all auto-sync listeners and allows initAutoSync to re-register on next login.
// Call on logout so stale listeners don't outlive the session.
export function resetAutoSync(): void {
  _cleanupNetwork?.();
  _cleanupForeground?.();
  _cleanupNetwork = null;
  _cleanupForeground = null;
  _autoStarted = false;
}

// Call once after auth. Registers network-reconnect and app-foreground triggers.
// Idempotent — safe to call multiple times.
export function initAutoSync(): void {
  if (_autoStarted) return;
  _autoStarted = true;

  // Sync when network comes back online
  _cleanupNetwork = addNetworkListener((online) => {
    if (online) syncNow().catch(() => {});
  });

  // Sync when app returns to foreground
  if (Capacitor.isNativePlatform()) {
    import("@capacitor/app").then(({ App }) => {
      App.addListener("appStateChange", (state) => {
        if (state.isActive) syncNow().catch(() => {});
      }).then((handle) => {
        // If resetAutoSync() was called before this handle resolved, remove immediately.
        if (!_autoStarted) {
          handle.remove();
        } else {
          _cleanupForeground = () => { handle.remove(); };
        }
      });
    }).catch(() => {});
  } else {
    const onVisibility = () => {
      if (!document.hidden) syncNow().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisibility);
    _cleanupForeground = () => document.removeEventListener("visibilitychange", onVisibility);
  }
}
