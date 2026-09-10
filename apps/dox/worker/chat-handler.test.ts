/// <reference types="vitest/globals" />
import { convertArrayToReadableStream, MockLanguageModelV4 } from "ai/test";
import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { createChatHandler, type ChatHandlerDeps } from "./chat-handler";
import { resetRateLimitState } from "./rate-limit";
import type { RetrievalChunk } from "../src/lib/retrieval/types";
import { BRAINS, VISITOR_DAILY_MAX } from "../src/lib/chat-constants";
import {
  hashVisitor,
  markBrain,
  recordRequest,
  type UsageStore,
} from "./usage";
import { ptDayKey } from "../src/lib/pt-day";
import { APICallError } from "ai";

/** The ledger's bucket for "now" — tests assert against real keys rather than
 * reimplementing the Pacific-day rule. */
const ptDay = () => ptDayKey(Date.now());

const SAMPLE_CHUNKS: RetrievalChunk[] = [
  {
    id: "zoned/convert/convertZonedToZoned",
    kind: "function",
    url: "/reference/zoned/convert/convertZonedToZoned",
    namespace: "zoned",
    title: "convertZonedToZoned",
    text: "convertZonedToZoned(value, from, to): converts between IANA zones",
  },
];

function textStreamParts(text: string): LanguageModelV4StreamPart[] {
  return [
    { type: "stream-start", warnings: [] },
    { type: "text-start", id: "0" },
    { type: "text-delta", id: "0", delta: text },
    { type: "text-end", id: "0" },
    {
      type: "finish",
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: {
          total: 10,
          noCache: 10,
          cacheRead: undefined,
          cacheWrite: undefined,
        },
        outputTokens: { total: 10, text: 10, reasoning: undefined },
      },
    },
  ];
}

function fakeModel(text: string): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: convertArrayToReadableStream(textStreamParts(text)),
    }),
  });
}

// Fixed stand-ins for the real `.md`-backed VOCABULARY_CONTENT /
// CORE_RULES_CONTENT (see chat-handler.ts's ChatHandlerDeps doc comment for
// why those aren't imported directly into this test).
function makeHandler(
  overrides: Partial<ChatHandlerDeps> & Pick<ChatHandlerDeps, "resolveModel">,
) {
  return createChatHandler({
    vocabulary: "FAKE_VOCABULARY_CONTENT",
    coreRules: "FAKE_CORE_RULES_CONTENT",
    fetchChunksImpl: async () => SAMPLE_CHUNKS,
    ...overrides,
  });
}

/** The common case: one brain, always the same fake. Tests that care about
 * *which* brain was picked pass their own `resolveModel` instead. */
function singleBrain(model: MockLanguageModelV4) {
  return () => model;
}

function chatRequest(body: unknown): Request {
  return new Request("https://gmt-dox.example/api/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "cf-connecting-ip": "9.9.9.9",
    },
    body: JSON.stringify(body),
  });
}

function userMessage(text: string) {
  return { id: "m1", role: "user", parts: [{ type: "text", text }] };
}

describe("createChatHandler", () => {
  beforeEach(() => resetRateLimitState());

  it("streams a grounded response when retrieval finds relevant chunks", async () => {
    const model = fakeModel(
      "Use convertZonedToZoned to convert between IANA zones.",
    );
    const handler = makeHandler({
      resolveModel: singleBrain(model),
      // Force a hit. Against a fixture this small, real BM25 returns nothing
      // (see ChatHandlerDeps.searchChunksImpl) — without this the test would
      // pass on the fake model's canned text while retrieval silently found
      // zero chunks, which is the opposite of what it claims to check.
      searchChunksImpl: () => SAMPLE_CHUNKS,
    });

    const response = await handler(
      chatRequest({
        messages: [userMessage("how do I convert between zones")],
      }),
    );

    expect(response.status).toBe(200);
    const bodyText = await response.text();
    expect(bodyText).toContain("convertZonedToZoned");
    // The retrieved chunk really did reach the prompt.
    const [call] = model.doStreamCalls;
    expect(JSON.stringify(call.prompt)).toContain(SAMPLE_CHUNKS[0].url);
  });

  it("assembles an empty-context prompt (refusal setup) when retrieval finds nothing", async () => {
    const model = fakeModel("The documentation does not cover this.");
    const handler = makeHandler({ resolveModel: singleBrain(model) });

    const response = await handler(
      chatRequest({ messages: [userMessage("recommend a pizza restaurant")] }),
    );
    await response.text(); // drain the lazy stream so doStream actually fires

    const [call] = model.doStreamCalls;
    const systemContent = JSON.stringify(call.prompt);
    expect(systemContent).toContain("no chunks retrieved for this question");
    expect(systemContent).toContain("Refusal instruction");
  });

  it("returns 429 without calling the model when rate-limited", async () => {
    const model = fakeModel("should not be called");
    const handler = makeHandler({ resolveModel: singleBrain(model) });

    for (let i = 0; i < 25; i++) {
      await handler(chatRequest({ messages: [userMessage("hi")] }));
    }

    const response = await handler(
      chatRequest({ messages: [userMessage("hi")] }),
    );
    expect(response.status).toBe(429);
  });

  it("returns 400 on malformed JSON without calling the model", async () => {
    const model = fakeModel("should not be called");
    const handler = makeHandler({ resolveModel: singleBrain(model) });

    const request = new Request("https://gmt-dox.example/api/chat", {
      method: "POST",
      headers: { "cf-connecting-ip": "1.1.1.1" },
      body: "not json",
    });
    const response = await handler(request);
    expect(response.status).toBe(400);
    expect(model.doStreamCalls).toHaveLength(0);
  });

  it("returns 400 on a failed validation without calling the model", async () => {
    const model = fakeModel("should not be called");
    const handler = makeHandler({ resolveModel: singleBrain(model) });

    const response = await handler(chatRequest({ messages: [] }));
    expect(response.status).toBe(400);
    expect(model.doStreamCalls).toHaveLength(0);
  });

  it("emits a retrieval trace part before the answer streams", async () => {
    const handler = makeHandler({
      resolveModel: singleBrain(
        fakeModel("Use convertZonedToZoned to convert between IANA zones."),
      ),
      searchChunksImpl: () => SAMPLE_CHUNKS,
    });

    const response = await handler(
      chatRequest({
        messages: [userMessage("how do I convert between zones")],
      }),
    );
    const bodyText = await response.text();

    expect(bodyText).toContain('"type":"data-retrieval"');
    expect(bodyText).toContain('"totalChunks":1');
    expect(bodyText).toContain('"retrievedCount":1');
    expect(bodyText).toContain("convertZonedToZoned");
    // The trace has to arrive before the answer, so the UI can show what was
    // searched while the reply is still streaming.
    expect(bodyText.indexOf("data-retrieval")).toBeLessThan(
      bodyText.indexOf('"type":"start"'),
    );
  });

  it("reports zero retrieved chunks honestly for an out-of-corpus question", async () => {
    const handler = makeHandler({
      resolveModel: singleBrain(
        fakeModel("The documentation does not cover this."),
      ),
    });

    const response = await handler(
      chatRequest({ messages: [userMessage("recommend a pizza restaurant")] }),
    );
    const bodyText = await response.text();

    expect(bodyText).toContain('"retrievedCount":0');
    expect(bodyText).toContain('"chunkTitles":[]');
  });

  it("maps an upstream model failure to a mapped error, never a raw one", async () => {
    // This used to assert a 200 with an in-stream error frame, because the
    // model call happened lazily while the stream was consumed. Failover
    // changed that for the better: the call is now forced *before* any stream
    // opens, so a failure that says nothing about the brain (this one) is
    // reported as a plain JSON error instead of a 200 carrying a failure.
    // Either way the raw upstream text must never reach the reader.
    const model = new MockLanguageModelV4({
      doStream: async () => {
        throw new Error("simulated upstream failure");
      },
    });
    const handler = makeHandler({ resolveModel: singleBrain(model) });

    const response = await handler(
      chatRequest({
        messages: [userMessage("how do I convert between zones")],
      }),
    );
    expect(response.status).toBe(500);
    const bodyText = await response.text();
    expect(bodyText).not.toContain("simulated upstream failure");
    expect(bodyText).toContain("Something went wrong answering that question.");
  });
});

describe("brains, budgets and failover", () => {
  beforeEach(() => resetRateLimitState());

  /** In-memory stand-in for the KV ledger. */
  function fakeUsage(): UsageStore {
    const data = new Map<string, string>();
    return {
      async get(key) {
        return data.get(key) ?? null;
      },
      async put(key, value) {
        data.set(key, value);
      },
    };
  }

  /** Records which brain the handler actually asked for. */
  function spyResolver(text = "an answer") {
    const asked: string[] = [];
    const resolveModel = (brainId: string) => {
      asked.push(brainId);
      return fakeModel(text);
    };
    return { asked, resolveModel };
  }

  it("uses the first brain when nothing is spent", async () => {
    const { asked, resolveModel } = spyResolver();
    const handler = makeHandler({ resolveModel, usage: fakeUsage() });

    await handler(
      chatRequest({ messages: [userMessage("what is a DST gap")] }),
    );
    expect(asked).toEqual([BRAINS[0].id]);
  });

  it("skips a spent brain and uses the next one", async () => {
    // This is the whole point of the feature: one model's daily allowance
    // running out must not take Dox down, because the allowance is per model.
    const usage = fakeUsage();
    await markBrain(usage, BRAINS[0].id, "spent", Date.now());

    const { asked, resolveModel } = spyResolver();
    const handler = makeHandler({ resolveModel, usage });

    await handler(
      chatRequest({ messages: [userMessage("what is a DST gap")] }),
    );
    expect(asked).toEqual([BRAINS[1].id]);
  });

  it("honours the brain the reader picked", async () => {
    const { asked, resolveModel } = spyResolver();
    const handler = makeHandler({ resolveModel, usage: fakeUsage() });

    await handler(
      chatRequest({
        messages: [userMessage("what is a DST gap")],
        model: BRAINS[2].id,
      }),
    );
    expect(asked).toEqual([BRAINS[2].id]);
  });

  it("falls through rather than refusing when the picked brain is spent", async () => {
    const usage = fakeUsage();
    await markBrain(usage, BRAINS[2].id, "spent", Date.now());

    const { asked, resolveModel } = spyResolver();
    const handler = makeHandler({ resolveModel, usage });

    const response = await handler(
      chatRequest({
        messages: [userMessage("what is a DST gap")],
        model: BRAINS[2].id,
      }),
    );
    expect(response.status).toBe(200);
    expect(asked[0]).not.toBe(BRAINS[2].id);
  });

  it("reports exhaustion as a sentinel state with a reset time, not an error", async () => {
    const usage = fakeUsage();
    for (const brain of BRAINS) {
      await markBrain(usage, brain.id, "spent", Date.now());
    }

    const { resolveModel } = spyResolver();
    const handler = makeHandler({ resolveModel, usage });

    const response = await handler(
      chatRequest({ messages: [userMessage("what is a DST gap")] }),
    );
    expect(response.status).toBe(429);

    const body = (await response.json()) as Record<string, unknown>;
    expect(String(body.error)).toMatch(/midnight Pacific/);
    // The reader is told when it comes back, not just that it is gone.
    expect(typeof body.resetsAt).toBe("string");
  });

  it("records a request against the brain and the visitor", async () => {
    const usage = fakeUsage();
    const { resolveModel } = spyResolver();
    const handler = makeHandler({ resolveModel, usage });

    const response = await handler(
      chatRequest({ messages: [userMessage("what is a DST gap")] }),
    );
    // The ledger write is fire-and-forget; drain the stream so it has run.
    await response.text();

    expect(await usage.get(`model:${ptDay()}:${BRAINS[0].id}`)).toBe("1");
  });

  it("stops a visitor who has spent their daily allowance", async () => {
    const usage = fakeUsage();
    const hash = await hashVisitor("9.9.9.9");
    for (let i = 0; i < VISITOR_DAILY_MAX; i++) {
      await recordRequest(usage, BRAINS[0].id, hash, Date.now());
    }

    const { asked, resolveModel } = spyResolver();
    const handler = makeHandler({ resolveModel, usage });

    const response = await handler(
      chatRequest({ messages: [userMessage("what is a DST gap")] }),
    );
    expect(response.status).toBe(429);
    // Refused before any model was resolved — no quota spent on a capped user.
    expect(asked).toEqual([]);
  });

  it("exempts a dev from the visitor cap", async () => {
    const usage = fakeUsage();
    const hash = await hashVisitor("9.9.9.9");
    for (let i = 0; i < VISITOR_DAILY_MAX * 2; i++) {
      await recordRequest(usage, BRAINS[0].id, hash, Date.now());
    }

    const { asked, resolveModel } = spyResolver();
    const handler = makeHandler({
      resolveModel,
      usage,
      isDev: async () => true,
    });

    const response = await handler(
      chatRequest({ messages: [userMessage("what is a DST gap")] }),
    );
    expect(response.status).toBe(200);
    expect(asked).toEqual([BRAINS[0].id]);
  });

  it("switches to the next brain inside the SAME request when one is out", async () => {
    // The bug this exists for: with "Automatic" selected the reader still got
    // "daily usage limit", because failover only happened *between* requests
    // via the ledger — and with no ledger bound there was no memory at all, so
    // every request picked the same exhausted brain.
    const quota = new APICallError({
      message: "quota",
      url: "https://x.test",
      requestBodyValues: {},
      statusCode: 429,
      isRetryable: false,
    });

    const asked: string[] = [];
    const handler = makeHandler({
      // No `usage` at all — failover must work without the ledger.
      resolveModel: (brainId) => {
        asked.push(brainId);
        if (brainId === BRAINS[0].id) {
          return new MockLanguageModelV4({
            doStream: async () => {
              throw quota;
            },
          });
        }
        return fakeModel("Answered by the fallback brain.");
      },
    });

    const response = await handler(
      chatRequest({ messages: [userMessage("what is a DST gap")] }),
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("Answered by the fallback brain.");
    // The reader never sees the quota failure.
    expect(body).not.toContain("daily usage limit");
    // Both brains were tried, in order, within this one request.
    expect(asked).toEqual([BRAINS[0].id, BRAINS[1].id]);
    // And the transcript names the brain that actually answered.
    expect(body).toContain(`"brainId":"${BRAINS[1].id}"`);
  });

  it("walks past several exhausted brains in one request", async () => {
    const quota = new APICallError({
      message: "quota",
      url: "https://x.test",
      requestBodyValues: {},
      statusCode: 429,
      isRetryable: false,
    });
    const missing = new APICallError({
      message: "no such model",
      url: "https://x.test",
      requestBodyValues: {},
      statusCode: 404,
      isRetryable: false,
    });

    const asked: string[] = [];
    const handler = makeHandler({
      resolveModel: (brainId) => {
        asked.push(brainId);
        const index = BRAINS.findIndex((brain) => brain.id === brainId);
        if (index < 2) {
          return new MockLanguageModelV4({
            doStream: async () => {
              throw index === 0 ? quota : missing;
            },
          });
        }
        return fakeModel("Third time lucky.");
      },
    });

    const response = await handler(
      chatRequest({ messages: [userMessage("what is a DST gap")] }),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Third time lucky.");
    expect(asked).toHaveLength(3);
  });

  it("marks each exhausted brain as it moves past it", async () => {
    // Failover makes the request succeed; the ledger makes the NEXT request
    // skip the dead brain instead of paying for the discovery again.
    const usage = fakeUsage();
    const quota = new APICallError({
      message: "quota",
      url: "https://x.test",
      requestBodyValues: {},
      statusCode: 429,
      isRetryable: false,
    });

    const handler = makeHandler({
      usage,
      resolveModel: (brainId) =>
        brainId === BRAINS[0].id
          ? new MockLanguageModelV4({
              doStream: async () => {
                throw quota;
              },
            })
          : fakeModel("ok"),
    });

    await (
      await handler(
        chatRequest({ messages: [userMessage("what is a DST gap")] }),
      )
    ).text();

    expect(await usage.get(`state:${ptDay()}:${BRAINS[0].id}`)).toBe("spent");
  });

  it("only reports exhaustion when every brain really refuses", async () => {
    const quota = new APICallError({
      message: "quota",
      url: "https://x.test",
      requestBodyValues: {},
      statusCode: 429,
      isRetryable: false,
    });
    const handler = makeHandler({
      resolveModel: () =>
        new MockLanguageModelV4({
          doStream: async () => {
            throw quota;
          },
        }),
    });

    const response = await handler(
      chatRequest({ messages: [userMessage("what is a DST gap")] }),
    );
    expect(response.status).toBe(429);
    const body = (await response.json()) as Record<string, unknown>;
    expect(String(body.error)).toMatch(/midnight Pacific/);
  });

  it("does not burn the candidate list on an unrelated failure", async () => {
    // A malformed prompt or a transient 500 says nothing about the brain.
    // Retrying every model against it would waste the whole day's budget.
    const asked: string[] = [];
    const handler = makeHandler({
      resolveModel: (brainId) => {
        asked.push(brainId);
        return new MockLanguageModelV4({
          doStream: async () => {
            throw new Error("something unrelated broke");
          },
        });
      },
    });

    const response = await handler(
      chatRequest({ messages: [userMessage("what is a DST gap")] }),
    );
    expect(asked).toEqual([BRAINS[0].id]);
    expect(response.status).toBe(500);
  });

  it("marks a brain spent when the model reports a quota failure", async () => {
    // Nothing is retried inside an open stream (see brains.ts), but the marker
    // is what makes the reader's NEXT attempt route to a different brain.
    const usage = fakeUsage();
    const quota = new APICallError({
      message: "quota",
      url: "https://x.test",
      requestBodyValues: {},
      statusCode: 429,
      // Non-retryable so the SDK does not spend its backoff here. The wrapped
      // RetryError shape a real quota failure arrives in is covered directly in
      // usage.test.ts ("unwraps a RetryError"); this test is about the marking
      // being wired into the handler at all.
      isRetryable: false,
    });
    const handler = makeHandler({
      usage,
      resolveModel: () =>
        new MockLanguageModelV4({
          doStream: async () => {
            throw quota;
          },
        }),
    });

    const response = await handler(
      chatRequest({ messages: [userMessage("what is a DST gap")] }),
    );
    await response.text();

    expect(await usage.get(`state:${ptDay()}:${BRAINS[0].id}`)).toBe("spent");
  });

  it("names the answering brain in the retrieval trace", async () => {
    // Dox moves between models as budgets run out; an unexplained change in
    // voice reads as a bug unless the transcript says which brain answered.
    const { resolveModel } = spyResolver();
    const handler = makeHandler({ resolveModel, usage: fakeUsage() });

    const response = await handler(
      chatRequest({ messages: [userMessage("what is a DST gap")] }),
    );
    const body = await response.text();
    expect(body).toContain(`"brainId":"${BRAINS[0].id}"`);
  });

  it("works with no ledger at all", async () => {
    // The KV binding is optional so the Worker still runs before the namespace
    // exists — it must degrade to "first brain, no counts", not fail to boot.
    const { asked, resolveModel } = spyResolver();
    const handler = makeHandler({ resolveModel });

    const response = await handler(
      chatRequest({ messages: [userMessage("what is a DST gap")] }),
    );
    expect(response.status).toBe(200);
    expect(asked).toEqual([BRAINS[0].id]);
  });
});
