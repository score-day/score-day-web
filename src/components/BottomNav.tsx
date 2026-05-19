import type { Theme } from "../lib/theme";

type Tab = "day" | "history" | "profile";

const LABELS: Record<Theme, Record<Tab, string>> = {
  "light":          { day: "Today",  history: "History",    profile: "Profile" },
  "dark-knight":    { day: "Engage", history: "Objectives", profile: "Dossier" },
  "solo-leveling":  { day: "Daily",  history: "Quests",     profile: "Status"  },
};

function IconDay({ active }: { active: boolean }) {
  const w = active ? 2 : 1.5;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2"/>
      <path d="M3 9h18"/>
      <path d="M8 3v4M16 3v4"/>
      <path d="M8 14h2M12 14h2M8 17h2"/>
    </svg>
  );
}

function IconHistory({ active }: { active: boolean }) {
  const w = active ? 2 : 1.5;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19L9 13L13 16L20 7"/>
      <circle cx="9"  cy="13" r="1.4" fill="currentColor" stroke="none"/>
      <circle cx="13" cy="16" r="1.4" fill="currentColor" stroke="none"/>
      <circle cx="20" cy="7"  r="1.4" fill="currentColor" stroke="none"/>
    </svg>
  );
}

function IconProfile({ active }: { active: boolean }) {
  const w = active ? 2 : 1.5;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 21c1-5 4-7 8-7s7 2 8 7"/>
    </svg>
  );
}

interface Props {
  tab: Tab;
  setTab: (t: Tab) => void;
  theme: Theme;
}

export default function BottomNav({ tab, setTab, theme }: Props) {
  const labels = LABELS[theme];

  const items: { id: Tab; label: string; Icon: React.FC<{ active: boolean }> }[] = [
    { id: "day",     label: labels.day,     Icon: IconDay     },
    { id: "history", label: labels.history, Icon: IconHistory },
    { id: "profile", label: labels.profile, Icon: IconProfile },
  ];

  return (
    <nav className="sd-bnav">
      {items.map(({ id, label, Icon }) => {
        const active = tab === id;
        return (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`sd-bnav-item${active ? " active" : ""}`}
          >
            <span className="sd-bnav-icon">
              <Icon active={active} />
            </span>
            <span className="sd-bnav-label">{label}</span>
            {active && <span className="sd-bnav-pip" />}
          </button>
        );
      })}
    </nav>
  );
}
