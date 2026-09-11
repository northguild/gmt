/**
 * The usage ledger — what has been spent today, per brain and per visitor.
 *
 * ## Why this is advisory, and why that is fine
 *
 * Every number here is a *best guess*, never a gate. The only thing that
 * actually refuses a request is the provider's own error; this ledger exists to
 *
 *   1. pick a brain that probably still has budget, instead of burning a
 *      round trip discovering it does not, and
 *   2. tell the reader honestly what is left.
 *
 * That is what makes Workers KV the right store despite being eventually
 * consistent. A count that lags by one changes a digit in a badge — it cannot
 * let through anything a provider would refuse, because the provider is still
 * asked. A Durable Object's strong consistency would buy nothing here and is
 * not free.
 *
 * ## Whose day?
 *
 * A brain's keys are bucketed by *its provider's* day — Pacific for Gemini, UTC
 * for Workers AI (`BRAIN_PROVIDERS`) — so its count refills and its spent mark
 * expires when that provider's allowance actually does. Bucketing everything by
 * the Pacific day left a refilled Workers AI pool reading as used for up to
 * eight hours, and let a spent mark set after UTC midnight vanish early at the
 * Pacific rollover. The visitor cap is Dox's own and stays on the Pacific day.
 *
 * ## Every write is best-effort
 *
 * A ledger failure must never fail a chat. KV limits writes to a single key to
 * roughly one per second, which is irrelevant at the tens-per-day this Worker
 * is capped at, but it means a burst CAN throw — and the correct response to
 * "I could not record that you asked a question" is to answer the question
 * anyway. Every mutation here swallows its error and reports it to the console.
 *
 * ## Privacy
 *
 * Visitor buckets are keyed on a truncated SHA-256 of the IP, never the IP.
 * The ledger only needs to tell two visitors apart for a day; it has no reason
 * to be able to name either of them.
 */
import {
  BRAIN_PROVIDERS,
  type Brain,
  type BrainProvider,
} from "../src/lib/chat-constants";
import {
  dayKey,
  nextMidnightMs,
  ptDayKey,
  secondsUntilMidnight,
  secondsUntilPtReset,
} from "../src/lib/pt-day";

/** The subset of KVNamespace this module uses — hand-declared for the same
 * reason `worker/index.ts` hand-declares `Fetcher`: this Worker touches a
 * handful of binding methods and has not needed the full types package. */
export interface UsageStore {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
}

/** Why a brain is not currently usable. */
export type BrainState = "ok" | "spent" | "unavailable";

/** What the ledger needs to know about a brain: which one, and whose clock. */
export type LedgerBrain = Pick<Brain, "id" | "provider">;

export interface UsageSnapshot {
  /** Requests recorded against each brain today. */
  perBrain: Record<string, number>;
  /** Brains known to be out of budget or missing, today. */
  states: Record<string, BrainState>;
  /** Requests this visitor has spent today. */
  visitor: number;
}

/** When one provider's daily allowance next refills. */
export interface ProviderReset {
  id: BrainProvider;
  label: string;
  /** ISO instant of the provider's next midnight. */
  resetsAt: string;
}

/** The day bucket and key TTL for a brain, on its provider's clock. */
function brainClock(
  brain: LedgerBrain,
  nowMs: number,
): { day: string; ttl: number } {
  const { resetTimeZone } = BRAIN_PROVIDERS[brain.provider];
  return {
    day: dayKey(nowMs, resetTimeZone),
    ttl: secondsUntilMidnight(nowMs, resetTimeZone),
  };
}

function brainCountKey(day: string, brainId: string): string {
  return `model:${day}:${brainId}`;
}

function brainStateKey(day: string, brainId: string): string {
  return `state:${day}:${brainId}`;
}

function visitorKey(day: string, visitorHash: string): string {
  return `visitor:${day}:${visitorHash}`;
}

/**
 * Each provider behind `brains`, once, in the order its first brain appears,
 * with the instant its allowance next refills.
 *
 * Only providers that have a brain in the list are included, so a deployment
 * without a Gemini key never advertises Gemini's reset.
 */
export function providerResets(
  brains: readonly LedgerBrain[],
  nowMs: number,
): ProviderReset[] {
  const providers = [...new Set(brains.map((brain) => brain.provider))];
  return providers.map((id) => ({
    id,
    label: BRAIN_PROVIDERS[id].label,
    resetsAt: new Date(
      nextMidnightMs(nowMs, BRAIN_PROVIDERS[id].resetTimeZone),
    ).toISOString(),
  }));
}

/**
 * A stable, non-reversible id for a visitor.
 *
 * SHA-256 truncated to 16 hex chars: enough to keep collisions negligible at
 * this scale, short enough to keep keys small, and one-way so the ledger never
 * holds an address.
 */
export async function hashVisitor(clientId: string): Promise<string> {
  const bytes = new TextEncoder().encode(`dox:${clientId}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .slice(0, 8)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function toCount(raw: string | null): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

/**
 * Read everything the selector and the badge need, in one pass.
 *
 * Reads are parallel because they are independent, and a rejected read is
 * treated as "no record" — an unreadable ledger should degrade to optimism
 * (try the brain, let the provider decide) rather than locking Dox out.
 */
export async function readUsage(
  store: UsageStore,
  brains: readonly LedgerBrain[],
  visitorHash: string,
  nowMs: number,
): Promise<UsageSnapshot> {
  const safeGet = async (key: string): Promise<string | null> => {
    try {
      return await store.get(key);
    } catch (error) {
      console.error("usage read failed", key, error);
      return null;
    }
  };

  const days = brains.map((brain) => brainClock(brain, nowMs).day);

  const [counts, states, visitorRaw] = await Promise.all([
    Promise.all(
      brains.map((brain, index) =>
        safeGet(brainCountKey(days[index], brain.id)),
      ),
    ),
    Promise.all(
      brains.map((brain, index) =>
        safeGet(brainStateKey(days[index], brain.id)),
      ),
    ),
    safeGet(visitorKey(ptDayKey(nowMs), visitorHash)),
  ]);

  const perBrain: Record<string, number> = {};
  const stateMap: Record<string, BrainState> = {};

  brains.forEach(({ id }, index) => {
    perBrain[id] = toCount(counts[index]);
    const raw = states[index];
    stateMap[id] = raw === "spent" || raw === "unavailable" ? raw : "ok";
  });

  return { perBrain, states: stateMap, visitor: toCount(visitorRaw) };
}

/**
 * Record one request against a brain and a visitor.
 *
 * Read-then-write, so it can lose an increment under concurrency. That is
 * accepted: see this module's header — the count is advisory, and losing one
 * costs a badge digit, not correctness.
 */
export async function recordRequest(
  store: UsageStore,
  brain: LedgerBrain,
  visitorHash: string,
  nowMs: number,
): Promise<void> {
  const { day, ttl } = brainClock(brain, nowMs);

  const bump = async (key: string, expirationTtl: number): Promise<void> => {
    const next = toCount(await store.get(key)) + 1;
    await store.put(key, String(next), { expirationTtl });
  };

  const writes: [key: string, expirationTtl: number][] = [
    [brainCountKey(day, brain.id), ttl],
    [visitorKey(ptDayKey(nowMs), visitorHash), secondsUntilPtReset(nowMs)],
  ];

  await Promise.all(
    writes.map(([key, expirationTtl]) =>
      bump(key, expirationTtl).catch((error) => {
        // Never fail a chat because bookkeeping failed.
        console.error("usage write failed", key, error);
      }),
    ),
  );
}

/**
 * Mark a brain as out for the rest of its provider's day.
 *
 * `spent` comes from an exhausted quota (it returns at the provider's
 * midnight); `unavailable` from a model this account cannot call at all. Both
 * are day-scoped: a withdrawn model is re-probed tomorrow, which costs one
 * request and keeps the registry self-healing rather than needing a code change.
 */
export async function markBrain(
  store: UsageStore,
  brain: LedgerBrain,
  state: Exclude<BrainState, "ok">,
  nowMs: number,
): Promise<void> {
  const { day, ttl } = brainClock(brain, nowMs);
  try {
    await store.put(brainStateKey(day, brain.id), state, {
      expirationTtl: ttl,
    });
  } catch (error) {
    console.error("usage mark failed", brain.id, state, error);
  }
}
