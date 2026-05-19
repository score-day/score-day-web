export type DayStatus = "planning" | "active" | "locked";

export interface Task {
  id: number;
  title: string;
  weight: number;
  completed: boolean;
  completed_at: string | null;
  position: number;
  category: string | null;
}

export interface Day {
  id: number;
  date: string;
  status: DayStatus;
  score: number;
  total: number;
  started_at: string | null;
  locked_at: string | null;
  note: string | null;
  tasks: Task[];
}

export interface HistoryEntry {
  date: string;
  score: number;
  total: number;
  locked: boolean;
}

export interface Streak {
  streak: number;
  threshold: number;
}

export interface Template {
  id: string;
  name: string;
  tasks: { title: string; weight: number; category: string | null }[];
}

export interface CategoryStat {
  category: string;
  total_weight: number;
  completed_weight: number;
  task_count: number;
  completed_count: number;
}

export interface Stats {
  total_days: number;
  longest_streak: number;
  avg_7d: number;
  avg_30d: number;
}

export interface UserProfile {
  email: string;
  username: string | null;
  player_id: string | null;
}

export interface Friend {
  id: number;
  player_id: string;
  username: string | null;
  streak: number;
  direction: "sent" | "received" | "friends";
  status: "pending" | "accepted";
}

export interface FriendActivity {
  player_id: string;
  username: string | null;
  streak: number;
  avg_7d: number | null;
  day_status: "planning" | "active" | "locked" | null;
  score_pct: number | null;
  assigned_task_title: string | null;
  assigned_task_completed: boolean | null;
  received_task_title: string | null;
  received_task_completed: boolean | null;
}

export interface Challenge {
  id: number;
  threshold: number;
  days: number;
  status: "pending" | "active" | "completed" | "failed";
  start_date: string | null;
  created_at: string;
  other_player_id: string;
  other_username: string | null;
  direction: "sent" | "received";
  my_days_hit: number | null;
  their_days_hit: number | null;
  days_elapsed: number | null;
}

export interface FriendTask {
  id: number;
  date: string;
  title: string;
  weight: number;
  status: "pending" | "accepted" | "declined";
  sender_username: string | null;
  sender_player_id: string;
  receiver_username: string | null;
  receiver_player_id: string;
  assigned_task_id: number | null;
}

// ── Offline mutation queue ──

export type MutationData =
  | { type: "addTask"; dayId: number; title: string; weight: number; category: string | null; tempId: string }
  | { type: "updateTask"; taskId: number; patch: Partial<Pick<Task, "title" | "weight" | "completed" | "category">> }
  | { type: "deleteTask"; taskId: number }
  | { type: "startDay"; dayId: number }
  | { type: "lockDay"; dayId: number }
  | { type: "saveNote"; dayId: number; note: string }
  | { type: "updateMe"; patch: { username: string | null } };

// QueuedMutation distributes { id, attempts, createdAt } across each MutationData variant.
// The `type` field remains the discriminant for narrowing.
export type QueuedMutation = { id: string; attempts: number; createdAt: string } & MutationData;
