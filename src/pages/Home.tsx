import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { isOnline } from "../lib/network";
import type { Day, FriendActivity, HistoryEntry, Streak, UserProfile } from "../lib/types";
import type { Theme } from "../lib/theme";

interface Props {
  day: Day | null;
  streak: Streak | null;
  theme: Theme;
  onNavigateToDay: () => void;
}

function getTier(s: number): { label: string; color: string; name: string } {
  if (s >= 180) return { label: "S", color: "var(--accent)",   name: "Legend"  };
  if (s >= 90)  return { label: "A", color: "var(--accent)",   name: "Elite"   };
  if (s >= 30)  return { label: "B", color: "#fbbf24",         name: "Regular" };
  return               { label: "C", color: "#f87171",         name: "Starter" };
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function ScoreRing({ pct, score, total, status }: { pct: number; score: number; total: number; status: string }) {
  const R = 56;
  const circ = 2 * Math.PI * R;
  const offset = circ * (1 - Math.min(pct, 100) / 100);

  const color =
    status === "rest" || status === "planning" ? "var(--text-4)" :
    pct >= 75 ? "#22c55e" :
    pct >= 50 ? "#fbbf24" :
    "#f87171";

  const label    = status === "rest" ? "🌙" : status === "planning" ? "—" : `${pct}%`;
  const sublabel = status === "rest" ? "Rest day" : status === "planning" ? "Planning…" : `${score} / ${total} pts`;

  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 144 144">
        <circle cx="72" cy="72" r={R} fill="none" stroke="var(--surface-3)" strokeWidth="12" />
        <circle
          cx="72" cy="72" r={R}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <div className="text-2xl font-bold leading-none" style={{ color }}>{label}</div>
        <div className="text-[10px] sd-text-4 text-center leading-tight px-3">{sublabel}</div>
      </div>
    </div>
  );
}

function MiniGraph({ entries }: { entries: HistoryEntry[] }) {
  if (!entries.length) return null;

  const BAR_W   = 24;
  const BAR_GAP = 5;
  const MAX_H   = 44;
  const TOP_PAD = 14; // room for % labels above bars
  const W       = entries.length * (BAR_W + BAR_GAP) - BAR_GAP;
  const totalH  = TOP_PAD + MAX_H + 18;
  const lineY   = TOP_PAD + MAX_H * (1 - 0.8); // y position of 80% threshold line

  return (
    <svg width={W} height={totalH} viewBox={`0 0 ${W} ${totalH}`}>
      {/* 80% threshold reference line */}
      <line
        x1={0} y1={lineY} x2={W} y2={lineY}
        stroke="var(--text-4)" strokeWidth="0.75" strokeDasharray="3 2" opacity="0.45"
      />
      <text x={W} y={lineY - 2} textAnchor="end"
        fontSize="7" fill="var(--text-4)" fontFamily="system-ui" opacity="0.6">
        80%
      </text>

      {entries.map((e, i) => {
        const pct  = e.total > 0 ? e.score / e.total : 0;
        const h    = e.rest ? 4 : Math.max(pct * MAX_H, 4);
        const x    = i * (BAR_W + BAR_GAP);
        const y    = TOP_PAD + MAX_H - h;
        const fill = e.rest ? "var(--text-4)" :
                     pct >= 0.75 ? "#22c55e" :
                     pct >= 0.5  ? "#fbbf24" : "#f87171";
        const op        = e.locked || e.rest ? 1 : 0.4;
        const dow       = ["S","M","T","W","T","F","S"][new Date(e.date + "T00:00:00").getDay()];
        const pctLabel  = (!e.rest && e.total > 0) ? `${Math.round(pct * 100)}%` : null;

        return (
          <g key={e.date}>
            <rect x={x} y={y} width={BAR_W} height={h} rx="4" fill={fill} opacity={op} />
            {pctLabel && (
              <text x={x + BAR_W / 2} y={y - 2} textAnchor="middle"
                fontSize="8" fill={fill} fontFamily="system-ui" opacity={op}>
                {pctLabel}
              </text>
            )}
            <text x={x + BAR_W / 2} y={TOP_PAD + MAX_H + 14} textAnchor="middle"
              fontSize="9" fill="var(--text-4)" fontFamily="system-ui">
              {dow}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function HomePage({ day, streak, theme: _theme, onNavigateToDay }: Props) {
  const [profile,  setProfile]  = useState<UserProfile | null>(null);
  const [history,  setHistory]  = useState<HistoryEntry[]>([]);
  const [activity, setActivity] = useState<FriendActivity[]>([]);
  const [loaded,   setLoaded]   = useState(false);

  useEffect(() => {
    Promise.allSettled([
      api.me().then(setProfile).catch(() => {}),
      api.history(7).then(setHistory).catch(() => {}),
      isOnline() ? api.friendsActivity().then(setActivity).catch(() => {}) : Promise.resolve(),
    ]).finally(() => setLoaded(true));
  }, []);

  const streakCount = streak?.streak ?? 0;
  const tier        = getTier(streakCount);
  const greeting    = getGreeting();
  const name        = profile?.username ?? "there";

  const isActive = day?.status === "active" || day?.status === "locked";
  const pct   = isActive && day!.total > 0 ? Math.round((day!.score / day!.total) * 100) : 0;
  const score = day?.score ?? 0;
  const total = day?.total ?? 0;
  const status = day?.status ?? "planning";

  const remaining = day?.status === "active" ? day.tasks.filter((t) => !t.completed) : [];

  if (!loaded) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-44 rounded-lg bg-[var(--surface-2)] animate-pulse" />
        <div className="h-52 rounded-xl bg-[var(--surface-1)] border sd-border animate-pulse" />
        <div className="h-20 rounded-xl bg-[var(--surface-1)] border sd-border animate-pulse opacity-60" />
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Greeting ── */}
      <div>
        <div className="text-xs sd-text-4 uppercase tracking-wider mb-0.5">{greeting}</div>
        <div className="text-2xl font-semibold sd-display sd-text-1 leading-tight">Hey, {name} 👋</div>
      </div>

      {/* ── Hero today card ── */}
      <div className="rounded-xl border sd-border bg-[var(--surface-1)] p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-xs sd-text-4 uppercase tracking-wider">Today</div>
            <div className="text-xs sd-text-3 mt-0.5">{day?.date ?? "—"}</div>
          </div>
          <button
            onClick={onNavigateToDay}
            className="text-xs px-3 py-1.5 rounded-lg sd-btn-accent font-medium"
          >
            {status === "active" ? "Track →" : status === "planning" ? "Plan →" : "View →"}
          </button>
        </div>

        <ScoreRing pct={pct} score={score} total={total} status={status} />

        {streakCount > 0 && (
          <div className="mt-3 flex items-center justify-center gap-1.5 text-sm">
            <span>🔥</span>
            <span className="font-medium sd-text-2">{streakCount}-day streak</span>
          </div>
        )}
      </div>

      {/* ── 7-day mini graph ── */}
      {history.length > 0 && (
        <div className="rounded-xl border sd-border bg-[var(--surface-1)] p-4">
          <div className="text-xs sd-text-4 uppercase tracking-wider mb-4">Last 7 days</div>
          <div className="flex justify-center">
            <MiniGraph entries={history} />
          </div>
        </div>
      )}

      {/* ── Streak / Tier / XP row ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border sd-border bg-[var(--surface-1)] px-3 py-4 flex flex-col items-center gap-1">
          <div className="text-2xl leading-none">🔥</div>
          <div className="text-xl font-bold sd-text-1 tabular-nums">{streakCount}</div>
          <div className="text-[10px] sd-text-4 uppercase tracking-wider">Streak</div>
        </div>

        <div className="rounded-xl border sd-border bg-[var(--surface-1)] px-3 py-4 flex flex-col items-center gap-1">
          <div className="text-2xl font-bold leading-none" style={{ color: tier.color }}>{tier.label}</div>
          <div className="text-[10px] sd-text-4 uppercase tracking-wider">Tier</div>
          <div className="text-[10px] sd-text-4">{tier.name}</div>
        </div>

        <div className="rounded-xl border sd-border bg-[var(--surface-1)] px-3 py-4 flex flex-col items-center gap-1">
          <div className="text-2xl font-bold leading-none" style={{ color: "var(--accent)" }}>{score}</div>
          <div className="text-[10px] sd-text-4 uppercase tracking-wider">XP Today</div>
          <div className="text-[10px] sd-text-4">of {total || "—"}</div>
        </div>
      </div>

      {/* ── Next actions ── */}
      {remaining.length > 0 && (
        <div className="rounded-xl border sd-border bg-[var(--surface-1)] p-4">
          <div className="text-xs sd-text-4 uppercase tracking-wider mb-3">Next actions</div>
          <ul className="space-y-2">
            {remaining.slice(0, 4).map((t) => (
              <li key={t.id} className="flex items-center gap-2.5">
                <span className="w-4 h-4 shrink-0 rounded border sd-border flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--accent)" }} />
                </span>
                <span className="flex-1 text-sm sd-text-2 truncate">{t.title}</span>
                <span className="text-xs sd-text-4 tabular-nums shrink-0">{t.weight} pts</span>
              </li>
            ))}
          </ul>
          {remaining.length > 4 && (
            <div className="text-xs sd-text-4 mt-2 text-center">+{remaining.length - 4} more</div>
          )}
          <button
            onClick={onNavigateToDay}
            className="mt-3 w-full py-2 rounded-lg text-xs sd-btn-surface font-medium"
          >
            Go to today →
          </button>
        </div>
      )}

      {/* ── Friend activity ── */}
      {activity.length > 0 && (
        <div className="rounded-xl border sd-border bg-[var(--surface-1)] p-4">
          <div className="text-xs sd-text-4 uppercase tracking-wider mb-3">Friends today</div>
          <div className="space-y-3">
            {activity.slice(0, 4).map((a) => {
              const displayName = a.username || a.player_id;
              const friendPct   = a.score_pct != null ? Math.round(a.score_pct) : null;
              const dotColor    =
                a.day_status === "locked" ? "#22c55e" :
                a.day_status === "active" ? "#fbbf24" :
                "var(--text-4)";
              return (
                <div key={a.player_id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--surface-3)] border sd-border flex items-center justify-center text-xs font-bold sd-text-2 shrink-0">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm sd-text-2 font-medium truncate">{displayName}</div>
                    {a.streak > 0 && (
                      <div className="text-[10px] sd-text-4">🔥 {a.streak}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {a.day_status && (
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dotColor }} />
                    )}
                    <span className="text-sm font-semibold sd-text-2 tabular-nums">
                      {friendPct != null ? `${friendPct}%` : "—"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
