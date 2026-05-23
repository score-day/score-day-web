import { Preferences } from "@capacitor/preferences";
import type { MutationData, QueuedMutation } from "./types";

const QUEUE_KEY = "mutation_queue";
export const MAX_ATTEMPTS = 5;

type QueueListener = (queue: readonly QueuedMutation[]) => void;

let _queue: QueuedMutation[] = [];
let _loaded = false;
const _listeners = new Set<QueueListener>();

// Thrown by api.ts mutations when the request is queued instead of sent.
// Callers can check `instanceof OfflineError` to show a friendlier message.
export class OfflineError extends Error {
  readonly isOfflineError = true as const;
  constructor() {
    super("Saved — will sync when back online");
    this.name = "OfflineError";
  }
}

async function _load(): Promise<void> {
  if (_loaded) return;
  _loaded = true;
  try {
    const { value } = await Preferences.get({ key: QUEUE_KEY });
    _queue = value ? (JSON.parse(value) as QueuedMutation[]) : [];
  } catch {
    _queue = [];
  }
}

async function _persist(): Promise<void> {
  try {
    await Preferences.set({ key: QUEUE_KEY, value: JSON.stringify(_queue) });
  } catch (err) {
    console.error("[queue] persist failed:", err);
  }
  const snap = [..._queue] as readonly QueuedMutation[];
  _listeners.forEach((fn) => fn(snap));
}

export function makeTempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function enqueue(data: MutationData): Promise<QueuedMutation> {
  await _load();
  const m = {
    ...data,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    attempts: 0,
    createdAt: new Date().toISOString(),
  } as QueuedMutation;
  _queue.push(m);
  await _persist();
  return m;
}

export async function dequeue(id: string): Promise<void> {
  await _load();
  _queue = _queue.filter((m) => m.id !== id);
  await _persist();
}

export async function bumpAttempts(id: string): Promise<void> {
  await _load();
  const m = _queue.find((item) => item.id === id);
  if (m) m.attempts += 1;
  await _persist();
}

export async function getQueue(): Promise<QueuedMutation[]> {
  await _load();
  return [..._queue];
}

export function pendingCount(): number {
  return _queue.length;
}

export function addQueueListener(fn: QueueListener): () => void {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

export async function clearQueue(): Promise<void> {
  _queue = [];
  _loaded = true;
  try {
    await Preferences.remove({ key: QUEUE_KEY });
  } catch {}
  _listeners.forEach((fn) => fn([]));
}

// Replace every occurrence of a tempId string with the real server-assigned numeric ID.
// Uses JSON round-trip replacement so it works across any field in any mutation variant.
// Called by the sync engine (Phase 5) after a queued addTask resolves.
export async function reconcileId(tempId: string, realId: number): Promise<void> {
  await _load();
  if (!_queue.some((m) => JSON.stringify(m).includes(`"${tempId}"`))) return;
  // Target only known ID fields to avoid corrupting text fields (e.g. task title)
  // that coincidentally contain the tempId string.
  const escapedId = tempId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`"(tempId|taskId)":\\s*"${escapedId}"`, "g");
  const patched = JSON.stringify(_queue).replace(pattern, `"$1":${realId}`);
  try {
    _queue = JSON.parse(patched) as QueuedMutation[];
    await _persist();
  } catch {
    // Malformed JSON would be a bug — leave queue unchanged
  }
}
