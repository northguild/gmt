/// <reference types="vitest/globals" />

import { APICallError, RetryError } from "ai";
import { brainStateFromError, chooseBrain, remainingFor } from "./brains";
import {
  hashVisitor,
  markBrain,
  readUsage,
  recordRequest,
  type UsageStore,
} from "./usage";
import { BRAINS } from "../src/lib/chat-constants";

const NOW = Date.UTC(2026, 5, 15, 19, 0, 0); // noon Pacific

/** An in-memory stand-in for KV. `failOn` lets a test make a specific key
 * throw, which is how the "never fail a chat" promise gets proved. */
function fakeStore(failOn?: RegExp) {
  const data = new Map<string, string>();
  const store: UsageStore & { data: Map<string, string> } = {
    data,
    async get(key) {
      if (failOn?.test(key)) throw new Error("KV unavailable");
      return data.get(key) ?? null;
    },
    async put(key, value) {
      if (failOn?.test(key)) throw new Error("KV unavailable");
      data.set(key, value);
    },
  };
  return store;
}

const ids = BRAINS.map((b) => b.id);

describe("hashVisitor", () => {
  it("is stable for the same client", async () => {
    expect(await hashVisitor("1.2.3.4")).toBe(await hashVisitor("1.2.3.4"));
  });

  it("differs between clients", async () => {
    expect(await hashVisitor("1.2.3.4")).not.toBe(await hashVisitor("1.2.3.5"));
  });

  it("does not contain the address it came from", async () => {
    // The ledger only needs to tell visitors apart, never to name one.
    expect(await hashVisitor("203.0.113.9")).not.toContain("203");
  });
});

describe("readUsage / recordRequest", () => {
  it("starts empty", async () => {
    const snapshot = await readUsage(fakeStore(), ids, "v1", NOW);
    expect(snapshot.visitor).toBe(0);
    expect(snapshot.perBrain[ids[0]]).toBe(0);
    expect(snapshot.states[ids[0]]).toBe("ok");
  });

  it("counts a request against both the brain and the visitor", async () => {
    const store = fakeStore();
    await recordRequest(store, ids[0], "v1", NOW);
    await recordRequest(store, ids[0], "v1", NOW);

    const snapshot = await readUsage(store, ids, "v1", NOW);
    expect(snapshot.perBrain[ids[0]]).toBe(2);
    expect(snapshot.visitor).toBe(2);
  });

  it("keeps visitors separate", async () => {
    const store = fakeStore();
    await recordRequest(store, ids[0], "v1", NOW);
    expect((await readUsage(store, ids, "v2", NOW)).visitor).toBe(0);
  });

  it("buckets by Pacific day, so a UTC rollover does not reset it", async () => {
    const store = fakeStore();
    // 23:00 Pacific and 01:00 UTC the next calendar day are the same PT day.
    const latePacific = Date.UTC(2026, 5, 16, 6, 0, 0);
    await recordRequest(store, ids[0], "v1", latePacific);
    const stillSameDay = Date.UTC(2026, 5, 16, 6, 30, 0);
    expect((await readUsage(store, ids, "v1", stillSameDay)).visitor).toBe(1);
  });

  it("resets after Pacific midnight", async () => {
    const store = fakeStore();
    await recordRequest(store, ids[0], "v1", NOW);
    const tomorrow = NOW + 1000 * 60 * 60 * 24;
    expect((await readUsage(store, ids, "v1", tomorrow)).visitor).toBe(0);
  });

  it("never throws when the store is broken", async () => {
    // The promise this module makes: bookkeeping failure must not fail a chat.
    const store = fakeStore(/.*/);
    await expect(
      recordRequest(store, ids[0], "v1", NOW),
    ).resolves.toBeUndefined();
    await expect(
      markBrain(store, ids[0], "spent", NOW),
    ).resolves.toBeUndefined();
    const snapshot = await readUsage(store, ids, "v1", NOW);
    // ...and an unreadable ledger degrades to optimism, not lockout.
    expect(snapshot.states[ids[0]]).toBe("ok");
  });
});

describe("markBrain", () => {
  it("records spent and unavailable separately", async () => {
    const store = fakeStore();
    await markBrain(store, ids[0], "spent", NOW);
    await markBrain(store, ids[1], "unavailable", NOW);

    const snapshot = await readUsage(store, ids, "v1", NOW);
    expect(snapshot.states[ids[0]]).toBe("spent");
    expect(snapshot.states[ids[1]]).toBe("unavailable");
    expect(snapshot.states[ids[2]]).toBe("ok");
  });

  it("lets a withdrawn brain be re-probed the next day", async () => {
    // Day-scoped on purpose: a model Google restores comes back on its own,
    // with no code change and at a cost of one request.
    const store = fakeStore();
    await markBrain(store, ids[0], "unavailable", NOW);
    const tomorrow = NOW + 1000 * 60 * 60 * 24;
    expect((await readUsage(store, ids, "v1", tomorrow)).states[ids[0]]).toBe(
      "ok",
    );
  });
});

describe("chooseBrain", () => {
  const snapshot = (
    states: Record<string, "ok" | "spent" | "unavailable">,
  ) => ({
    perBrain: {},
    states,
    visitor: 0,
  });

  it("uses the first brain when everything is healthy", () => {
    expect(chooseBrain(snapshot({})).brain?.id).toBe(ids[0]);
  });

  it("skips a spent brain", () => {
    expect(chooseBrain(snapshot({ [ids[0]]: "spent" })).brain?.id).toBe(ids[1]);
  });

  it("skips an unavailable brain", () => {
    expect(chooseBrain(snapshot({ [ids[0]]: "unavailable" })).brain?.id).toBe(
      ids[1],
    );
  });

  it("honours the reader's pick", () => {
    expect(chooseBrain(snapshot({}), ids[2]).brain?.id).toBe(ids[2]);
  });

  it("falls through rather than refusing when the pick is spent", () => {
    // The reader asked for a better answer, not for a specific HTTP outcome.
    const result = chooseBrain(snapshot({ [ids[2]]: "spent" }), ids[2]);
    expect(result.exhausted).toBe(false);
    expect(result.brain?.id).not.toBe(ids[2]);
  });

  it("reports exhaustion only when every brain is out", () => {
    const allOut = Object.fromEntries(ids.map((id) => [id, "spent" as const]));
    const result = chooseBrain(snapshot(allOut));
    expect(result.exhausted).toBe(true);
    expect(result.brain).toBeUndefined();
  });
});

describe("brainStateFromError", () => {
  const apiError = (statusCode: number) =>
    new APICallError({
      message: "nope",
      url: "https://x.test",
      requestBodyValues: {},
      statusCode,
    });

  it("reads a 429 as spent", () => {
    expect(brainStateFromError(apiError(429))).toBe("spent");
  });

  it("reads 404 and 400 as unavailable", () => {
    expect(brainStateFromError(apiError(404))).toBe("unavailable");
    expect(brainStateFromError(apiError(400))).toBe("unavailable");
  });

  it("unwraps a RetryError, which is how the failure actually arrives", () => {
    // streamText retries internally; APICallError.isInstance is false for the
    // wrapper. Testing the raw error is the trap that made mapUpstreamError
    // misreport a real quota failure.
    const wrapped = new RetryError({
      message: "Failed after 3 attempts",
      reason: "maxRetriesExceeded",
      errors: [apiError(429), apiError(429)],
    });
    expect(brainStateFromError(wrapped)).toBe("spent");
  });

  it("does not retire a brain for a transient or unrelated failure", () => {
    expect(brainStateFromError(apiError(500))).toBeUndefined();
    expect(brainStateFromError(new Error("boom"))).toBeUndefined();
  });
});

describe("remainingFor", () => {
  it("counts down from the advisory limit", () => {
    const brain = BRAINS[0];
    const used = { perBrain: { [brain.id]: 5 }, states: {}, visitor: 0 };
    expect(remainingFor(brain, used)).toBe(brain.dailyLimit - 5);
  });

  it("reports zero for a brain that is out, whatever the count says", () => {
    const brain = BRAINS[0];
    const spent = {
      perBrain: { [brain.id]: 0 },
      states: { [brain.id]: "spent" as const },
      visitor: 0,
    };
    expect(remainingFor(brain, spent)).toBe(0);
  });

  it("never goes negative", () => {
    const brain = BRAINS[0];
    const over = { perBrain: { [brain.id]: 999 }, states: {}, visitor: 0 };
    expect(remainingFor(brain, over)).toBe(0);
  });
});
