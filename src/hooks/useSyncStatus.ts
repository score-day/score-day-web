import { useEffect, useRef, useState } from "react";
import { getQueue, addQueueListener, pendingCount } from "../lib/queue";
import { addSyncListener, addSyncStartListener, isSyncing } from "../lib/sync";

export type SyncStatus = "idle" | "pending" | "syncing" | "done";

export interface SyncState {
  status: SyncStatus;
  pending: number;
}

export function useSyncStatus(): SyncState {
  const [pending, setPending] = useState(pendingCount);
  const [syncing, setSyncing] = useState(isSyncing);
  const [done, setDone] = useState(false);
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Load queue from storage so the initial pending count is accurate
    getQueue().then((q) => setPending(q.length));

    const removeQueue = addQueueListener((q) => setPending(q.length));

    const removeStart = addSyncStartListener(() => {
      setSyncing(true);
      setDone(false);
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
    });

    const removeDone = addSyncListener(() => {
      setSyncing(false);
      setDone(true);
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
      doneTimerRef.current = setTimeout(() => setDone(false), 2500);
    });

    return () => {
      removeQueue();
      removeStart();
      removeDone();
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
    };
  }, []);

  let status: SyncStatus = "idle";
  if (syncing) status = "syncing";
  else if (done) status = "done";
  else if (pending > 0) status = "pending";

  return { status, pending };
}
