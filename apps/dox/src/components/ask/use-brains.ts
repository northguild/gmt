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
 *
 * One page holds one copy of the counts, however many chats it mounts: a deck
 * has a chat on each Dox slide, and a question asked on one changes what every
 * other shows. Each mount re-reads, and reads that overlap share one request.
 * The copy is dropped when the page's last chat unmounts.
 */
import { useEffect, useSyncExternalStore } from "react";
import type { BrainsInfo } from "~/lib/chat-types";
import { withBase } from "~/lib/site";

export type { BrainsInfo, BrainStatus, ProviderStatus } from "~/lib/chat-types";
export type BrainState = BrainsInfo["brains"][number]["state"];

/** Whether the counts have arrived: `unreachable` once a read has failed with none in hand. */
type BrainsStatus = "loading" | "ready" | "unreachable";

interface Counts {
  info: BrainsInfo | null;
  failed: boolean;
}

const NONE: Counts = { info: null, failed: false };
let counts = NONE;
let reading: Promise<void> | null = null;
/* Bumped when the copy is dropped, so a read started before it cannot write after. */
let generation = 0;
const listeners = new Set<() => void>();

function set(next: Counts): void {
  counts = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    counts = NONE;
    reading = null;
    generation += 1;
  };
}

async function read(): Promise<void> {
  const mine = generation;
  let next: Counts;
  try {
    const response = await fetch(withBase("/api/brains"), {
      headers: { accept: "application/json" },
    });
    next = response.ok
      ? { info: (await response.json()) as BrainsInfo, failed: false }
      : { ...counts, failed: true };
  } catch {
    // Left as it was — the badge disappears, the chat keeps working.
    next = { ...counts, failed: true };
  }
  if (mine === generation) set(next);
}

/** Re-reads the counts; a read already under way is shared, not repeated. */
function refresh(): Promise<void> {
  if (reading) return reading;
  const mine: Promise<void> = read().finally(() => {
    if (reading === mine) reading = null;
  });
  reading = mine;
  return mine;
}

/** Takes the counts the chat stream carried after a question. */
function apply(info: BrainsInfo): void {
  set({ ...counts, info });
}

const serverCounts = () => NONE;

export function useBrains() {
  const { info, failed } = useSyncExternalStore(
    subscribe,
    () => counts,
    serverCounts,
  );

  useEffect(() => {
    void refresh();
  }, []);

  /* Counts already in hand stay shown after a failed re-read: they are the latest known. */
  const status: BrainsStatus =
    info !== null ? "ready" : failed ? "unreachable" : "loading";
  return { info, status, refresh, apply };
}
