import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import { api } from "../lib/api";
import { setThreshold as saveThreshold } from "../lib/settings";
import { getThemeColors } from "../lib/theme";
import type { Theme } from "../lib/theme";
import type { CategoryStat, Day, HistoryEntry, Task } from "../lib/types";

interface Props {
  threshold: number;
  onThresholdChange: (v: number) => void;
  onGoToToday: () => void;
  theme: Theme;
}

const CAT_COLORS: Record<string, string> = {
  Work:          "bg-blue-500/20 text-blue-300 border-blue-500/30",
  Personal:      "bg-violet-500/20 text-violet-300 border-violet-500/30",
  Health:        "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  Learning:      "bg-amber-500/20 text-amber-300 border-amber-500/30",
  Other:         "bg-[var(--surface-2)] text-[var(--text-3)] border-[var(--border-1)]",
  Uncategorized: "bg-[var(--surface-2)] text-[var(--text-4)] border-[var(--border-1)]",
};

const CAT_BAR: Record<string, string> = {
  Work:          "bg-blue-500",
  Personal:      "bg-violet-500",
  Health:        "bg-emerald-500",
  Learning:      "bg-amber-500",
  Other:         "bg-[var(--text-3)]",
  Uncategorized: "bg-[var(--surface-3)]",
};

function CategoryBadge({ cat }: { cat: string | null }) {
  const label = cat || "Uncategorized";
  const cls = CAT_COLORS[label] ?? "bg-[var(--surface-2)] text-[var(--text-3)] border-[var(--border-1)]";
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${cls}`}>{label}</span>
  );
}

const RANGE_OPTIONS = [30, 90, 365] as const;
type Range = typeof RANGE_OPTIONS[number];

export default function HistoryPage({ threshold, onThresholdChange, onGoToToday, theme }: Props) {
  const [rows, setRows] = useState<HistoryEntry[]>([]);
  const [categories, setCategories] = useState<CategoryStat[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [range, setRange] = useState<Range>(30);
  const [localThreshold, setLocalThreshold] = useState(threshold);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayDetail, setDayDetail] = useState<Day | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState<string | null>(null);

  const tc = getThemeColors(theme);

  useEffect(() => {
    setSelectedDate(null);
    setDayDetail(null);
    api.history(range).then(setRows).catch((e) => setErr((e as Error).message));
    api.categoryStats(range).then(setCategories).catch(() => {});
  }, [range]);

  async function handleSelectDate(date: string) {
    if (selectedDate === date) {
      setSelectedDate(null);
      setDayDetail(null);
      return;
    }
    setSelectedDate(date);
    setDayDetail(null);
    setDetailErr(null);
    setDetailLoading(true);
    try {
      const d = await api.dayByDate(date);
      setDayDetail(d);
    } catch (e) {
      setDetailErr((e as Error).message);
    } finally {
      setDetailLoading(false);
    }
  }

  const { chartData, monthAvg, prevMonthAvg, delta, bestDay, worstDay } = useMemo(() => {
    const locked = rows.filter((r) => r.locked);
    const toPct = (r: HistoryEntry) =>
      r.total > 0 ? Math.round((r.score / r.total) * 100) : 0;
    const data = locked.map((r, i) => {
      const window = locked.slice(Math.max(0, i - 6), i + 1);
      const avg = window.reduce((s, x) => s + toPct(x), 0) / window.length;
      return {
        date: r.date.slice(5),
        score: toPct(r),
        rolling: Number(avg.toFixed(1)),
      };
    });
    const lastN = locked.slice(-range);
    const prevN = locked.slice(-range * 2, -range);
    const avg = (a: HistoryEntry[]) =>
      a.length ? a.reduce((s, x) => s + toPct(x), 0) / a.length : 0;
    const m = avg(lastN);
    const p = avg(prevN);

    const lockedWithScore = locked.filter((r) => r.total > 0);
    const best = lockedWithScore.length
      ? lockedWithScore.reduce((a, b) => toPct(a) >= toPct(b) ? a : b)
      : null;
    const worst = lockedWithScore.length > 1
      ? lockedWithScore.reduce((a, b) => toPct(a) <= toPct(b) ? a : b)
      : null;

    return { chartData: data, monthAvg: m, prevMonthAvg: p, delta: m - p, bestDay: best, worstDay: worst };
  }, [rows, range]);

  function commitThreshold() {
    const clamped = Math.max(1, Math.min(100, localThreshold || 1));
    setLocalThreshold(clamped);
    saveThreshold(clamped);
    onThresholdChange(clamped);
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="text-sm sd-text-3">Last {range} days</div>
          <div className="flex gap-1">
            {RANGE_OPTIONS.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-2.5 py-1 rounded text-xs transition ${
                  range === r
                    ? "bg-[var(--surface-3)] sd-text-1"
                    : "sd-text-3 hover:text-[var(--text-1)] hover:bg-[var(--surface-2)]"
                }`}
              >
                {r}d
              </button>
            ))}
          </div>
        </div>
        <div className="mt-1 flex items-baseline gap-4">
          <div className="text-3xl font-semibold tabular-nums">
            {monthAvg.toFixed(1)}<span className="sd-text-3 text-lg">% avg</span>
          </div>
          {prevMonthAvg > 0 && (
            <div
              className={
                "text-sm " +
                (delta > 0 ? "text-emerald-400" : delta < 0 ? "text-red-400" : "sd-text-3")
              }
            >
              {delta > 0 ? "▲" : delta < 0 ? "▼" : "·"} {Math.abs(delta).toFixed(1)}pp vs prior {range}d
            </div>
          )}
        </div>
      </div>

      {(bestDay || worstDay) && (
        <div className="flex gap-3">
          {bestDay && (
            <div className="flex-1 rounded-lg border border-emerald-900/60 bg-emerald-950/30 px-4 py-3">
              <div className="text-xs text-emerald-600 uppercase tracking-wider mb-1">Best day</div>
              <div className="text-xl font-semibold tabular-nums text-emerald-400">
                {bestDay.total > 0 ? Math.round((bestDay.score / bestDay.total) * 100) : 0}%
              </div>
              <div className="text-xs sd-text-3 mt-0.5">{bestDay.date}</div>
            </div>
          )}
          {worstDay && (
            <div className="flex-1 rounded-lg border border-red-900/40 bg-red-950/20 px-4 py-3">
              <div className="text-xs text-red-700 uppercase tracking-wider mb-1">Worst day</div>
              <div className="text-xl font-semibold tabular-nums text-red-400">
                {worstDay.total > 0 ? Math.round((worstDay.score / worstDay.total) * 100) : 0}%
              </div>
              <div className="text-xs sd-text-3 mt-0.5">{worstDay.date}</div>
            </div>
          )}
        </div>
      )}

      {err && <div className="text-sm text-red-400">{err}</div>}

      {chartData.length === 0 ? (
        <div className="rounded-xl border border-dashed sd-border bg-[var(--surface-1)] px-6 py-12 text-center">
          <div className="text-4xl mb-4">📊</div>
          <div className="text-base font-medium sd-text-1 mb-2">No history yet</div>
          <p className="text-sm sd-text-3 max-w-sm mx-auto mb-6">
            Your chart, heatmap, and streaks will appear here once you complete and lock your first day.
          </p>
          <button
            onClick={onGoToToday}
            className="px-5 py-2 rounded-lg sd-btn-accent text-sm font-medium transition"
          >
            Go plan today →
          </button>
        </div>
      ) : (
        <>
          <Heatmap
            rows={rows}
            range={range}
            threshold={threshold}
            selectedDate={selectedDate}
            onSelect={handleSelectDate}
            heatmapHigh={tc.heatmapHigh}
            heatmapMid={tc.heatmapMid}
          />

          {selectedDate && (
            <div className="rounded-lg border sd-border bg-[var(--surface-1)] p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium sd-text-1">{selectedDate}</div>
                <button
                  onClick={() => { setSelectedDate(null); setDayDetail(null); }}
                  className="sd-text-4 hover:text-[var(--text-1)] text-xs transition"
                >
                  ✕ close
                </button>
              </div>
              {detailLoading && <div className="text-sm sd-text-3">Loading…</div>}
              {detailErr && <div className="text-sm text-red-400">{detailErr}</div>}
              {dayDetail && <DayDetailPanel day={dayDetail} />}
            </div>
          )}

          <div className="h-64 rounded-md border sd-border p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke={tc.chartGrid} strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke={tc.chartAxis} fontSize={11} />
                <YAxis domain={[0, 100]} stroke={tc.chartAxis} fontSize={11} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{
                    background: tc.chartTooltipBg,
                    border: `1px solid ${tc.chartTooltipBorder}`,
                    borderRadius: 6,
                    fontSize: 12,
                    color: "var(--text-1)",
                  }}
                  formatter={(value: number) => [`${value}%`]}
                />
                <ReferenceLine
                  y={threshold}
                  stroke={tc.chartThreshold}
                  strokeDasharray="2 4"
                  label={{ value: `${threshold}%`, fill: tc.chartThreshold, fontSize: 10, position: "insideTopRight" }}
                />
                <Line type="monotone" dataKey="score" stroke={tc.chartLine} strokeWidth={1.5} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="rolling" stroke={tc.chartRolling} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {categories.length > 0 && (
        <section>
          <div className="text-xs uppercase tracking-wider sd-text-3 mb-3">
            Category breakdown · last {range} days
          </div>
          <div className="space-y-3">
            {categories.map((c) => {
              const pct = c.total_weight > 0
                ? Math.round((c.completed_weight / c.total_weight) * 100)
                : 0;
              const barColor = CAT_BAR[c.category] ?? "bg-[var(--text-3)]";
              return (
                <div key={c.category}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm sd-text-2">{c.category}</span>
                    <span className="text-xs sd-text-3 tabular-nums">
                      {c.completed_weight}/{c.total_weight} pts · {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="border-t sd-divider pt-6">
        <div className="text-xs uppercase tracking-wider sd-text-3 mb-3">Streak settings</div>
        <div className="flex items-center gap-3">
          <span className="text-sm sd-text-2">Count days scoring ≥</span>
          <input
            type="number"
            min={1}
            max={100}
            value={localThreshold}
            onChange={(e) => setLocalThreshold(Number(e.target.value))}
            onBlur={commitThreshold}
            onKeyDown={(e) => e.key === "Enter" && commitThreshold()}
            className="w-16 sd-input rounded-md px-2 py-1 text-sm tabular-nums text-center"
          />
          <span className="text-sm sd-text-2">% toward the streak</span>
        </div>
        <p className="mt-1.5 text-xs sd-text-4">Press Enter or click away to apply.</p>
      </section>
    </div>
  );
}

function DayDetailPanel({ day }: { day: Day }) {
  const pct = day.total > 0 ? Math.round((day.score / day.total) * 100) : 0;

  const catMap: Record<string, { done: number; total: number }> = {};
  for (const t of day.tasks) {
    const cat = t.category || "Uncategorized";
    if (!catMap[cat]) catMap[cat] = { done: 0, total: 0 };
    catMap[cat].total += t.weight;
    if (t.completed) catMap[cat].done += t.weight;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="text-2xl font-semibold tabular-nums">
          {pct}<span className="sd-text-3 text-base">%</span>
        </div>
        <div className="text-xs sd-text-3">
          {day.score}/{day.total} pts · {day.tasks.length} tasks · {day.status}
        </div>
      </div>

      {day.tasks.length > 0 && (
        <div className="space-y-1">
          {day.tasks.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </div>
      )}

      {day.note && (
        <div className="rounded-md border sd-border bg-[var(--surface-2)] px-3 py-2">
          <div className="text-xs sd-text-4 uppercase tracking-wider mb-1">Reflection</div>
          <p className="text-sm sd-text-3 leading-relaxed">{day.note}</p>
        </div>
      )}

      {Object.keys(catMap).length > 1 && (
        <div className="border-t sd-divider pt-3 space-y-2">
          <div className="text-xs sd-text-4 uppercase tracking-wider">By category</div>
          {Object.entries(catMap).map(([cat, v]) => {
            const p = v.total > 0 ? Math.round((v.done / v.total) * 100) : 0;
            return (
              <div key={cat} className="flex items-center gap-2 text-xs">
                <CategoryBadge cat={cat} />
                <div className="flex-1 h-1 bg-[var(--surface-2)] rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--accent)] rounded-full" style={{ width: `${p}%` }} />
                </div>
                <span className="sd-text-3 tabular-nums w-8 text-right">{p}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TaskRow({ task }: { task: Task }) {
  return (
    <div className={`flex items-center gap-2 py-1 px-2 rounded text-sm ${task.completed ? "opacity-100" : "opacity-50"}`}>
      <span className={task.completed ? "text-emerald-400" : "text-red-500"}>
        {task.completed ? "✓" : "✗"}
      </span>
      <span className={`flex-1 ${task.completed ? "sd-text-1" : "sd-text-3 line-through"}`}>
        {task.title}
      </span>
      {task.category && <CategoryBadge cat={task.category} />}
      <span className="text-xs sd-text-4 tabular-nums">{task.weight}pt</span>
    </div>
  );
}

function Heatmap({
  rows,
  range,
  threshold,
  selectedDate,
  onSelect,
  heatmapHigh,
  heatmapMid,
}: {
  rows: HistoryEntry[];
  range: number;
  threshold: number;
  selectedDate: string | null;
  onSelect: (date: string) => void;
  heatmapHigh: string;
  heatmapMid: string;
}) {
  const thresholdFrac = threshold / 100;
  return (
    <div>
      <div className="text-xs uppercase tracking-wider sd-text-3 mb-2">
        {range}-day heatmap · <span className="normal-case sd-text-4">click a day to see details</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {rows.map((r) => {
          const pct = r.locked && r.total > 0 ? r.score / r.total : 0;
          const isSelected = r.date === selectedDate;
          const bg = !r.locked
            ? "bg-[var(--surface-1)] border-[var(--border-1)]"
            : pct >= thresholdFrac
            ? heatmapHigh
            : pct >= thresholdFrac * 0.75
            ? heatmapMid
            : pct >= 0.4
            ? "bg-amber-700/70 border-amber-700"
            : "bg-red-900/60 border-red-900";
          return (
            <button
              key={r.date}
              title={`${r.date} — ${r.locked ? `${r.score}/${r.total} pts (${r.total > 0 ? Math.round((r.score / r.total) * 100) : 0}%)` : "not locked"}`}
              onClick={() => onSelect(r.date)}
              className={`w-6 h-6 rounded border ${bg} transition-all ${
                isSelected ? "ring-2 ring-white/60 scale-110" : "hover:scale-110"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
