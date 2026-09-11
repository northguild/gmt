/// <reference types="vitest/globals" />

import { APICallError, RetryError } from "ai";
import {
  brainStateFromError,
  chooseBrain,
  isWorkersAIAllocationExhausted,
  remainingFor,
} from "./brains";
import {
  hashVisitor,
  markBrain,
  providerResets,
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
const geminiBrain = BRAINS.find((brain) => brain.provider === "google")!;
const workersAIBrain = BRAINS.find((brain) => brain.provider === "workers-ai")!;

/** A binding error as `workers-ai-provider`'s `normalizeBindingError` builds
 * it: a `workers-ai:` pseudo-URL, the binding's message, and a status only
 * when the provider recognises the internal code. */
const workersAIError = (message: string, statusCode?: number, code?: number) =>
  new APICallError({
    message,
    url: "workers-ai:binding/run/@cf/zai-org/glm-4.7-flash",
    requestBodyValues: {},
    statusCode,
    responseBody: message,
    ...(code === undefined ? {} : { data: { workersAIErrorCode: code } }),
  });

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
    const snapshot = await readUsage(fakeStore(), BRAINS, "v1", NOW);
    expect(snapshot.visitor).toBe(0);
    expect(snapshot.perBrain[ids[0]]).toBe(0);
    expect(snapshot.states[ids[0]]).toBe("ok");
  });

  it("counts a request against both the brain and the visitor", async () => {
    const store = fakeStore();
    await recordRequest(store, BRAINS[0], "v1", NOW);
    await recordRequest(store, BRAINS[0], "v1", NOW);

    const snapshot = await readUsage(store, BRAINS, "v1", NOW);
    expect(snapshot.perBrain[ids[0]]).toBe(2);
    expect(snapshot.visitor).toBe(2);
  });

  it("keeps visitors separate", async () => {
    const store = fakeStore();
    await recordRequest(store, BRAINS[0], "v1", NOW);
    expect((await readUsage(store, BRAINS, "v2", NOW)).visitor).toBe(0);
  });

  it("buckets a Gemini brain by Pacific day, so a UTC rollover does not reset it", async () => {
    const store = fakeStore();
    // 23:00 Pacific and 01:00 UTC the next calendar day are the same PT day.
    const latePacific = Date.UTC(2026, 5, 16, 6, 0, 0);
    await recordRequest(store, geminiBrain, "v1", latePacific);
    const stillSameDay = Date.UTC(2026, 5, 16, 6, 30, 0);
    const snapshot = await readUsage(store, BRAINS, "v1", stillSameDay);
    expect(snapshot.visitor).toBe(1);
    expect(snapshot.perBrain[geminiBrain.id]).toBe(1);
  });

  it("resets after Pacific midnight", async () => {
    const store = fakeStore();
    await recordRequest(store, BRAINS[0], "v1", NOW);
    const tomorrow = NOW + 1000 * 60 * 60 * 24;
    expect((await readUsage(store, BRAINS, "v1", tomorrow)).visitor).toBe(0);
  });

  it("never throws when the store is broken", async () => {
    // The promise this module makes: bookkeeping failure must not fail a chat.
    const store = fakeStore(/.*/);
    await expect(
      recordRequest(store, BRAINS[0], "v1", NOW),
    ).resolves.toBeUndefined();
    await expect(
      markBrain(store, BRAINS[0], "spent", NOW),
    ).resolves.toBeUndefined();
    const snapshot = await readUsage(store, BRAINS, "v1", NOW);
    // ...and an unreadable ledger degrades to optimism, not lockout.
    expect(snapshot.states[ids[0]]).toBe("ok");
  });
});

describe("each brain on its provider's clock (DOX-C4)", () => {
  // 16:30 PDT on the 15th — the 15th in both zones.
  const beforeUtcMidnight = Date.UTC(2026, 5, 15, 23, 30, 0);
  // 17:30 PDT, still the 15th in Pacific but already the 16th in UTC.
  const afterUtcMidnight = Date.UTC(2026, 5, 16, 0, 30, 0);

  it("refills a Workers AI count at UTC midnight and a Gemini count at Pacific midnight", async () => {
    const store = fakeStore();
    await recordRequest(store, geminiBrain, "v1", beforeUtcMidnight);
    await recordRequest(store, workersAIBrain, "v1", beforeUtcMidnight);

    const snapshot = await readUsage(store, BRAINS, "v1", afterUtcMidnight);
    expect(snapshot.perBrain[geminiBrain.id]).toBe(1);
    // Cloudflare's pool refilled at 00:00Z; the badge must say so.
    expect(snapshot.perBrain[workersAIBrain.id]).toBe(0);
    // The visitor cap is Dox's own, and still on the Pacific day.
    expect(snapshot.visitor).toBe(2);
  });

  it("keeps a Workers AI spent mark across the Pacific rollover, until UTC midnight", async () => {
    // Marked at 18:00 PDT on the 15th (01:00Z on the 16th), read at 01:00 PDT
    // on the 16th (08:00Z, still the 16th in UTC). Bucketed by the Pacific day
    // this mark vanished at Pacific midnight, sixteen hours too early.
    const store = fakeStore();
    const markedAt = Date.UTC(2026, 5, 16, 1, 0, 0);
    await markBrain(store, workersAIBrain, "spent", markedAt);
    await markBrain(store, geminiBrain, "spent", markedAt);

    const readAt = Date.UTC(2026, 5, 16, 8, 0, 0);
    const { states } = await readUsage(store, BRAINS, "v1", readAt);
    expect(states[workersAIBrain.id]).toBe("spent");
    expect(states[geminiBrain.id]).toBe("ok");
  });

  it("expires each mark at its own provider's midnight", async () => {
    const ttls = new Map<string, number | undefined>();
    const store: UsageStore = {
      async get() {
        return null;
      },
      async put(key, _value, options) {
        ttls.set(key, options?.expirationTtl);
      },
    };
    await markBrain(store, workersAIBrain, "spent", NOW);
    await markBrain(store, geminiBrain, "spent", NOW);

    // Noon PDT: five hours to 00:00Z, twelve to Pacific midnight, each plus the
    // 300 s margin.
    expect(ttls.get(`state:2026-06-15:${workersAIBrain.id}`)).toBe(
      5 * 3600 + 300,
    );
    expect(ttls.get(`state:2026-06-15:${geminiBrain.id}`)).toBe(
      12 * 3600 + 300,
    );
  });
});

describe("providerResets", () => {
  it("lists each provider once, in preference order, with its next midnight", () => {
    expect(providerResets(BRAINS, NOW)).toEqual([
      {
        id: "google",
        label: "Gemini",
        resetsAt: "2026-06-16T07:00:00.000Z",
      },
      {
        id: "workers-ai",
        label: "Workers AI",
        resetsAt: "2026-06-16T00:00:00.000Z",
      },
    ]);
  });

  it("omits a provider with no brain in the list", () => {
    const geminiOnly = BRAINS.filter((brain) => brain.provider === "google");
    expect(providerResets(geminiOnly, NOW).map((p) => p.id)).toEqual([
      "google",
    ]);
  });
});

describe("markBrain", () => {
  it("records spent and unavailable separately", async () => {
    const store = fakeStore();
    await markBrain(store, BRAINS[0], "spent", NOW);
    await markBrain(store, BRAINS[1], "unavailable", NOW);

    const snapshot = await readUsage(store, BRAINS, "v1", NOW);
    expect(snapshot.states[ids[0]]).toBe("spent");
    expect(snapshot.states[ids[1]]).toBe("unavailable");
    expect(snapshot.states[ids[2]]).toBe("ok");
  });

  it("lets a withdrawn brain be re-probed the next day", async () => {
    // Day-scoped on purpose: a model Google restores comes back on its own,
    // with no code change and at a cost of one request.
    const store = fakeStore();
    await markBrain(store, BRAINS[0], "unavailable", NOW);
    const tomorrow = NOW + 1000 * 60 * 60 * 24;
    expect(
      (await readUsage(store, BRAINS, "v1", tomorrow)).states[ids[0]],
    ).toBe("ok");
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

  it("chooses only from the pool it is given", () => {
    // A deployment without a Gemini key must never be handed a Gemini brain.
    const pool = BRAINS.filter((brain) => brain.provider === "workers-ai");
    expect(chooseBrain(snapshot({}), undefined, pool).brain?.id).toBe(
      pool[0].id,
    );
    expect(chooseBrain(snapshot({}), ids[0], pool).brain?.id).toBe(pool[0].id);
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

  it("reads Workers AI's unmapped 4006 allocation error as spent", () => {
    // workers-ai-provider 4.0.0 maps 3036 to 429 but has no entry for 4006, so
    // this arrives with no status. Unclassified, it would end the request
    // instead of failing over.
    const error = workersAIError(
      "4006: you have used up your daily free allocation of 10,000 neurons, please upgrade to Cloudflare's Workers Paid plan",
    );
    expect(error.statusCode).toBeUndefined();
    expect(brainStateFromError(error)).toBe("spent");
  });

  it("reads a Workers AI 403 as a model this account cannot use", () => {
    expect(
      brainStateFromError(
        workersAIError("5035: This model requires a Workers Paid plan", 403),
      ),
    ).toBe("unavailable");
  });

  it("leaves a Gemini 403 unclassified, because there it means a bad key", () => {
    expect(brainStateFromError(apiError(403))).toBeUndefined();
  });
});

describe("isWorkersAIAllocationExhausted", () => {
  it("recognises both shapes of the exhausted-allocation error", () => {
    expect(
      isWorkersAIAllocationExhausted(
        workersAIError(
          "3036: You have used up your daily free allocation of 10,000 neurons.",
          429,
          3036,
        ),
      ),
    ).toBe(true);
    expect(
      isWorkersAIAllocationExhausted(
        workersAIError(
          "4006: you have used up your daily free allocation of 10,000 neurons",
        ),
      ),
    ).toBe(true);
  });

  it("does not treat a capacity 429 as the whole pool being gone", () => {
    // 3040 is one model briefly out of capacity, not the account's day.
    expect(
      isWorkersAIAllocationExhausted(
        workersAIError(
          "3040: No more data centers to forward the request to",
          429,
          3040,
        ),
      ),
    ).toBe(false);
  });

  it("never matches a Gemini error, whatever its message says", () => {
    const gemini = new APICallError({
      message: "daily free allocation exhausted",
      url: "https://generativelanguage.googleapis.com/v1beta/models/x",
      requestBodyValues: {},
      statusCode: 429,
    });
    expect(isWorkersAIAllocationExhausted(gemini)).toBe(false);
  });

  it("unwraps a RetryError, the shape a retried 3036 arrives in", () => {
    const quota = workersAIError(
      "3036: You have used up your daily free allocation of 10,000 neurons.",
      429,
      3036,
    );
    const wrapped = new RetryError({
      message: "Failed after 2 attempts",
      reason: "maxRetriesExceeded",
      errors: [quota, quota],
    });
    expect(isWorkersAIAllocationExhausted(wrapped)).toBe(true);
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
