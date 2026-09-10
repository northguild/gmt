/**
 * Reads `/api/brains` — what Dox has left today, and which brains are usable.
 *
 * Fetched rather than embedded at build time because the numbers change with
 * every question anyone asks. Deliberately failure-tolerant: if the endpoint is
 * unreachable (an older deploy, a Worker restart, the endpoint not existing
 * yet) the hook reports `null` and the UI simply omits the badge. A broken
 * counter must never stop someone asking a question.
 */
import { useCallback, useEffect, useState } from "react";

export type BrainState = "ok" | "spent" | "unavailable";

export interface BrainStatus {
  id: string;
  label: string;
  remaining: number;
  limit: number;
  state: BrainState;
}

export interface BrainsInfo {
  brains: BrainStatus[];
  activeBrainId: string | null;
  visitor: {
    used: number;
    limit: number;
    /** `null` for a dev, who is exempt from the per-visitor cap. */
    remaining: number | null;
    unlimited: boolean;
  };
  /** ISO instant of the next Pacific midnight, when the quota refills. */
  resetsAt: string;
}

export function useBrains() {
  const [info, setInfo] = useState<BrainsInfo | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/brains", {
        headers: { accept: "application/json" },
      });
      if (!response.ok) return;
      setInfo((await response.json()) as BrainsInfo);
    } catch {
      // Left as null — the badge disappears, the chat keeps working.
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { info, refresh };
}

/** "in 4 hours" / "in 12 minutes" — a relative reset is easier to act on than
 * an absolute timestamp in a timezone the reader may not live in. */
export function untilReset(resetsAt: string | undefined): string {
  if (!resetsAt) return "midnight Pacific";
  const ms = new Date(resetsAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "shortly";

  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `in ${hours} hour${hours === 1 ? "" : "s"}`;

  const minutes = Math.max(1, Math.round(ms / 60_000));
  return `in ${minutes} minute${minutes === 1 ? "" : "s"}`;
}
