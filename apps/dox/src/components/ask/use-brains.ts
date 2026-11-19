/**
 * Reads `/api/brains` — what Dox has left today, and which brains are usable.
 *
 * Fetched rather than embedded at build time because the numbers change with
 * every question anyone asks. Deliberately failure-tolerant: if the endpoint is
 * unreachable (an older deploy, a Worker restart, the endpoint not existing
 * yet) the hook reports `null` and the UI simply omits the badge. A broken
 * counter must never stop someone asking a question.
 *
 * After a question the counts arrive on the chat stream instead (`apply`, fed
 * by `USAGE_PART_TYPE`): the Worker knows them the moment it records the
 * question, while a re-read of the KV ledger can lag that write by a minute.
 */
import { useCallback, useEffect, useState } from "react";
import type { BrainsInfo } from "~/lib/chat-types";
import { withBase } from "~/lib/site";

export type { BrainsInfo, BrainStatus, ProviderStatus } from "~/lib/chat-types";
export type BrainState = BrainsInfo["brains"][number]["state"];

/** Whether the counts have arrived: `unreachable` once a read has failed with none in hand. */
export type BrainsStatus = "loading" | "ready" | "unreachable";

export function useBrains() {
  const [info, setInfo] = useState<BrainsInfo | null>(null);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(withBase("/api/brains"), {
        headers: { accept: "application/json" },
      });
      if (!response.ok) return setFailed(true);
      setInfo((await response.json()) as BrainsInfo);
      setFailed(false);
    } catch {
      // Left as null — the badge disappears, the chat keeps working.
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /* Counts already in hand stay shown after a failed re-read: they are the latest known. */
  const status: BrainsStatus =
    info !== null ? "ready" : failed ? "unreachable" : "loading";
  return { info, status, refresh, apply: setInfo };
}
