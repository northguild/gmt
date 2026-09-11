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
import type { BrainProvider } from "~/lib/chat-constants";

export type BrainState = "ok" | "spent" | "unavailable";

export interface BrainStatus {
  id: string;
  label: string;
  provider: BrainProvider;
  remaining: number;
  limit: number;
  state: BrainState;
}

/** One provider behind the brains, and when its daily allowance refills —
 * midnight Pacific for Gemini, 00:00 UTC for Workers AI (DOX-C4). */
export interface ProviderStatus {
  id: BrainProvider;
  label: string;
  /** ISO instant of this provider's next reset. */
  resetsAt: string;
}

export interface BrainsInfo {
  brains: BrainStatus[];
  /** Configured providers only, in preference order. */
  providers: ProviderStatus[];
  activeBrainId: string | null;
  visitor: {
    used: number;
    limit: number;
    /** `null` for a dev, who is exempt from the per-visitor cap. */
    remaining: number | null;
    unlimited: boolean;
    /** ISO instant of the next Pacific midnight, when this visitor's own
     * questions refill. */
    resetsAt: string;
  };
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
