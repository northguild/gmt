import { convertUnixToUtc } from "@northguild/gmt";
import { VISITOR_DAILY_MAX, type Brain } from "../src/lib/chat-constants";
import type { BrainsInfo } from "../src/lib/chat-types";
import { nextVisitorMidnightMs } from "../src/lib/pt-day";
import { chooseBrain, remainingFor } from "./brains";
import {
  providerResets,
  type BrainState,
  type LedgerBrain,
  type UsageSnapshot,
} from "./usage";

/**
 * What the badge and the selector show, from one ledger snapshot.
 *
 * One builder for both places that send it: `GET /api/brains`, and the chat
 * stream's usage part once a question has been recorded (see
 * `withRecordedRequest`).
 */
export function brainsPayload({
  brains,
  snapshot,
  nowMs,
  dev,
}: {
  brains: readonly Brain[];
  snapshot: UsageSnapshot;
  nowMs: number;
  dev: boolean;
}): BrainsInfo {
  const active = chooseBrain(snapshot, undefined, brains).brain;
  return {
    brains: brains.map((brain) => ({
      id: brain.id,
      label: brain.label,
      provider: brain.provider,
      remaining: remainingFor(brain, snapshot),
      limit: brain.dailyLimit,
      state: snapshot.states[brain.id] ?? "ok",
    })),
    /* One entry per configured provider, each with its own next midnight —
       Pacific for Gemini, UTC for Workers AI. */
    providers: providerResets(brains, nowMs),
    activeBrainId: active?.id ?? null,
    visitor: {
      used: snapshot.visitor,
      limit: VISITOR_DAILY_MAX,
      remaining: dev ? null : Math.max(0, VISITOR_DAILY_MAX - snapshot.visitor),
      // A dev is exempt from the per-visitor cap. NOT from the shared pool —
      // nothing on the free tier can raise that, and the UI says so.
      unlimited: dev,
      // The visitor cap is Dox's own and always on the UTC day.
      resetsAt: convertUnixToUtc(nextVisitorMidnightMs(nowMs)),
    },
  };
}

/**
 * The snapshot as it stands after this request: one more question for the
 * visitor and for the brain that answered, and every brain the walk marked out
 * on the way. The same increments `recordRequest` and `markBrain` write to KV,
 * applied in memory, so the reader sees them without waiting on KV's lag.
 */
export function withRecordedRequest(
  snapshot: UsageSnapshot,
  answered: LedgerBrain | undefined,
  markedOut: Readonly<Record<string, Exclude<BrainState, "ok">>>,
): UsageSnapshot {
  const perBrain = { ...snapshot.perBrain };
  if (answered) perBrain[answered.id] = (perBrain[answered.id] ?? 0) + 1;
  return {
    perBrain,
    states: { ...snapshot.states, ...markedOut },
    visitor: snapshot.visitor + (answered ? 1 : 0),
  };
}
