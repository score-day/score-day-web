import { Capacitor, CapacitorHttp } from "@capacitor/core";
import type { CategoryStat, Challenge, Day, Friend, FriendActivity, FriendTask, HistoryEntry, MutationData, Stats, Streak, Task, UserProfile } from "./types";
import { loadToken, saveToken, clearToken } from "./token";
import { isOnline } from "./network";
import { cacheRead, cacheWrite } from "./cache";
import { enqueue, makeTempId, OfflineError, clearQueue } from "./queue";

const BASE_URL = import.meta.env.VITE_API_URL ?? "";
const IS_NATIVE = Capacitor.isNativePlatform();

let _onUnauthorized: (() => void) | null = null;

export function setOnUnauthorized(cb: () => void): void {
  _onUnauthorized = cb;
}

// Carries HTTP status so the sync engine can distinguish 4xx (drop) from 5xx (retry).
export class HttpError extends Error {
  constructor(public readonly status: number, detail: string) {
    super(detail);
    this.name = "HttpError";
  }
}

async function handleUnauthorized(path: string, detail: string): Promise<never> {
  // Auth endpoints returning 401 means bad credentials, not an expired session.
  if (!path.startsWith("/auth/")) {
    await clearQueue();
    await clearToken();
    _onUnauthorized?.();
  }
  throw new HttpError(401, detail);
}

// Retry up to 2 extra times on network failures or 5xx responses.
// 4xx errors are permanent (bad request, auth, not found) and are never retried.
// POSTs are never retried — they are not idempotent and a timed-out request that
// succeeded server-side would create a duplicate resource on retry.
const RETRY_DELAYS_MS = [300, 600];

async function withRetry<T>(method: string, fn: () => Promise<T>): Promise<T> {
  if (method === "POST") return fn();
  let lastErr: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isRetryable = !(err instanceof HttpError) || err.status >= 500;
      if (!isRetryable || attempt === RETRY_DELAYS_MS.length) break;
      await new Promise<void>((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }
  throw lastErr;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const method = (init?.method ?? "GET").toUpperCase();
  const bodyStr = init?.body as string | undefined;
  const token = await loadToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  return withRetry(method, async () => {
    if (IS_NATIVE) {
      const response = await CapacitorHttp.request({
        url,
        method,
        headers,
        ...(bodyStr ? { data: JSON.parse(bodyStr) } : {}),
      });
      if (response.status === 401) {
        const detail = (typeof response.data === "object" && response.data?.detail) || "Session expired — please sign in again";
        return handleUnauthorized(path, detail);
      }
      if (response.status >= 400) {
        const detail =
          (typeof response.data === "object" && response.data?.detail) ||
          (response.status >= 500 ? "Server error — please try again in a moment" : response.status.toString());
        throw new HttpError(response.status, detail);
      }
      if (response.status === 204) return undefined as T;
      return response.data as T;
    }

    const res = await fetch(url, { headers, ...init });
    if (res.status === 401) {
      let detail = "Session expired — please sign in again";
      try {
        const body = await res.json();
        if (body?.detail) detail = body.detail;
      } catch {}
      return handleUnauthorized(path, detail);
    }
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const body = await res.json();
        if (body?.detail) detail = body.detail;
      } catch {}
      throw new HttpError(res.status, detail);
    }
    if (res.status === 204) return undefined as T;
    return res.json();
  });
}

// GET wrapper: serves from cache when offline, writes to cache after every successful fetch.
async function cachedReq<T>(path: string): Promise<T> {
  if (!isOnline()) {
    const cached = await cacheRead<T>(path);
    if (cached !== null) return cached;
    throw new Error("No internet connection — please connect and try again");
  }

  try {
    const data = await req<T>(path);
    cacheWrite(path, data); // fire-and-forget; errors swallowed inside cacheWrite
    return data;
  } catch (err) {
    // Connection dropped mid-flight — fall back to cache silently
    if (!isOnline()) {
      const cached = await cacheRead<T>(path);
      if (cached !== null) return cached;
    }
    throw err;
  }
}

// Mutation wrapper: enqueues and throws OfflineError when there is no network.
// Server errors (4xx/5xx) are NOT queued — they propagate normally.
async function queuedMutation<T>(data: MutationData, serverCall: () => Promise<T>): Promise<T> {
  if (!isOnline()) {
    await enqueue(data);
    throw new OfflineError();
  }
  try {
    return await serverCall();
  } catch (err) {
    // Connection dropped between the online check and the actual request.
    if (!isOnline()) {
      await enqueue(data);
      throw new OfflineError();
    }
    throw err; // Real server error — let the caller handle it
  }
}

async function authReq(path: string, body: object): Promise<{ token: string }> {
  return req<{ token: string }>(path, { method: "POST", body: JSON.stringify(body) });
}

export { OfflineError };

export const auth = {
  register: async (email: string, password: string, username?: string) => {
    const { token } = await authReq("/auth/register", { email, password, username });
    await saveToken(token);
  },
  login: async (email: string, password: string) => {
    const { token } = await authReq("/auth/login", { email, password });
    await saveToken(token);
  },
  logout: async () => {
    await clearQueue();
    await clearToken();
  },
};

export const api = {
  // ── Reads — served from cache when offline ──
  today: () => cachedReq<Day>("/api/today"),
  history: (days = 30) => cachedReq<HistoryEntry[]>(`/api/history?days=${days}`),
  categoryStats: (days = 30) => cachedReq<CategoryStat[]>(`/api/history/categories?days=${days}`),
  streak: (threshold = 80) => cachedReq<Streak>(`/api/streak?threshold=${threshold}`),
  dayByDate: (date: string) => cachedReq<Day>(`/api/days/by-date/${date}`),
  stats: (threshold = 80) => cachedReq<Stats>(`/api/stats?threshold=${threshold}`),
  me: () => cachedReq<UserProfile>("/api/me"),

  // ── Mutations — queued when offline, replayed on reconnect ──
  addTask: (dayId: number, title: string, weight: number, category: string | null) =>
    queuedMutation(
      { type: "addTask", dayId, title, weight, category, tempId: makeTempId() },
      () => req<Task>(`/api/days/${dayId}/tasks`, { method: "POST", body: JSON.stringify({ title, weight, category }) }),
    ),
  updateTask: (taskId: number, patch: Partial<Pick<Task, "title" | "weight" | "completed" | "category">>) =>
    queuedMutation(
      { type: "updateTask", taskId, patch },
      () => req<Task>(`/api/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(patch) }),
    ),
  deleteTask: (taskId: number) =>
    queuedMutation(
      { type: "deleteTask", taskId },
      () => req<{ ok: boolean }>(`/api/tasks/${taskId}`, { method: "DELETE" }),
    ),
  startDay: (dayId: number) =>
    queuedMutation(
      { type: "startDay", dayId },
      () => req<Day>(`/api/days/${dayId}/start`, { method: "POST" }),
    ),
  lockDay: (dayId: number) =>
    queuedMutation(
      { type: "lockDay", dayId },
      () => req<Day>(`/api/days/${dayId}/lock`, { method: "POST" }),
    ),
  saveNote: (dayId: number, note: string) =>
    queuedMutation(
      { type: "saveNote", dayId, note },
      () => req<Day>(`/api/days/${dayId}/note`, { method: "PATCH", body: JSON.stringify({ note }) }),
    ),
  updateMe: (patch: { username: string | null }) =>
    queuedMutation(
      { type: "updateMe", patch },
      () => req<UserProfile>("/api/me", { method: "PATCH", body: JSON.stringify(patch) }),
    ),

  // ── Friends — never queued, require network ──
  friends: () => req<Friend[]>("/api/friends"),
  sendFriendRequest: (player_id: string) =>
    req<Friend>("/api/friends/request", { method: "POST", body: JSON.stringify({ player_id }) }),
  acceptFriend: (id: number) =>
    req<Friend>(`/api/friends/${id}/accept`, { method: "POST" }),
  removeFriend: (id: number) =>
    req<{ ok: boolean }>(`/api/friends/${id}`, { method: "DELETE" }),

  // ── Friends activity feed (polled every 60s) ──
  friendsActivity: () => req<FriendActivity[]>("/api/friends/activity"),

  // ── Friend Tasks ──
  friendTasksInbox: () => req<FriendTask[]>("/api/friend-tasks/inbox"),
  friendTasksSent: () => req<FriendTask[]>("/api/friend-tasks/sent"),
  sendFriendTask: (receiver_player_id: string, title: string, weight: number) =>
    req<FriendTask>("/api/friend-tasks", { method: "POST", body: JSON.stringify({ receiver_player_id, title, weight }) }),
  acceptFriendTask: (id: number) =>
    req<FriendTask>(`/api/friend-tasks/${id}/accept`, { method: "POST" }),
  declineFriendTask: (id: number) =>
    req<{ ok: boolean }>(`/api/friend-tasks/${id}`, { method: "DELETE" }),

  // ── Challenges ──
  challenges: () => req<Challenge[]>("/api/challenges"),
  sendChallenge: (receiver_player_id: string, threshold: number, days: number) =>
    req<Challenge>("/api/challenges", { method: "POST", body: JSON.stringify({ receiver_player_id, threshold, days }) }),
  acceptChallenge: (id: number) =>
    req<Challenge>(`/api/challenges/${id}/accept`, { method: "POST" }),
  declineChallenge: (id: number) =>
    req<{ ok: boolean }>(`/api/challenges/${id}`, { method: "DELETE" }),
};

// Direct calls that bypass the offline queue — used only by the sync engine during replay.
// These must never be called from UI code directly.
export const rawApi = {
  addTask: (dayId: number, title: string, weight: number, category: string | null) =>
    req<Task>(`/api/days/${dayId}/tasks`, { method: "POST", body: JSON.stringify({ title, weight, category }) }),
  updateTask: (taskId: number, patch: Partial<Pick<Task, "title" | "weight" | "completed" | "category">>) =>
    req<Task>(`/api/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteTask: (taskId: number) =>
    req<{ ok: boolean }>(`/api/tasks/${taskId}`, { method: "DELETE" }),
  startDay: (dayId: number) =>
    req<Day>(`/api/days/${dayId}/start`, { method: "POST" }),
  lockDay: (dayId: number) =>
    req<Day>(`/api/days/${dayId}/lock`, { method: "POST" }),
  saveNote: (dayId: number, note: string) =>
    req<Day>(`/api/days/${dayId}/note`, { method: "PATCH", body: JSON.stringify({ note }) }),
  updateMe: (patch: { username: string | null }) =>
    req<UserProfile>("/api/me", { method: "PATCH", body: JSON.stringify(patch) }),
};
