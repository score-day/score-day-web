import { useEffect, useRef, useState } from "react";
import { api, OfflineError } from "../lib/api";
import { getTemplates, saveTemplate, deleteTemplate, loadTemplates } from "../lib/templates";
import { isOnline } from "../lib/network";
import type { Day, FriendActivity, FriendTask, Task, Template } from "../lib/types";
import type { Theme } from "../lib/theme";

const SOCIAL_COPY: Record<Theme, { feed: string; inbox: string; wants: string }> = {
  "light":         { feed: "Friends today",    inbox: "From friends",   wants: "wants you to" },
  "dark-knight":   { feed: "Squad status",     inbox: "Intel received", wants: "orders you to" },
  "solo-leveling": { feed: "Hunter activity",  inbox: "Guild quest",    wants: "assigned to you" },
};

const STATUS_VOCAB: Record<Theme, Record<string, string>> = {
  "light":         { Planning: "Planning", "In progress": "In progress", Done: "Done", "Not started": "Not started" },
  "dark-knight":   { Planning: "Briefing", "In progress": "Engaged", Done: "Mission done", "Not started": "Off-grid" },
  "solo-leveling": { Planning: "Preparing", "In progress": "Hunting", Done: "Quest clear", "Not started": "Resting" },
};

const CATEGORIES = ["Work", "Personal", "Health", "Learning", "Other"] as const;

const CAT_BADGE: Record<string, string> = {
  Work:     "bg-blue-500/20 text-blue-300",
  Personal: "bg-violet-500/20 text-violet-300",
  Health:   "bg-emerald-500/20 text-emerald-300",
  Learning: "bg-amber-500/20 text-amber-300",
  Other:    "bg-[var(--surface-2)] text-[var(--text-3)]",
};

function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return null;
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded mr-2 shrink-0 ${CAT_BADGE[category] ?? "bg-[var(--surface-2)] text-[var(--text-3)]"}`}>
      {category}
    </span>
  );
}

export default function DayPage({ day, onChange, theme }: { day: Day; onChange: () => void; theme: Theme }) {
  if (day.status === "planning") return <PlanView day={day} onChange={onChange} theme={theme} />;
  return <ActiveView day={day} onChange={onChange} theme={theme} />;
}

// ---------- planning ----------

function PlanView({ day, onChange, theme }: { day: Day; onChange: () => void; theme: Theme }) {
  const [title, setTitle] = useState("");
  const [weight, setWeight] = useState<number | "">("");
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [templates, setTemplates] = useState<Template[]>(() => getTemplates());
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState("");

  // Friend task inbox
  const [inbox, setInbox] = useState<FriendTask[]>([]);
  const [inboxBusy, setInboxBusy] = useState(false);

  useEffect(() => {
    loadTemplates().then(() => setTemplates(getTemplates()));
    api.friendTasksInbox().then(setInbox).catch(() => {});
  }, []);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editWeight, setEditWeight] = useState<number | "">(1);
  const [editCategory, setEditCategory] = useState("");

  const used = day.tasks.reduce((s, t) => s + t.weight, 0);
  const canStart = day.tasks.length > 0;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || weight === "") return;
    setBusy(true);
    setErr(null);
    try {
      await api.addTask(day.id, title.trim(), Number(weight), category || null);
      setTitle("");
      setWeight("");
      setCategory("");
      onChange();
    } catch (e) {
      if (e instanceof OfflineError) {
        setTitle("");
        setWeight("");
        setCategory("");
      } else {
        setErr((e as Error).message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(t: Task) {
    setBusy(true);
    try {
      await api.deleteTask(t.id);
      onChange();
    } catch (e) {
      if (!(e instanceof OfflineError)) setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleStart() {
    setBusy(true);
    setErr(null);
    try {
      await api.startDay(day.id);
      onChange();
    } catch (e) {
      if (!(e instanceof OfflineError)) setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function handleEditStart(t: Task) {
    setEditingId(t.id);
    setEditTitle(t.title);
    setEditWeight(t.weight);
    setEditCategory(t.category ?? "");
  }

  function handleEditCancel() {
    setEditingId(null);
  }

  async function handleEditSave(t: Task) {
    if (!editTitle.trim() || editWeight === "" || Number(editWeight) < 1) return;
    setBusy(true);
    setErr(null);
    try {
      await api.updateTask(t.id, {
        title: editTitle.trim(),
        weight: Number(editWeight),
        category: editCategory || null,
      });
      setEditingId(null);
      onChange();
    } catch (e) {
      if (e instanceof OfflineError) {
        setEditingId(null);
      } else {
        setErr((e as Error).message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleLoadTemplate(tpl: Template) {
    const slots = 12 - day.tasks.length;
    if (tpl.tasks.length > slots) {
      setErr(`Only ${slots} slot${slots !== 1 ? "s" : ""} remaining; template has ${tpl.tasks.length} tasks`);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await Promise.all(tpl.tasks.map((t) => api.addTask(day.id, t.title, t.weight, t.category)));
      onChange();
    } catch (e) {
      if (!(e instanceof OfflineError)) setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function handleSaveTemplate() {
    if (!saveName.trim() || day.tasks.length === 0) return;
    const tpl: Template = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      name: saveName.trim(),
      tasks: day.tasks.map((t) => ({ title: t.title, weight: t.weight, category: t.category })),
    };
    saveTemplate(tpl);
    setTemplates(getTemplates());
    setSaveName("");
    setSaving(false);
  }

  function handleDeleteTemplate(id: string) {
    deleteTemplate(id);
    setTemplates(getTemplates());
  }

  async function handleAcceptInboxTask(ft: FriendTask) {
    setInboxBusy(true);
    try {
      await api.acceptFriendTask(ft.id);
      setInbox((prev) => prev.filter((x) => x.id !== ft.id));
      onChange();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setInboxBusy(false);
    }
  }

  async function handleDeclineInboxTask(ft: FriendTask) {
    setInboxBusy(true);
    try {
      await api.declineFriendTask(ft.id);
      setInbox((prev) => prev.filter((x) => x.id !== ft.id));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setInboxBusy(false);
    }
  }

  return (
    <div className="space-y-6">

      {/* ── Friend task inbox ── */}
      {inbox.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-wider sd-text-3 mb-2">{SOCIAL_COPY[theme].inbox}</h2>
          <div className="space-y-2">
            {inbox.map((ft) => (
              <div key={ft.id} className="rounded-lg border sd-border bg-[var(--surface-1)] px-3 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] sd-text-4 mb-0.5">
                    {ft.sender_username || ft.sender_player_id} {SOCIAL_COPY[theme].wants}
                  </div>
                  <div className="text-sm font-medium sd-text-1 truncate">{ft.title}</div>
                  <div className="text-xs sd-text-3 mt-0.5">{ft.weight} pts</div>
                </div>
                <button
                  onClick={() => handleAcceptInboxTask(ft)}
                  disabled={inboxBusy}
                  className="text-xs px-2.5 py-1.5 rounded sd-btn-accent font-medium shrink-0"
                >
                  Add
                </button>
                <button
                  onClick={() => handleDeclineInboxTask(ft)}
                  disabled={inboxBusy}
                  className="text-xs sd-text-4 hover:text-[var(--text-2)] shrink-0"
                >
                  Skip
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <div>
        <div className="text-sm sd-text-3">Plan your day · {day.date}</div>
        <div className="mt-1 flex items-baseline gap-3">
          <div className="text-3xl font-semibold tabular-nums">
            {used} <span className="sd-text-3 text-xl">pts planned</span>
          </div>
          {used > 0 && (
            <div className="text-sm sd-text-2">
              {day.tasks.length} task{day.tasks.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      </div>

      <section>
        <h2 className="text-xs uppercase tracking-wider sd-text-3 mb-2">Today's tasks</h2>
        {day.tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed sd-border bg-[var(--surface-1)] px-6 py-10 text-center">
            <div className="text-3xl mb-3">📋</div>
            <div className="text-base font-medium sd-text-1 mb-1">Plan your day</div>
            <p className="text-sm sd-text-3 max-w-xs mx-auto">
              Add tasks below and assign each a weight. Your daily score will be{" "}
              <span className="sd-text-1">completed weight ÷ total weight × 100%</span>.
            </p>
            <div className="mt-4 text-xs sd-text-4">↓ Start adding tasks below</div>
          </div>
        ) : (
          <ul className="divide-y sd-border rounded-md border sd-border">
            {day.tasks.map((t) =>
              editingId === t.id ? (
                <li key={t.id} className="px-3 py-3 space-y-2 bg-[var(--surface-1)]">
                  <div className="flex gap-2">
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Escape" && handleEditCancel()}
                      className="flex-1 sd-input rounded-md px-3 py-1.5 text-sm"
                      autoFocus
                    />
                    <input
                      type="number"
                      min={1}
                      value={editWeight}
                      onChange={(e) => setEditWeight(e.target.value === "" ? "" : Number(e.target.value))}
                      onKeyDown={(e) => e.key === "Escape" && handleEditCancel()}
                      className="w-20 sd-input rounded-md px-3 py-1.5 text-sm tabular-nums"
                    />
                  </div>
                  <div className="flex gap-2 items-center">
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="sd-input rounded-md px-3 py-1.5 text-sm"
                    >
                      <option value="">No category</option>
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleEditSave(t)}
                      disabled={busy || !editTitle.trim() || editWeight === ""}
                      className="px-3 py-1.5 rounded-md sd-btn-accent text-xs font-medium"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleEditCancel}
                      className="px-3 py-1.5 rounded-md sd-text-3 text-xs hover:text-[var(--text-1)] transition"
                    >
                      Cancel
                    </button>
                  </div>
                </li>
              ) : (
                <li
                  key={t.id}
                  onClick={() => !busy && handleEditStart(t)}
                  className="flex items-center px-3 py-3 cursor-pointer active:bg-[var(--surface-2)] transition-colors"
                >
                  <CategoryBadge category={t.category} />
                  <span className="flex-1 text-sm">{t.title}</span>
                  <span className="text-sm tabular-nums sd-text-3 mr-3">{t.weight}</span>
                  {/* pencil — always visible, tap affordance */}
                  <span className="sd-text-3 mr-2 shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="1.8"
                      strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 20H8L18 10L14 6L4 16Z"/>
                      <path d="M14 6L18 10"/>
                    </svg>
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(t); }}
                    className="sd-text-4 hover:text-red-400 transition shrink-0"
                    disabled={busy}
                    aria-label="Remove task"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="1.8"
                      strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 6h16M9 6V4h6v2M7 6l1 14h8l1-14"/>
                    </svg>
                  </button>
                </li>
              )
            )}
          </ul>
        )}
      </section>

      {/* ── Templates ── */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs uppercase tracking-wider sd-text-3">Templates</h2>
          {day.tasks.length > 0 && !saving && (
            <button
              onClick={() => setSaving(true)}
              className="text-xs sd-text-3 hover:text-[var(--text-1)] transition"
            >
              + Save current
            </button>
          )}
        </div>

        {saving && (
          <div className="flex gap-2 mb-3">
            <input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Template name"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleSaveTemplate()}
              className="flex-1 sd-input rounded-md px-3 py-1.5 text-sm"
            />
            <button
              onClick={handleSaveTemplate}
              disabled={!saveName.trim()}
              className="px-3 py-1.5 rounded-md sd-btn-surface text-xs"
            >
              Save
            </button>
            <button
              onClick={() => { setSaving(false); setSaveName(""); }}
              className="px-3 py-1.5 sd-text-3 text-xs hover:text-[var(--text-1)] transition"
            >
              Cancel
            </button>
          </div>
        )}

        {templates.length === 0 ? (
          <div className="text-sm sd-text-4 italic">No templates saved yet.</div>
        ) : (
          <ul className="divide-y sd-border rounded-md border sd-border">
            {templates.map((tpl) => (
              <li key={tpl.id} className="flex items-center px-3 py-2 gap-3">
                <span className="flex-1 text-sm sd-text-1">{tpl.name}</span>
                <span className="text-xs sd-text-4">{tpl.tasks.length} tasks</span>
                <button
                  onClick={() => handleLoadTemplate(tpl)}
                  disabled={busy}
                  className="text-xs sd-text-3 hover:text-[var(--text-1)] disabled:opacity-40 transition"
                >
                  Load
                </button>
                <button
                  onClick={() => handleDeleteTemplate(tpl.id)}
                  className="text-xs sd-text-4 hover:text-red-400 transition"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Add task form ── */}
      <form onSubmit={handleAdd} className="space-y-2">
        <div className="flex gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task name"
            className="flex-1 sd-input rounded-md px-3 py-2 text-sm"
            disabled={busy}
          />
          <input
            type="number"
            min={1}
            value={weight}
            onChange={(e) => setWeight(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="pts"
            className="w-20 sd-input rounded-md px-3 py-2 text-sm tabular-nums"
            disabled={busy}
          />
        </div>
        <div className="flex gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="sd-input rounded-md px-3 py-2 text-sm"
            disabled={busy}
          >
            <option value="">No category</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button
            type="submit"
            className="px-4 py-2 rounded-md sd-btn-accent text-sm font-medium transition"
            disabled={busy || !title.trim() || weight === "" || day.tasks.length >= 12}
          >
            Add
          </button>
        </div>
      </form>

      {err && <div className="text-sm text-red-400">{err}</div>}

      <div className="pt-4 border-t sd-divider">
        <button
          onClick={handleStart}
          disabled={!canStart || busy}
          className={
            "w-full py-3 rounded-md text-sm font-medium transition " +
            (canStart
              ? "sd-btn-accent"
              : "bg-[var(--surface-2)] text-[var(--text-3)] cursor-not-allowed")
          }
        >
          {canStart ? "Start day" : "Add at least one task to start"}
        </button>
      </div>

      <FriendsFeed theme={theme} />
    </div>
  );
}

// ---------- active / locked ----------

function ActiveView({ day, onChange, theme }: { day: Day; onChange: () => void; theme: Theme }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showLockModal, setShowLockModal] = useState(false);
  const isLocked = day.status === "locked";

  async function toggle(t: Task) {
    if (isLocked) return;
    setBusy(true);
    setErr(null);
    try {
      await api.updateTask(t.id, { completed: !t.completed });
      onChange();
    } catch (e) {
      if (!(e instanceof OfflineError)) setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLock(note: string) {
    setShowLockModal(false);
    setBusy(true);
    try {
      if (note.trim()) {
        try {
          await api.saveNote(day.id, note.trim());
        } catch (noteErr) {
          if (!(noteErr instanceof OfflineError)) throw noteErr;
        }
      }
      await api.lockDay(day.id);
      onChange();
    } catch (e) {
      if (!(e instanceof OfflineError)) setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const score = day.tasks.filter((t) => t.completed).reduce((s, t) => s + t.weight, 0);
  const pct = day.total > 0 ? Math.round((score / day.total) * 100) : 0;

  const scoreColorClass =
    pct >= 80 ? "sd-score-high" :
    pct >= 50 ? "sd-score-mid" :
    "sd-text-1";

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm sd-text-3">
          {isLocked ? "Final score" : "Today"} · {day.date}
        </div>
        <div className="mt-1 flex items-baseline gap-3">
          <div className={`text-5xl font-semibold tabular-nums ${scoreColorClass}`}>
            {pct}%
          </div>
          <div className="sd-text-3 text-xl tabular-nums">{score}/{day.total} pts</div>
          {isLocked && (
            <span className="text-xs sd-text-3 px-2 py-1 rounded bg-[var(--surface-1)] border sd-border">
              locked
            </span>
          )}
        </div>
      </div>

      <ul className="divide-y sd-border rounded-md border sd-border">
        {day.tasks.map((t) => (
          <li
            key={t.id}
            onClick={() => toggle(t)}
            className={
              "flex items-center px-3 py-3 transition-colors " +
              (isLocked ? "cursor-default" : "cursor-pointer active:bg-[var(--surface-2)]") +
              (t.completed ? " opacity-60" : "")
            }
          >
            {/* visual indicator only — row handles the tap */}
            <span
              className={
                "w-5 h-5 mr-3 shrink-0 rounded border flex items-center justify-center pointer-events-none " +
                (t.completed ? "sd-check-on" : "sd-check-off")
              }
            >
              {t.completed && (
                <svg viewBox="0 0 16 16" className="w-3 h-3" fill="currentColor">
                  <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
                </svg>
              )}
            </span>
            <CategoryBadge category={t.category} />
            <span className={"flex-1 text-sm " + (t.completed ? "line-through" : "")}>
              {t.title}
            </span>
            <span className="text-sm tabular-nums sd-text-3">{t.weight}</span>
          </li>
        ))}
      </ul>

      {err && <div className="text-sm text-red-400">{err}</div>}

      {!isLocked && (
        <div className="pt-4 border-t sd-divider">
          <button
            onClick={() => setShowLockModal(true)}
            disabled={busy}
            className="w-full py-3 rounded-md sd-btn-surface text-sm"
          >
            End day &amp; lock score
          </button>
        </div>
      )}

      {isLocked && day.note && (
        <div className="rounded-md border sd-border bg-[var(--surface-1)] px-4 py-3">
          <div className="text-xs sd-text-3 mb-1 uppercase tracking-wider">Reflection</div>
          <p className="text-sm sd-text-2 leading-relaxed">{day.note}</p>
        </div>
      )}

      <FriendsFeed theme={theme} />

      {showLockModal && (
        <LockModal onLock={handleLock} onCancel={() => setShowLockModal(false)} />
      )}
    </div>
  );
}

// ── Friends activity feed — self-contained, polls every 60s ──

function FriendsFeed({ theme }: { theme: Theme }) {
  const [activity, setActivity] = useState<FriendActivity[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function fetchActivity() {
    if (!isOnline()) return;
    api.friendsActivity().then(setActivity).catch(() => {});
  }

  useEffect(() => {
    fetchActivity();
    intervalRef.current = setInterval(fetchActivity, 60_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (activity.length === 0) return null;

  return (
    <section>
      <h2 className="text-xs uppercase tracking-wider sd-text-3 mb-2">{SOCIAL_COPY[theme].feed}</h2>
      <div className="space-y-2">
        {activity.map((a) => (
          <FriendActivityCard key={a.player_id} a={a} theme={theme} />
        ))}
      </div>
    </section>
  );
}

function FriendActivityCard({ a, theme }: { a: FriendActivity; theme: Theme }) {
  const displayName = a.username || a.player_id;
  const pct = a.score_pct ?? 0;

  const statusLabel =
    a.day_status === "planning" ? "Planning" :
    a.day_status === "active"   ? "In progress" :
    a.day_status === "locked"   ? "Done" :
    "Not started";

  const statusText = STATUS_VOCAB[theme][statusLabel] ?? statusLabel;

  const pctColor =
    a.score_pct === null ? "" :
    pct >= 80 ? "sd-score-high" :
    pct >= 50 ? "sd-score-mid" :
    "sd-text-2";

  return (
    <div className="rounded-lg border sd-border bg-[var(--surface-1)] px-3 py-2.5">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[var(--surface-3)] border sd-border flex items-center justify-center text-xs font-bold sd-text-2 shrink-0 select-none">
          {displayName.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-medium sd-text-1 truncate">{displayName}</span>
            {a.streak > 0 && <span className="text-xs sd-text-3">🔥{a.streak}</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] sd-text-4">{statusText}</span>
            {a.avg_7d !== null && (
              <span className="text-[10px] sd-text-4">· 7d avg {a.avg_7d}%</span>
            )}
          </div>
        </div>

        <div className="shrink-0 text-right">
          {(a.day_status === "active" || a.day_status === "locked") ? (
            <>
              <div className={`text-base font-semibold tabular-nums ${pctColor}`}>
                {Math.round(pct)}%
              </div>
              <div className="w-14 h-1 rounded-full bg-[var(--surface-3)] mt-1 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            </>
          ) : (
            <span className="text-xs sd-text-4">—</span>
          )}
        </div>
      </div>

      {(a.assigned_task_title || a.received_task_title) && (
        <div className="mt-2 pt-2 border-t sd-border space-y-1">
          {a.assigned_task_title && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className={a.assigned_task_completed ? "sd-score-high" : "sd-text-4"}>
                {a.assigned_task_completed ? "✓" : "○"}
              </span>
              <span className="sd-text-3 truncate">
                Your task: <span className="sd-text-2">{a.assigned_task_title}</span>
              </span>
            </div>
          )}
          {a.received_task_title && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className={a.received_task_completed ? "sd-score-high" : "sd-text-4"}>
                {a.received_task_completed ? "✓" : "○"}
              </span>
              <span className="sd-text-3 truncate">
                Their task: <span className="sd-text-2">{a.received_task_title}</span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LockModal({ onLock, onCancel }: { onLock: (note: string) => void; onCancel: () => void }) {
  const [note, setNote] = useState("");
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="sd-surface border rounded-xl w-full max-w-md p-6 space-y-4">
        <div>
          <div className="text-base font-semibold sd-text-1">Lock today's score</div>
          <div className="text-sm sd-text-3 mt-0.5">How did the day go? (optional)</div>
        </div>
        <textarea
          autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Write a quick reflection — wins, blockers, how you felt…"
          rows={4}
          maxLength={500}
          className="w-full sd-input rounded-lg px-3 py-2 text-sm resize-none"
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm sd-text-3 hover:text-[var(--text-1)] transition"
          >
            Cancel
          </button>
          <button
            onClick={() => onLock("")}
            className="px-4 py-2 text-sm rounded-md sd-btn-surface"
          >
            Skip &amp; lock
          </button>
          <button
            onClick={() => onLock(note)}
            disabled={!note.trim()}
            className="px-4 py-2 text-sm rounded-md sd-btn-accent"
          >
            Save &amp; lock
          </button>
        </div>
      </div>
    </div>
  );
}
