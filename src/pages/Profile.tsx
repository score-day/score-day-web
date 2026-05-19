import { useEffect, useRef, useState } from "react";
import { api, OfflineError } from "../lib/api";
import type { Theme } from "../lib/theme";
import type { Challenge, Friend, Stats } from "../lib/types";

const THEMES: { id: Theme; label: string; icon: string; desc: string }[] = [
  { id: "light",         label: "Clarity",         icon: "☀️",  desc: "Clean & focused" },
  { id: "dark-knight",   label: "Dark Knight",      icon: "🌑",  desc: "Tactical & precise" },
  { id: "solo-leveling", label: "Shadow Sovereign", icon: "⚔️",  desc: "Hunter system" },
];

interface Props {
  theme: Theme;
  onThemeChange: (t: Theme) => void;
  onLogout: () => void;
}

export default function ProfilePage({ theme, onThemeChange, onLogout }: Props) {
  const [username, setUsername] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsErr, setStatsErr] = useState<string | null>(null);

  // Friends state
  const [friends, setFriends] = useState<Friend[]>([]);
  const [addInput, setAddInput] = useState("");
  const [addErr, setAddErr] = useState<string | null>(null);
  const [addBusy, setAddBusy] = useState(false);
  const [friendErr, setFriendErr] = useState<string | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Challenge state
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [challengingId, setChallengingId] = useState<number | null>(null);
  const [chalThreshold, setChalThreshold] = useState(80);
  const [chalDays, setChalDays] = useState(7);
  const [chalBusy, setChalBusy] = useState(false);
  const [chalErr, setChalErr] = useState<string | null>(null);

  // Assign task state
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [assignTitle, setAssignTitle] = useState("");
  const [assignWeight, setAssignWeight] = useState<number | "">(10);
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignErr, setAssignErr] = useState<string | null>(null);
  const [assignSentId, setAssignSentId] = useState<number | null>(null);

  useEffect(() => {
    api.me().then((u) => {
      setUsername(u.username);
      setEmail(u.email);
      setPlayerId(u.player_id);
    }).catch(() => {});
    api.stats().then(setStats).catch((e) => setStatsErr((e as Error).message));
    api.friends().then(setFriends).catch((e) => setFriendErr((e as Error).message));
    api.challenges().then(setChallenges).catch(() => {});
  }, []);

  useEffect(() => () => { if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current); }, []);

  function handleCopyId() {
    if (!playerId) return;
    navigator.clipboard?.writeText(playerId).catch(() => {});
    setCopied(true);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
  }

  function startEditName() {
    setDraftName(username ?? "");
    setEditingName(true);
  }

  async function saveName() {
    const trimmed = draftName.trim();
    setSaving(true);
    setSaveErr(null);
    try {
      const updated = await api.updateMe({ username: trimmed || null });
      setUsername(updated.username);
      setEditingName(false);
    } catch (e) {
      if (e instanceof OfflineError) {
        setUsername(trimmed || null);
        setEditingName(false);
      } else {
        setSaveErr((e as Error).message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleAddFriend() {
    const pid = addInput.trim().toUpperCase();
    if (!pid) return;
    setAddBusy(true);
    setAddErr(null);
    try {
      const f = await api.sendFriendRequest(pid);
      setFriends((prev) => [...prev, f]);
      setAddInput("");
    } catch (e) {
      setAddErr((e as Error).message);
    } finally {
      setAddBusy(false);
    }
  }

  async function handleAccept(id: number) {
    try {
      const updated = await api.acceptFriend(id);
      setFriends((prev) => prev.map((f) => (f.id === id ? updated : f)));
    } catch (e) {
      setFriendErr((e as Error).message);
    }
  }

  async function handleRemove(id: number) {
    try {
      await api.removeFriend(id);
      setFriends((prev) => prev.filter((f) => f.id !== id));
    } catch (e) {
      setFriendErr((e as Error).message);
    }
  }

  function startAssign(friendshipId: number) {
    setAssigningId(friendshipId);
    setAssignTitle("");
    setAssignWeight(10);
    setAssignErr(null);
    setAssignSentId(null);
  }

  function cancelAssign() {
    setAssigningId(null);
    setAssignErr(null);
  }

  async function handleAssign(f: Friend) {
    if (!assignTitle.trim() || assignWeight === "") return;
    setAssignBusy(true);
    setAssignErr(null);
    try {
      await api.sendFriendTask(f.player_id, assignTitle.trim(), Number(assignWeight));
      setAssignSentId(f.id);
      setAssigningId(null);
    } catch (e) {
      setAssignErr((e as Error).message);
    } finally {
      setAssignBusy(false);
    }
  }

  function startChallenge(friendshipId: number) {
    setChallengingId(friendshipId);
    setChalThreshold(80);
    setChalDays(7);
    setChalErr(null);
    setAssigningId(null);
  }

  function cancelChallenge() {
    setChallengingId(null);
    setChalErr(null);
  }

  async function handleChallenge(f: Friend) {
    setChalBusy(true);
    setChalErr(null);
    try {
      const c = await api.sendChallenge(f.player_id, chalThreshold, chalDays);
      setChallenges((prev) => [c, ...prev]);
      setChallengingId(null);
    } catch (e) {
      setChalErr((e as Error).message);
    } finally {
      setChalBusy(false);
    }
  }

  async function handleAcceptChallenge(id: number) {
    try {
      const updated = await api.acceptChallenge(id);
      setChallenges((prev) => prev.map((c) => (c.id === id ? updated : c)));
    } catch (e) {
      setChalErr((e as Error).message);
    }
  }

  async function handleDeclineChallenge(id: number) {
    const target = challenges.find((c) => c.id === id);
    try {
      await api.declineChallenge(id);
      if (target?.status === "active") {
        // Backend sets status="failed" and keeps the row — reflect that locally
        // so it stays visible with a Dismiss button rather than vanishing and reappearing.
        setChallenges((prev) => prev.map((c) => c.id === id ? { ...c, status: "failed" as const } : c));
      } else {
        // Backend hard-deletes pending/completed/failed rows — remove from UI.
        setChallenges((prev) => prev.filter((c) => c.id !== id));
      }
    } catch (e) {
      setChalErr((e as Error).message);
    }
  }

  const displayName = username || "Scorer";
  const accepted = friends.filter((f) => f.direction === "friends");
  const incoming = friends.filter((f) => f.direction === "received");
  const outgoing = friends.filter((f) => f.direction === "sent");

  return (
    <div className="space-y-8 max-w-md">
      {/* ── Identity ── */}
      <section>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[var(--surface-2)] border sd-border flex items-center justify-center text-2xl font-bold sd-text-2 select-none">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveName();
                      if (e.key === "Escape") setEditingName(false);
                    }}
                    disabled={saving}
                    className="sd-input rounded px-2 py-1 text-sm w-40"
                    placeholder="Your name"
                    maxLength={40}
                  />
                  <button
                    onClick={saveName}
                    disabled={saving}
                    className="text-xs px-2 py-1 sd-btn-surface rounded sd-text-2"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={() => { setEditingName(false); setSaveErr(null); }}
                    disabled={saving}
                    className="text-xs sd-text-4 hover:text-[var(--text-2)] transition"
                  >
                    Cancel
                  </button>
                </div>
                {saveErr && <div className="text-xs text-red-400">{saveErr}</div>}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold sd-text-1">{displayName}</span>
                <button
                  onClick={startEditName}
                  className="text-xs sd-text-4 hover:text-[var(--text-2)] underline transition"
                >
                  edit
                </button>
              </div>
            )}
            {email && <div className="text-xs sd-text-4 mt-0.5">{email}</div>}
          </div>
        </div>

        {/* Player ID */}
        {playerId && (
          <div className="mt-4 flex items-center gap-3 rounded-lg bg-[var(--surface-2)] border sd-border px-3 py-2.5">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-wider sd-text-4 mb-0.5">Your Player ID</div>
              <div className="font-mono text-sm font-semibold sd-text-1 tracking-widest">{playerId}</div>
            </div>
            <button
              onClick={handleCopyId}
              className="shrink-0 text-xs px-2.5 py-1.5 rounded sd-btn-surface sd-text-2 transition-all"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        )}
      </section>

      {/* ── Theme selector ── */}
      <section>
        <div className="text-xs uppercase tracking-wider sd-text-3 mb-3">Theme</div>
        <div className="grid grid-cols-3 gap-2">
          {THEMES.map((t) => {
            const isActive = theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onThemeChange(t.id)}
                className={
                  "flex flex-col items-center gap-1.5 rounded-xl border px-3 py-4 text-center transition-all " +
                  (isActive
                    ? "border-[var(--accent)] bg-[var(--surface-2)]"
                    : "sd-border bg-[var(--surface-1)] hover:bg-[var(--surface-2)]")
                }
              >
                <span className="text-2xl">{t.icon}</span>
                <span className={`text-xs font-semibold ${isActive ? "sd-accent" : "sd-text-2"}`}>
                  {t.label}
                </span>
                <span className="text-[10px] sd-text-4 leading-tight">{t.desc}</span>
                {isActive && (
                  <span className="mt-0.5 inline-block w-4 h-0.5 rounded-full bg-[var(--accent)]" />
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Friends ── */}
      <section>
        <div className="text-xs uppercase tracking-wider sd-text-3 mb-3">Friends</div>

        {/* Add by player ID */}
        <div className="flex gap-2 mb-4">
          <input
            value={addInput}
            onChange={(e) => { setAddInput(e.target.value.toUpperCase()); setAddErr(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddFriend(); }}
            placeholder="Enter Player ID"
            maxLength={10}
            className="sd-input rounded px-3 py-2 text-sm flex-1 font-mono tracking-wider uppercase"
            disabled={addBusy}
          />
          <button
            onClick={handleAddFriend}
            disabled={addBusy || !addInput.trim()}
            className="px-3 py-2 text-sm rounded sd-btn-accent font-medium"
          >
            {addBusy ? "…" : "Add"}
          </button>
        </div>
        {addErr && <div className="text-xs text-red-400 mb-3">{addErr}</div>}
        {friendErr && <div className="text-xs text-red-400 mb-3">{friendErr}</div>}

        {/* Incoming requests */}
        {incoming.length > 0 && (
          <div className="mb-3">
            <div className="text-[10px] uppercase tracking-wider sd-text-4 mb-2">Requests</div>
            <div className="space-y-2">
              {incoming.map((f) => (
                <div key={f.id} className="flex items-center gap-3 rounded-lg sd-surface border px-3 py-2.5">
                  <FriendAvatar name={f.username || f.player_id} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium sd-text-1 truncate">{f.username || f.player_id}</div>
                    <div className="text-[10px] font-mono sd-text-4">{f.player_id}</div>
                  </div>
                  <button
                    onClick={() => handleAccept(f.id)}
                    className="text-xs px-2.5 py-1 rounded sd-btn-accent font-medium"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleRemove(f.id)}
                    className="text-xs px-2 py-1 rounded sd-btn-surface sd-text-3"
                  >
                    Decline
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sent pending */}
        {outgoing.length > 0 && (
          <div className="mb-3">
            <div className="text-[10px] uppercase tracking-wider sd-text-4 mb-2">Pending</div>
            <div className="space-y-2">
              {outgoing.map((f) => (
                <div key={f.id} className="flex items-center gap-3 rounded-lg sd-surface border px-3 py-2.5">
                  <FriendAvatar name={f.username || f.player_id} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm sd-text-2 truncate">{f.username || f.player_id}</div>
                    <div className="text-[10px] font-mono sd-text-4">{f.player_id}</div>
                  </div>
                  <span className="text-[10px] sd-text-4">Waiting…</span>
                  <button
                    onClick={() => handleRemove(f.id)}
                    className="text-xs px-2 py-1 rounded sd-btn-surface sd-text-3"
                  >
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Accepted friends */}
        {accepted.length > 0 ? (
          <div className="space-y-2">
            {accepted.map((f) => (
              <div key={f.id} className="rounded-lg sd-surface border px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <FriendAvatar name={f.username || f.player_id} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium sd-text-1 truncate">{f.username || f.player_id}</div>
                    <div className="text-[10px] font-mono sd-text-4">{f.player_id}</div>
                  </div>
                  {f.streak > 0 && (
                    <span className="text-xs sd-text-3">🔥 {f.streak}</span>
                  )}
                  {assignSentId === f.id ? (
                    <span className="text-xs text-emerald-400">Sent!</span>
                  ) : (
                    <button
                      onClick={() => assigningId === f.id ? cancelAssign() : (setChallengingId(null), startAssign(f.id))}
                      className="text-xs sd-text-3 hover:text-[var(--text-1)] transition"
                    >
                      {assigningId === f.id ? "Cancel" : "Assign"}
                    </button>
                  )}
                  <button
                    onClick={() => challengingId === f.id ? cancelChallenge() : (setAssigningId(null), startChallenge(f.id))}
                    className="text-xs sd-text-3 hover:text-[var(--text-1)] transition"
                  >
                    {challengingId === f.id ? "Cancel" : "Challenge"}
                  </button>
                  <button
                    onClick={() => handleRemove(f.id)}
                    className="text-xs sd-text-4 hover:text-red-400 transition"
                  >
                    Remove
                  </button>
                </div>

                {assigningId === f.id && (
                  <div className="mt-2 pt-2 border-t sd-border space-y-1.5">
                    <input
                      autoFocus
                      value={assignTitle}
                      onChange={(e) => setAssignTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAssign(f); if (e.key === "Escape") cancelAssign(); }}
                      placeholder="Task name…"
                      maxLength={200}
                      disabled={assignBusy}
                      className="sd-input rounded px-2.5 py-1.5 text-sm w-full"
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={1}
                        value={assignWeight}
                        onChange={(e) => setAssignWeight(e.target.value === "" ? "" : Number(e.target.value))}
                        disabled={assignBusy}
                        className="sd-input rounded px-2.5 py-1.5 text-sm w-20 tabular-nums"
                        placeholder="pts"
                      />
                      <button
                        onClick={() => handleAssign(f)}
                        disabled={assignBusy || !assignTitle.trim() || assignWeight === ""}
                        className="flex-1 py-1.5 rounded sd-btn-accent text-xs font-medium"
                      >
                        {assignBusy ? "Sending…" : "Send task"}
                      </button>
                    </div>
                    {assignErr && <div className="text-xs text-red-400">{assignErr}</div>}
                  </div>
                )}

                {challengingId === f.id && (
                  <div className="mt-2 pt-2 border-t sd-border space-y-2">
                    <div className="text-[10px] sd-text-4 uppercase tracking-wider">Challenge settings</div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <div className="text-xs sd-text-3 mb-1">Score threshold</div>
                        <div className="flex items-center gap-2">
                          <input
                            type="range" min={50} max={100} step={5}
                            value={chalThreshold}
                            onChange={(e) => setChalThreshold(Number(e.target.value))}
                            className="flex-1 accent-[var(--accent)]"
                          />
                          <span className="text-xs tabular-nums sd-text-2 w-8 text-right">{chalThreshold}%</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="text-xs sd-text-3 mb-1">Duration</div>
                        <div className="flex items-center gap-2">
                          <input
                            type="range" min={3} max={30} step={1}
                            value={chalDays}
                            onChange={(e) => setChalDays(Number(e.target.value))}
                            className="flex-1 accent-[var(--accent)]"
                          />
                          <span className="text-xs tabular-nums sd-text-2 w-8 text-right">{chalDays}d</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs sd-text-4 text-center">
                      Both hit ≥{chalThreshold}% every day for {chalDays} days
                    </div>
                    <button
                      onClick={() => handleChallenge(f)}
                      disabled={chalBusy}
                      className="w-full py-1.5 rounded sd-btn-accent text-xs font-medium"
                    >
                      {chalBusy ? "Sending…" : "Send challenge"}
                    </button>
                    {chalErr && <div className="text-xs text-red-400">{chalErr}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          friends.length === 0 && !friendErr && (
            <div className="text-sm sd-text-4 text-center py-4">
              Share your Player ID to connect with friends
            </div>
          )
        )}
      </section>

      {/* ── Challenges ── */}
      {challenges.length > 0 && (
        <section>
          <div className="text-xs uppercase tracking-wider sd-text-3 mb-3">Challenges</div>
          {chalErr && <div className="text-xs text-red-400 mb-2">{chalErr}</div>}
          <div className="space-y-3">
            {challenges.map((c) => (
              <ChallengeCard
                key={c.id}
                c={c}
                onAccept={() => handleAcceptChallenge(c.id)}
                onDecline={() => handleDeclineChallenge(c.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Stats ── */}
      <section>
        <div className="text-xs uppercase tracking-wider sd-text-3 mb-4">All-time stats</div>
        {statsErr && <div className="text-sm text-red-400">{statsErr}</div>}
        {!stats && !statsErr && <div className="text-sm sd-text-3">Loading…</div>}
        {stats && (
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Days scored"    value={String(stats.total_days)} />
            <StatCard label="Longest streak" value={`${stats.longest_streak} days`} />
            <StatCard label="7-day avg"      value={`${stats.avg_7d}%`} />
            <StatCard label="30-day avg"     value={`${stats.avg_30d}%`} />
          </div>
        )}
      </section>

      {/* ── About ── */}
      <section className="border-t sd-divider pt-6">
        <div className="text-xs uppercase tracking-wider sd-text-3 mb-3">About</div>
        <div className="space-y-1 text-sm sd-text-3">
          <p>Score Day — rate your productivity, one day at a time.</p>
          <p className="sd-text-4 text-xs mt-2">v2.8.0</p>
        </div>
      </section>

      {/* ── Sign out ── */}
      <section className="border-t sd-divider pt-6 pb-2">
        <button
          onClick={onLogout}
          className="w-full py-2.5 rounded-lg border border-red-900/50 text-red-400 text-sm font-medium hover:bg-red-950/30 transition"
        >
          Sign out
        </button>
      </section>
    </div>
  );
}

function ChallengeCard({ c, onAccept, onDecline }: { c: Challenge; onAccept: () => void; onDecline: () => void }) {
  const otherName = c.other_username || c.other_player_id;
  const isActive = c.status === "active";
  const isPending = c.status === "pending";
  const isReceived = c.direction === "received";

  const statusColor =
    c.status === "completed" ? "text-emerald-400" :
    c.status === "failed"    ? "text-red-400" :
    c.status === "active"    ? "sd-accent" :
    "sd-text-4";

  const statusLabel =
    c.status === "completed" ? "Completed!" :
    c.status === "failed"    ? "Failed" :
    c.status === "active"    ? `Day ${c.days_elapsed ?? 0}/${c.days}` :
    isReceived               ? "Incoming" : "Waiting";

  return (
    <div className="rounded-lg sd-surface border px-3 py-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-medium sd-text-1">
            {isReceived ? `${otherName} challenged you` : `You challenged ${otherName}`}
          </div>
          <div className="text-xs sd-text-4 mt-0.5">≥{c.threshold}% · {c.days} days</div>
        </div>
        <span className={`text-xs font-medium shrink-0 ${statusColor}`}>{statusLabel}</span>
      </div>

      {/* Progress bars — shown when active/completed/failed */}
      {(isActive || c.status === "completed" || c.status === "failed") && c.days_elapsed != null && (
        <div className="space-y-1.5">
          <ProgressRow label="You" hit={c.my_days_hit ?? 0} total={c.days} />
          <ProgressRow label={otherName} hit={c.their_days_hit ?? 0} total={c.days} />
        </div>
      )}

      {/* Accept/Decline for incoming pending */}
      {isPending && isReceived && (
        <div className="flex gap-2 pt-1">
          <button onClick={onAccept} className="flex-1 py-1.5 rounded sd-btn-accent text-xs font-medium">
            Accept
          </button>
          <button onClick={onDecline} className="flex-1 py-1.5 rounded sd-btn-surface text-xs sd-text-3">
            Decline
          </button>
        </div>
      )}
      {/* Cancel for sent pending */}
      {isPending && !isReceived && (
        <button onClick={onDecline} className="text-xs sd-text-4 hover:text-red-400 transition">
          Cancel
        </button>
      )}
      {/* Dismiss for completed/failed — backend hard-deletes these */}
      {(c.status === "completed" || c.status === "failed") && (
        <button onClick={onDecline} className="text-xs sd-text-4 hover:text-[var(--text-2)] transition">
          Dismiss
        </button>
      )}
    </div>
  );
}

function ProgressRow({ label, hit, total }: { label: string; hit: number; total: number }) {
  const pct = total > 0 ? (hit / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] sd-text-4 w-16 truncate shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-[var(--surface-3)] overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="text-[10px] tabular-nums sd-text-3 shrink-0">{hit}/{total}</span>
    </div>
  );
}

function FriendAvatar({ name }: { name: string }) {
  return (
    <div className="w-8 h-8 rounded-full bg-[var(--surface-3)] border sd-border flex items-center justify-center text-xs font-bold sd-text-2 shrink-0 select-none">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="sd-surface rounded-lg border p-4">
      <div className="text-xs sd-text-3 mb-1">{label}</div>
      <div className="text-xl font-semibold tabular-nums sd-text-1">{value}</div>
    </div>
  );
}
