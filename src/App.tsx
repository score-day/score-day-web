import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { api, auth, setOnUnauthorized } from "./lib/api";
import { loadToken } from "./lib/token";
import { getThreshold, setThreshold as saveThreshold, loadSettings } from "./lib/settings";
import { initNetwork } from "./lib/network";
import { useNetwork } from "./hooks/useNetwork";
import { initAutoSync, addSyncListener, addDropListener, syncNow, resetAutoSync } from "./lib/sync";
import { useSyncStatus } from "./hooks/useSyncStatus";
import type { SyncStatus } from "./hooks/useSyncStatus";
import type { Day, Streak } from "./lib/types";
import { loadTheme, saveTheme, DEFAULT_THEME } from "./lib/theme";
import type { Theme } from "./lib/theme";
import { usePushNotifications } from "./hooks/usePushNotifications";
import DayPage from "./pages/Day";
import HistoryPage from "./pages/History";
import ProfilePage from "./pages/Profile";
import AuthPage from "./pages/Auth";
import Onboarding, { hasOnboarded } from "./components/Onboarding";
import BottomNav from "./components/BottomNav";

type Tab = "day" | "history" | "profile";

// Simple SVG logomark — rounded square with checkmark, accent-colored
function AppLogo() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none" style={{ flexShrink: 0 }}>
      <rect width="30" height="30" rx="8" fill="var(--accent)"/>
      <path
        d="M7 15.5L12 21L23 10"
        stroke="var(--accent-txt)"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("day");
  const [showOnboarding, setShowOnboarding] = useState(() => !hasOnboarded());
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [day, setDay] = useState<Day | null>(null);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [droppedCount, setDroppedCount] = useState(0);
  const [threshold, setThreshold] = useState<number>(() => getThreshold());
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const { online } = useNetwork();
  const { status: syncStatus, pending: syncPending } = useSyncStatus();
  const handlePushNavigate = useCallback((tab: string) => setTab(tab as Tab), []);
  usePushNotifications(handlePushNavigate);

  const refreshRef = useRef<() => void>(() => {});

  useEffect(() => {
    initNetwork();
    loadToken().then((t) => setAuthed(!!t));
    loadTheme().then(setTheme);
    setOnUnauthorized(() => {
      resetAutoSync();
      setAuthed(false);
      setDay(null);
    });
    loadSettings().then(() => setThreshold(getThreshold()));
  }, []);

  async function refresh() {
    const [dayResult, streakResult] = await Promise.allSettled([
      api.today(),
      api.streak(threshold),
    ]);
    if (dayResult.status === "fulfilled") {
      setDay(dayResult.value);
      setError(null);
    } else {
      setError((dayResult.reason as Error).message);
    }
    if (streakResult.status === "fulfilled") {
      setStreak(streakResult.value);
    }
    // Write widget data to SharedPreferences so the home screen widget can read it.
    if (Capacitor.isNativePlatform() && dayResult.status === "fulfilled") {
      const d = dayResult.value;
      const streakCount = streakResult.status === "fulfilled" ? streakResult.value.streak : 0;
      const pct = d.total > 0 ? Math.round((d.score / d.total) * 100) : 0;
      const activeTasks = d.status === "active" || d.status === "locked";
      const tasksJson = activeTasks
        ? JSON.stringify(d.tasks.map((t) => ({ done: t.completed, title: t.title, weight: t.weight })))
        : "[]";
      const writes = [
        Preferences.set({ key: "sd_status", value: d.status }),
        Preferences.set({ key: "sd_streak", value: String(streakCount) }),
        Preferences.set({ key: "sd_score",  value: activeTasks ? String(pct) : "-1" }),
        Preferences.set({ key: "sd_pts",    value: activeTasks ? `${d.score}/${d.total}` : "" }),
        Preferences.set({ key: "sd_tasks",  value: tasksJson }),
      ];
      Promise.all(writes).catch(() => {});
    }
  }

  refreshRef.current = refresh;

  useEffect(() => {
    if (!authed) return;
    setDroppedCount(0);
    refresh();
    initAutoSync();
    const removeSyncListener = addSyncListener(() => { refreshRef.current(); });
    const removeDropListener = addDropListener((n) => setDroppedCount((c) => c + n));
    syncNow().catch(() => {});
    return () => {
      removeSyncListener();
      removeDropListener();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  function handleThresholdChange(v: number) {
    saveThreshold(v);
    setThreshold(v);
    api.streak(v).then(setStreak).catch(() => {});
  }

  function handleThemeChange(t: Theme) {
    setTheme(t);
    saveTheme(t);
  }

  async function handleLogout() {
    await auth.logout();
    resetAutoSync();
    setAuthed(false);
    setDay(null);
  }

  const themeClass = `theme-${theme}`;

  if (authed === null) return <div className={`${themeClass} sd-bg min-h-screen`} />;

  if (!authed) {
    return (
      <div className={`${themeClass} sd-bg min-h-screen`}>
        <AuthPage onAuth={() => setAuthed(true)} />
      </div>
    );
  }

  return (
    <div className={`${themeClass} sd-bg min-h-screen`}>
      {showOnboarding && <Onboarding onDone={() => setShowOnboarding(false)} />}

      {/* ── Top header: logo + app name + status chips only ── */}
      <header className="border-b sd-divider px-4 py-3 flex items-center gap-3">
        <AppLogo />
        <span className="text-base font-semibold tracking-tight sd-display leading-none">
          Score Day
        </span>
        <div className="ml-auto flex items-center gap-2">
          {!online && (
            <span className="sd-chip px-2 py-1 rounded-md text-xs flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--text-4)]" />
              Offline
            </span>
          )}
          <SyncIndicator status={syncStatus} pending={syncPending} />
          {streak && streak.streak > 0 && (
            <span className="sd-chip px-2 py-1 rounded-md text-xs">
              🔥 {streak.streak}
            </span>
          )}
        </div>
      </header>

      {/* ── Page content — padded bottom so it clears the nav bar ── */}
      <main className="px-4 py-6 max-w-2xl mx-auto pb-28">
        {droppedCount > 0 && (
          <div className="mb-4 rounded-md border border-amber-800 bg-amber-950/40 px-3 py-2 text-sm text-amber-300 flex items-center justify-between gap-3">
            <span>
              {droppedCount === 1 ? "1 offline change" : `${droppedCount} offline changes`} couldn't sync and {droppedCount === 1 ? "was" : "were"} discarded.
            </span>
            <button
              onClick={() => setDroppedCount(0)}
              className="shrink-0 text-amber-400 hover:text-amber-200 text-xs underline"
            >
              Dismiss
            </button>
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {tab === "day" && day && <DayPage day={day} onChange={refresh} theme={theme} streak={streak?.streak ?? 0} />}
        {tab === "day" && !day && <div className="sd-text-3">Loading…</div>}
        {tab === "history" && (
          <HistoryPage
            threshold={threshold}
            onThresholdChange={handleThresholdChange}
            onGoToToday={() => setTab("day")}
            theme={theme}
          />
        )}
        {tab === "profile" && (
          <ProfilePage
            theme={theme}
            onThemeChange={handleThemeChange}
            onLogout={handleLogout}
          />
        )}
      </main>

      {/* ── Fixed bottom navigation ── */}
      <BottomNav tab={tab} setTab={setTab} theme={theme} />
    </div>
  );
}

function SyncIndicator({ status, pending }: { status: SyncStatus; pending: number }) {
  if (status === "idle") return null;

  const styles: Record<Exclude<SyncStatus, "idle">, { dot: string; label: string }> = {
    pending: { dot: "bg-amber-500",                   label: `${pending} queued` },
    syncing: { dot: "bg-[var(--accent)] animate-pulse", label: "syncing…"        },
    done:    { dot: "bg-emerald-500",                  label: "synced"            },
  };

  const { dot, label } = styles[status as Exclude<SyncStatus, "idle">];

  return (
    <span className="sd-chip px-2 py-1 rounded-md text-xs flex items-center gap-1.5">
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
