import { useEffect, useState } from "react";
import { isOnline, addNetworkListener, initNetwork } from "../lib/network";

export function useNetwork(): { online: boolean } {
  const [online, setOnline] = useState(isOnline);

  useEffect(() => {
    initNetwork(); // idempotent — safe to call multiple times
    return addNetworkListener(setOnline);
  }, []);

  return { online };
}
