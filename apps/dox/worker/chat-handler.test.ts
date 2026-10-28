import { convertArrayToReadableStream, MockLanguageModelV4 } from "ai/test";
import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { createChatHandler, type ChatHandlerDeps } from "./chat-handler";
import { resetRateLimitState } from "./rate-limit";
import type { RetrievalChunk } from "../src/lib/retrieval/types";
import {
  BRAIN_PROVIDERS,
  BRAINS,
  VISITOR_DAILY_MAX,
  type Brain,
} from "../src/lib/chat-constants";
import {
  hashVisitor,
  markBrain,
  readUsage,
  recordRequest,
  type UsageStore,
} from "./usage";
import {
  dayKey,
  nextMidnightMs,
  secondsUntilMidnight,
} from "../src/lib/pt-day";
import { DOX_TOOL_NAMES, ENABLED_TOOL_NAMES } from "../src/lib/dox-tools";
import type { VocabularySkill } from "./select-vocabulary";
import type { BrainsInfo } from "../src/lib/chat-types";
import { APICallError } from "ai";
import { convertUnixToUtc, convertUtcToUnix } from "@northguild/gmt";
import { getUnixNowMs } from "./clock";

/** The ledger's bucket for "now" on the brain's own clock: Gemini resets at
 * Pacific midnight, Workers AI at UTC midnight. Tests assert against real keys
 * rather than reimplementing the rule. */
const brainDay = (brain: Brain) =>
  dayKey(getUnixNowMs(), BRAIN_PROVIDERS[brain.provider].resetTimeZone);

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

/** A model that never sends anything until its call is aborted. */
function silentModel(): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doStream: ({ abortSignal }) =>
      new Promise((_, reject) => {
        abortSignal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      }),
  });
}

/** A model that starts writing at once but finishes `finishAfterMs` later. */
function slowFinishingModel(
  text: string,
  finishAfterMs: number,
): MockLanguageModelV4 {
  const [streamStart, textStart, textDelta, ...rest] = textStreamParts(text);
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: new ReadableStream<LanguageModelV4StreamPart>({
        start(controller) {
          controller.enqueue(streamStart);
          controller.enqueue(textStart);
          controller.enqueue(textDelta);
          setTimeout(() => {
            for (const part of rest) controller.enqueue(part);
            controller.close();
          }, finishAfterMs);
        },
      }),
    }),
  });
}

// Fixed stand-ins for the real `.md`-backed VOCABULARY_SKILLS /
// CORE_RULES_CONTENT (see chat-handler.ts's ChatHandlerDeps doc comment for
// why those aren't imported directly into this test). The zoned skill covers
// SAMPLE_CHUNKS; the GNSS one covers nothing it retrieves.
const FAKE_SKILLS: VocabularySkill[] = [
  {
    name: "fake-zoned",
    body: "FAKE_ZONED_VOCABULARY",
    modules: ["zoned/"],
    pages: [],
  },
  {
    name: "fake-gnss",
    body: "FAKE_GNSS_VOCABULARY",
    modules: ["gnss/"],
    pages: [],
  },
];

function makeHandler(
  overrides: Partial<ChatHandlerDeps> & Pick<ChatHandlerDeps, "resolveModel">,
) {
  return createChatHandler({
    vocabulary: FAKE_SKILLS,
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

/** Every streamed chunk of one `type`, parsed, in order. */
function partsOfType(body: string, type: string): Record<string, unknown>[] {
  return body
    .split("\n")
    .filter((line) => line.startsWith("data: ") && line.includes(`"${type}"`))
    .map((line) => JSON.parse(line.slice("data: ".length)))
    .filter((part) => part.type === type);
}

/** The refusal written into an open stream, as `{ status, payload }`. */
function refusalOf(body: string): {
  status: number;
  payload: Record<string, unknown>;
} {
  const [part] = partsOfType(body, "data-refusal");
  expect(part, "expected a data-refusal part").toBeDefined();
  expect(part.transient).toBe(true);
  return part.data as { status: number; payload: Record<string, unknown> };
}

/** Every `data-retrieval` part in a streamed body, parsed, in order. */
function retrievalParts(body: string): Record<string, unknown>[] {
  return body
    .split("\n")
    .filter(
      (line) => line.startsWith("data: ") && line.includes('"data-retrieval"'),
    )
    .map((line) => JSON.parse(line.slice("data: ".length)));
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

  /* The linking allowlist is the only thing standing between the model and an
     invented URL, and its value comes entirely from being *small* — see
     system-prompt.ts's docstring on why 20 routes beat 120. system-prompt.ts
     renders faithfully whatever it is handed, so the invariant that actually
     protects the reader ("the allowlist is exactly what retrieval returned")
     can only be asserted here, where the handler derives one from the other. */
  it("puts exactly the retrieved routes in the linking allowlist, never the whole manifest", async () => {
    const model = fakeModel("Use convertZonedToZoned.");
    const handler = makeHandler({
      resolveModel: singleBrain(model),
      // Retrieval sees three pages and returns one. The other two must not
      // reach the prompt just because they exist in the corpus.
      fetchChunksImpl: async () => [
        ...SAMPLE_CHUNKS,
        {
          id: "plain/calculate/addPlainDate",
          kind: "function",
          url: "/reference/plain/calculate/addPlainDate",
          namespace: "plain",
          title: "addPlainDate",
          text: "addPlainDate(value, duration)",
        },
        {
          id: "duration/format/formatDuration",
          kind: "function",
          url: "/reference/duration/format/formatDuration",
          namespace: "duration",
          title: "formatDuration",
          text: "formatDuration(value)",
        },
      ],
      searchChunksImpl: () => SAMPLE_CHUNKS,
    });

    const response = await handler(
      chatRequest({
        messages: [userMessage("how do I convert between zones")],
      }),
    );
    await response.text();

    const [call] = model.doStreamCalls;
    const prompt = JSON.stringify(call.prompt);
    const allowlist = prompt.slice(
      prompt.indexOf("## Linking rules"),
      prompt.indexOf("## Vocabulary"),
    );

    expect(allowlist).toContain(SAMPLE_CHUNKS[0].url);
    expect(allowlist).not.toContain("/reference/plain/calculate/addPlainDate");
    expect(allowlist).not.toContain(
      "/reference/duration/format/formatDuration",
    );
  });

  /* DOX-C3b. These assert the wiring, not the model's judgement: whether Gemini
     chooses to call a tool is its business, but the tools must actually be on
     the request and described in the prompt, and all three SDK layers must be
     handed the same set. */
  it("offers the widget tools to the model", async () => {
    const model = fakeModel("Here is a globe.");
    const handler = makeHandler({
      resolveModel: singleBrain(model),
      searchChunksImpl: () => SAMPLE_CHUNKS,
    });

    const response = await handler(
      chatRequest({ messages: [userMessage("what time is it in Tokyo")] }),
    );
    await response.text();

    const [call] = model.doStreamCalls;
    /* The question's own set (see `select-tools.ts`), always within the
       mountable set. Offering one whose widget is not registered would have
       the model promise a widget the panel cannot show — see
       `ENABLED_TOOL_NAMES`. */
    const toolNames = (call.tools ?? []).map((t) => t.name);
    expect(toolNames).toContain("showGlobe");
    expect(toolNames.length).toBeLessThan(ENABLED_TOOL_NAMES.length);
    for (const name of toolNames) {
      expect(ENABLED_TOOL_NAMES as readonly string[]).toContain(name);
    }
  });

  it("describes exactly the offered tools in the prompt", async () => {
    const model = fakeModel("ok");
    const handler = makeHandler({
      resolveModel: singleBrain(model),
      searchChunksImpl: () => SAMPLE_CHUNKS,
    });

    const response = await handler(
      chatRequest({ messages: [userMessage("what time is it in Tokyo")] }),
    );
    await response.text();

    const [call] = model.doStreamCalls;
    const offered = new Set((call.tools ?? []).map((t) => t.name));
    const prompt = JSON.stringify(call.prompt);
    for (const name of ENABLED_TOOL_NAMES) {
      expect(prompt.includes(`\`${name}\` —`)).toBe(offered.has(name));
    }
  });

  it("puts only the matching skill's vocabulary in the prompt", async () => {
    const model = fakeModel("ok");
    const handler = makeHandler({
      resolveModel: singleBrain(model),
      searchChunksImpl: () => SAMPLE_CHUNKS,
    });

    const response = await handler(
      chatRequest({ messages: [userMessage("convert between zones")] }),
    );
    await response.text();

    const prompt = JSON.stringify(model.doStreamCalls[0].prompt);
    expect(prompt).toContain("FAKE_ZONED_VOCABULARY");
    expect(prompt).not.toContain("FAKE_GNSS_VOCABULARY");
  });

  it("never offers a tool whose widget cannot be mounted", async () => {
    const model = fakeModel("ok");
    const handler = makeHandler({
      resolveModel: singleBrain(model),
      searchChunksImpl: () => SAMPLE_CHUNKS,
    });

    const response = await handler(
      chatRequest({ messages: [userMessage("what time is it in Tokyo")] }),
    );
    await response.text();

    const [call] = model.doStreamCalls;
    const offered = (call.tools ?? []).map((t) => t.name);
    const prompt = JSON.stringify(call.prompt);
    // Derived so this keeps holding as widgets are extracted one by one.
    const pending = DOX_TOOL_NAMES.filter(
      (name) => !(ENABLED_TOOL_NAMES as readonly string[]).includes(name),
    );
    for (const name of pending) {
      expect(offered).not.toContain(name);
      // Nor described in the prompt, which is the other way the model learns
      // a tool exists.
      expect(prompt).not.toContain(name);
    }
  });

  it("describes each tool in the system prompt instead of the old placeholder", async () => {
    const model = fakeModel("ok");
    const handler = makeHandler({
      resolveModel: singleBrain(model),
      searchChunksImpl: () => SAMPLE_CHUNKS,
    });

    const response = await handler(
      chatRequest({ messages: [userMessage("what time is it in Tokyo")] }),
    );
    await response.text();

    const prompt = JSON.stringify(model.doStreamCalls[0].prompt);
    expect(prompt).not.toContain("no tools are registered yet");
    expect(prompt).toContain("showGlobe");
    // The prose-first instruction is load-bearing — see system-prompt.ts.
    expect(prompt).toContain("Write your prose answer first");
  });

  it("keeps exactly one step, so a tool call cannot trigger a second upstream request", async () => {
    // Failover is only available before headers are sent. A second step would
    // happen after, and would also spend a second request from a shared pool.
    const model = fakeModel("ok");
    const handler = makeHandler({
      resolveModel: singleBrain(model),
      searchChunksImpl: () => SAMPLE_CHUNKS,
    });

    const response = await handler(
      chatRequest({ messages: [userMessage("what time is it in Tokyo")] }),
    );
    await response.text();

    expect(model.doStreamCalls).toHaveLength(1);
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

  it("carries stage timings in the trace, then finishes it with first token, total and the tool outcome", async () => {
    const handler = makeHandler({
      resolveModel: singleBrain(fakeModel("An answer.")),
      searchChunksImpl: () => SAMPLE_CHUNKS,
    });

    const response = await handler(
      chatRequest({ messages: [userMessage("what is dwellTime")] }),
    );
    const parts = retrievalParts(await response.text());

    // Two writes of the same part: the client replaces the first by id.
    expect(parts).toHaveLength(2);
    expect(parts.every((part) => part.id === "retrieval")).toBe(true);

    const opening = parts[0].data as Record<string, unknown>;
    const timings = opening.timings as Record<string, number>;
    for (const stage of ["usage", "corpus", "search", "prompt", "brains"]) {
      expect(typeof timings[stage]).toBe("number");
    }
    expect(timings.firstToken).toBeUndefined();
    expect(opening.toolCalled).toBeUndefined();

    const finished = parts[1].data as Record<string, unknown>;
    const finishedTimings = finished.timings as Record<string, number>;
    expect(typeof finishedTimings.firstToken).toBe("number");
    expect(typeof finishedTimings.total).toBe("number");
    expect(finishedTimings.total).toBeGreaterThanOrEqual(
      finishedTimings.firstToken,
    );
    expect(finished.toolCalled).toBeNull();
    expect(finished.attempts).toEqual([
      { brainId: BRAINS[0].id, ms: expect.any(Number), outcome: "answered" },
    ]);
    // The rest of the trace is unchanged between the two writes.
    expect(finished.chunkTitles).toEqual(opening.chunkTitles);
    expect(finished.brainId).toBe(BRAINS[0].id);
  });

  it("names the widget tool the model called in the finished trace", async () => {
    const model = new MockLanguageModelV4({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: "stream-start", warnings: [] },
          {
            type: "tool-call",
            toolCallId: "call-1",
            toolName: "showGlobe",
            input: JSON.stringify({ zone: "Asia/Tokyo" }),
          },
          {
            type: "finish",
            finishReason: { unified: "tool-calls", raw: undefined },
            usage: {
              inputTokens: {
                total: 10,
                noCache: 10,
                cacheRead: undefined,
                cacheWrite: undefined,
              },
              outputTokens: { total: 10, text: 0, reasoning: undefined },
            },
          },
        ] satisfies LanguageModelV4StreamPart[]),
      }),
    });
    const handler = makeHandler({
      resolveModel: singleBrain(model),
      searchChunksImpl: () => SAMPLE_CHUNKS,
    });

    const response = await handler(
      chatRequest({ messages: [userMessage("show me Tokyo")] }),
    );
    const parts = retrievalParts(await response.text());
    const finished = parts.at(-1)?.data as Record<string, unknown>;
    expect(finished.toolCalled).toBe("showGlobe");
  });

  describe("a widget answered without text", () => {
    const usage = {
      inputTokens: {
        total: 10,
        noCache: 10,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: { total: 10, text: 0, reasoning: undefined },
    };
    const globeCall = (text?: string): LanguageModelV4StreamPart[] => [
      { type: "stream-start", warnings: [] },
      ...(text
        ? ([
            { type: "text-start", id: "t" },
            { type: "text-delta", id: "t", delta: text },
            { type: "text-end", id: "t" },
          ] satisfies LanguageModelV4StreamPart[])
        : []),
      {
        type: "tool-call",
        toolCallId: "call-1",
        toolName: "showGlobe",
        input: JSON.stringify({ zone: "Asia/Tokyo" }),
      },
      {
        type: "finish",
        finishReason: { unified: "tool-calls", raw: undefined },
        usage,
      },
    ];
    /** Step 1 returns `first`; every later step writes `later`. */
    const stepModel = (
      first: LanguageModelV4StreamPart[],
      later = "Tokyo is on Japan Standard Time.",
    ) => {
      let calls = 0;
      return new MockLanguageModelV4({
        doStream: async () => ({
          stream: convertArrayToReadableStream(
            calls++ === 0 ? first : textStreamParts(later),
          ),
        }),
      });
    };
    const ask = async (model: MockLanguageModelV4) => {
      const handler = makeHandler({
        resolveModel: singleBrain(model),
        searchChunksImpl: () => SAMPLE_CHUNKS,
      });
      const response = await handler(
        chatRequest({ messages: [userMessage("show me Tokyo")] }),
      );
      return response.text();
    };

    it("asks the same model once more, with no tools, for the prose", async () => {
      const model = stepModel(globeCall());
      const body = await ask(model);
      expect(model.doStreamCalls).toHaveLength(2);
      expect(model.doStreamCalls[1].tools ?? []).toEqual([]);
      expect(body).toContain("Tokyo is on Japan Standard Time.");
      expect(partsOfType(body, "tool-input-available")).toHaveLength(1);
      const finished = retrievalParts(body).at(-1)?.data as Record<
        string,
        unknown
      >;
      expect(finished.toolCalled).toBe("showGlobe");
    });

    it("stops after one step when the widget came with text", async () => {
      const model = stepModel(globeCall("Here is Tokyo on the globe."));
      const body = await ask(model);
      expect(model.doStreamCalls).toHaveLength(1);
      expect(body).toContain("Here is Tokyo on the globe.");
      expect(body).not.toContain("Tokyo is on Japan Standard Time.");
    });

    /* GLM 4.7 Flash sometimes writes its tool-call syntax as text. */
    const markup =
      "<tool_call>showGlobe<arg_key>zone</arg_key><arg_value>Asia/Tokyo</arg_value></tool_call>";

    it("asks for the prose when the widget came with only tool-call markup", async () => {
      const model = stepModel(globeCall(markup));
      const body = await ask(model);
      expect(model.doStreamCalls).toHaveLength(2);
      expect(body).not.toContain("tool_call");
      // The written call repeats the real one, so one widget opens, not two.
      expect(partsOfType(body, "tool-input-available")).toHaveLength(1);
      expect(body).toContain("Tokyo is on Japan Standard Time.");
    });

    it("opens the widget and then asks for the prose when the call came only as text", async () => {
      const model = stepModel(textStreamParts(markup));
      const body = await ask(model);
      expect(model.doStreamCalls).toHaveLength(2);
      expect(body).not.toContain("tool_call");
      expect(partsOfType(body, "tool-input-available")).toHaveLength(1);
      expect(body).toContain("Tokyo is on Japan Standard Time.");
      const finished = retrievalParts(body).at(-1)?.data as Record<
        string,
        unknown
      >;
      expect(finished.toolCalled).toBe("showGlobe");
    });

    it("never sends tool-call markup written in the prose step", async () => {
      const model = stepModel(globeCall(), `Here is Tokyo. ${markup}`);
      const body = await ask(model);
      expect(body).not.toContain("tool_call");
      expect(body).toContain("Here is Tokyo.");
    });
  });

  it("logs one dox-timing line per answered request", async () => {
    const logged: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args) => {
      logged.push(args.map(String).join(" "));
    });
    try {
      const handler = makeHandler({
        resolveModel: singleBrain(fakeModel("An answer.")),
        searchChunksImpl: () => SAMPLE_CHUNKS,
      });
      const response = await handler(
        chatRequest({ messages: [userMessage("what is dwellTime")] }),
      );
      await response.text();
    } finally {
      spy.mockRestore();
    }
    const lines = logged.filter((line) => line.startsWith("dox-timing "));
    expect(lines).toHaveLength(1);
    const payload = JSON.parse(lines[0].slice("dox-timing ".length));
    expect(payload.brain).toBe(BRAINS[0].id);
    expect(payload.toolCalled).toBeNull();
    expect(typeof payload.timings.total).toBe("number");
  });

  it("maps an upstream model failure to a mapped error, never a raw one", async () => {
    // The stream now opens before a brain is chosen (so the reader sees the
    // walk), which means a failure found while choosing arrives as a transient
    // refusal carrying the status and body the HTTP error used to. Either way
    // the raw upstream text must never reach the reader.
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
    const bodyText = await response.text();
    expect(bodyText).not.toContain("simulated upstream failure");
    const refusal = refusalOf(bodyText);
    expect(refusal.status).toBe(500);
    expect(refusal.payload.error).toBe(
      "Something went wrong answering that question.",
    );
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
    await markBrain(usage, BRAINS[0], "spent", getUnixNowMs());

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

  it("asks the reader's pick first even when the ledger has it spent, then falls through", async () => {
    /* The selector and the progress line must agree: a pick quietly moved to
       the back read as Dox ignoring the reader. A spent brain refuses fast,
       so honouring the pick costs one refusal. */
    const usage = fakeUsage();
    await markBrain(usage, BRAINS[2], "spent", getUnixNowMs());

    const asked: string[] = [];
    const resolveModel = (brainId: string) => {
      asked.push(brainId);
      if (brainId !== BRAINS[2].id) return fakeModel("an answer");
      return new MockLanguageModelV4({
        doStream: async () => {
          throw new APICallError({
            message: "quota",
            url: "https://x.test",
            requestBodyValues: {},
            statusCode: 429,
            isRetryable: true,
          });
        },
      });
    };
    const handler = makeHandler({ resolveModel, usage });

    const response = await handler(
      chatRequest({
        messages: [userMessage("what is a DST gap")],
        model: BRAINS[2].id,
      }),
    );
    expect(response.status).toBe(200);
    await response.text();
    expect(asked).toEqual([BRAINS[2].id, BRAINS[0].id]);
  });

  it("moves past a brain that has not started answering in time, without retiring it", async () => {
    /* A model that sends nothing held the whole request until the chat's own
       stall timer gave up. The walk now gives each brain a start deadline. */
    const usage = fakeUsage();
    const asked: string[] = [];
    const resolveModel = (brainId: string) => {
      asked.push(brainId);
      if (brainId !== BRAINS[0].id) return fakeModel("The next one answered.");
      return new MockLanguageModelV4({
        doStream: ({ abortSignal }) =>
          new Promise((_, reject) => {
            abortSignal?.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            );
          }),
      });
    };
    const handler = makeHandler({
      resolveModel,
      usage,
      startTimeoutMs: () => 20,
    });

    const response = await handler(
      chatRequest({ messages: [userMessage("what is a DST gap")] }),
    );
    const body = await response.text();

    expect(body).toContain("The next one answered.");
    expect(asked).toEqual([BRAINS[0].id, BRAINS[1].id]);
    expect(
      partsOfType(body, "data-status").map(
        (part) => (part.data as { text: string }).text,
      ),
    ).toEqual([
      `Asking ${BRAINS[0].label}\u2026`,
      `${BRAINS[0].label} is taking too long \u2014 trying the next model\u2026`,
      `Asking ${BRAINS[1].label}\u2026`,
    ]);
    // Slow today says nothing about tomorrow: the ledger is untouched.
    const [usagePart] = partsOfType(body, "data-usage");
    const states = (usagePart.data as BrainsInfo).brains.map((b) => b.state);
    expect(states.every((state) => state === "ok")).toBe(true);
  });

  it("keeps a brain that starts in time but is still writing at the deadline", async () => {
    /* The deadline is for starting, not finishing: a long answer, such as a
       widget and then its prose, must not be thrown away part-way. */
    const asked: string[] = [];
    const resolveModel = (brainId: string) => {
      asked.push(brainId);
      return slowFinishingModel("A long answer.", 150);
    };
    const handler = makeHandler({
      resolveModel,
      usage: fakeUsage(),
      startTimeoutMs: () => 50,
    });

    const response = await handler(
      chatRequest({ messages: [userMessage("what is a DST gap")] }),
    );
    const body = await response.text();

    expect(body).toContain("A long answer.");
    expect(asked).toEqual([BRAINS[0].id]);
    expect(partsOfType(body, "data-refusal")).toEqual([]);
  });

  it("asks the reader to try again when no brain starts in time", async () => {
    /* Nothing was spent, so this must not read as the daily allowance. */
    const usage = fakeUsage();
    const handler = makeHandler({
      resolveModel: () => silentModel(),
      usage,
      startTimeoutMs: () => 20,
    });

    const response = await handler(
      chatRequest({ messages: [userMessage("what is a DST gap")] }),
    );
    const refusal = refusalOf(await response.text());

    expect(refusal.status).toBe(503);
    expect(refusal.payload.retryable).toBe(true);
    expect(String(refusal.payload.error)).not.toMatch(/allowance|tomorrow/);
    expect(refusal.payload.resetsAt).toBeUndefined();
    expect(
      await usage.get(`state:${brainDay(BRAINS[0])}:${BRAINS[0].id}`),
    ).toBeNull();
  });

  it("sends the counts as they stand after the question, so the badge needs no refetch", async () => {
    // KV can take a minute to show a write, and the reader saw "5 left"
    // after asking. The stream carries the new counts instead.
    const usage = fakeUsage();
    const { resolveModel } = spyResolver();
    const handler = makeHandler({ resolveModel, usage });

    const response = await handler(
      chatRequest({ messages: [userMessage("what is a DST gap")] }),
    );
    const body = await response.text();

    const parts = partsOfType(body, "data-usage");
    expect(parts).toHaveLength(1);
    expect(parts[0].transient).toBe(true);
    const info = parts[0].data as BrainsInfo;
    expect(info.visitor.used).toBe(1);
    const answered = info.brains.find((brain) => brain.id === BRAINS[0].id)!;
    expect(answered.remaining).toBe(BRAINS[0].dailyLimit - 1);
    const untouched = info.brains.find((brain) => brain.id === BRAINS[1].id)!;
    expect(untouched.remaining).toBe(BRAINS[1].dailyLimit);
  });

  it("shows a brain the walk found out in the same usage part", async () => {
    const usage = fakeUsage();
    const handler = makeHandler({
      usage,
      resolveModel: (brainId) =>
        brainId === BRAINS[0].id
          ? new MockLanguageModelV4({
              doStream: async () => {
                throw new APICallError({
                  message: "no such model",
                  url: "https://x.test",
                  requestBodyValues: {},
                  statusCode: 404,
                  isRetryable: false,
                });
              },
            })
          : fakeModel("an answer"),
    });

    const response = await handler(
      chatRequest({ messages: [userMessage("what is a DST gap")] }),
    );
    const body = await response.text();

    const info = partsOfType(body, "data-usage")[0].data as BrainsInfo;
    const out = info.brains.find((brain) => brain.id === BRAINS[0].id)!;
    expect(out.state).toBe("unavailable");
    expect(out.remaining).toBe(0);
    expect(info.activeBrainId).toBe(BRAINS[1].id);
  });

  it("sends no usage part when there is no ledger", async () => {
    const { resolveModel } = spyResolver();
    const handler = makeHandler({ resolveModel });

    const response = await handler(
      chatRequest({ messages: [userMessage("what is a DST gap")] }),
    );
    expect(partsOfType(await response.text(), "data-usage")).toEqual([]);
  });

  it("reports exhaustion as a sentinel state with a reset time, not an error", async () => {
    const NOW = convertUtcToUnix("2026-06-15T19:00:00Z")!; // noon Pacific
    const usage = fakeUsage();
    for (const brain of BRAINS) {
      await markBrain(usage, brain, "spent", NOW);
    }

    const { resolveModel } = spyResolver();
    const handler = makeHandler({ resolveModel, usage, now: () => NOW });

    const response = await handler(
      chatRequest({ messages: [userMessage("what is a DST gap")] }),
    );
    expect(response.status).toBe(429);

    const body = (await response.json()) as Record<string, unknown>;
    // The reader is told when it comes back, not just that it is gone — and
    // with Gemini on Pacific time and Workers AI on UTC (DOX-C4), that is the
    // soonest refill, UTC midnight here, not "midnight Pacific".
    expect(body.resetsAt).toBe(convertUnixToUtc(nextMidnightMs(NOW, "UTC")));
    expect(String(body.error)).not.toMatch(/Pacific|UTC|midnight/);
  });

  it("gives Pacific midnight as the soonest refill when only Gemini is configured", async () => {
    const NOW = convertUtcToUnix("2026-06-15T19:00:00Z")!;
    const geminiOnly = BRAINS.filter((brain) => brain.provider === "google");
    const usage = fakeUsage();
    for (const brain of geminiOnly) {
      await markBrain(usage, brain, "spent", NOW);
    }

    const handler = makeHandler({
      ...spyResolver(),
      brains: geminiOnly,
      usage,
      now: () => NOW,
    });

    const response = await handler(
      chatRequest({ messages: [userMessage("what is a DST gap")] }),
    );
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.resetsAt).toBe("2026-06-16T07:00:00Z");
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

    expect(
      await usage.get(`model:${brainDay(BRAINS[0])}:${BRAINS[0].id}`),
    ).toBe("1");
  });

  it("stops a visitor who has spent their daily allowance", async () => {
    const usage = fakeUsage();
    const hash = await hashVisitor("9.9.9.9");
    for (let i = 0; i < VISITOR_DAILY_MAX; i++) {
      await recordRequest(usage, BRAINS[0], hash, getUnixNowMs());
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

  it("tells a capped visitor the cap resets at UTC midnight, on the same instant it reports", async () => {
    // 17:30 PDT on the 15th is already the 16th in UTC.
    const NOW = convertUtcToUnix("2026-06-16T00:30:00Z")!;
    const usage = fakeUsage();
    const hash = await hashVisitor("9.9.9.9");
    for (let i = 0; i < VISITOR_DAILY_MAX; i++) {
      await recordRequest(usage, BRAINS[0], hash, NOW);
    }

    const handler = makeHandler({ ...spyResolver(), usage, now: () => NOW });
    const response = await handler(
      chatRequest({ messages: [userMessage("what is a DST gap")] }),
    );
    expect(response.status).toBe(429);
    const body = (await response.json()) as Record<string, unknown>;
    expect(String(body.error)).toContain("midnight UTC");
    expect(body.resetsAt).toBe("2026-06-17T00:00:00Z");
  });

  it("exempts a dev from the visitor cap", async () => {
    const usage = fakeUsage();
    const hash = await hashVisitor("9.9.9.9");
    for (let i = 0; i < VISITOR_DAILY_MAX * 2; i++) {
      await recordRequest(usage, BRAINS[0], hash, getUnixNowMs());
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
    // The trace shows the walk: the spent brain, then the one that answered.
    const [opening] = retrievalParts(body);
    expect((opening.data as Record<string, unknown>).attempts).toEqual([
      { brainId: BRAINS[0].id, ms: expect.any(Number), outcome: "spent" },
      { brainId: BRAINS[1].id, ms: expect.any(Number), outcome: "answered" },
    ]);
  });

  it("bounds Gemini's thinking with the brain's thinkingLevel", async () => {
    const gemini = BRAINS.find((brain) => brain.provider === "google")!;
    const model = fakeModel("ok");
    const handler = makeHandler({
      resolveModel: singleBrain(model),
      searchChunksImpl: () => SAMPLE_CHUNKS,
    });
    const response = await handler(
      chatRequest({
        messages: [userMessage("what is a DST gap")],
        model: gemini.id,
      }),
    );
    await response.text();

    const [call] = model.doStreamCalls;
    expect(call.providerOptions).toEqual({
      google: { thinkingConfig: { thinkingLevel: gemini.thinkingLevel } },
    });
    expect(gemini.thinkingLevel).toBe("low");
  });

  it("moves to the next brain on a retryable 429 without retrying the spent one first", async () => {
    // A daily quota does not refill in two seconds. Every SDK retry was a
    // 2 s pause in front of the failover; the next brain is the retry.
    const quota = new APICallError({
      message: "quota",
      url: "https://x.test",
      requestBodyValues: {},
      statusCode: 429,
      isRetryable: true,
    });
    const spent = new MockLanguageModelV4({
      doStream: async () => {
        throw quota;
      },
    });
    const fallback = fakeModel("Answered by the fallback brain.");
    const handler = makeHandler({
      resolveModel: (brainId) => (brainId === BRAINS[0].id ? spent : fallback),
    });

    const started = performance.now();
    const response = await handler(
      chatRequest({ messages: [userMessage("what is a DST gap")] }),
    );
    const body = await response.text();

    expect(body).toContain("Answered by the fallback brain.");
    expect(spent.doStreamCalls).toHaveLength(1);
    expect(performance.now() - started).toBeLessThan(1500);
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

    expect(
      await usage.get(`state:${brainDay(BRAINS[0])}:${BRAINS[0].id}`),
    ).toBe("spent");
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
    const refusal = refusalOf(await response.text());
    expect(refusal.status).toBe(429);
    expect(String(refusal.payload.error)).toMatch(/free allowance/);
    expect(typeof refusal.payload.resetsAt).toBe("string");
  });

  /** Gemini's overload reply, as observed live on 2026-09-24. */
  function highDemand(): APICallError {
    return new APICallError({
      message:
        "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.",
      url: "https://generativelanguage.googleapis.com/x",
      requestBodyValues: {},
      statusCode: 503,
      isRetryable: true,
    });
  }

  it("moves past a model that is busy right now, and does not mark it out for the day", async () => {
    const usage = fakeUsage();
    const asked: string[] = [];
    const handler = makeHandler({
      usage,
      resolveModel: (brainId) => {
        asked.push(brainId);
        if (brainId === BRAINS[0].id) {
          return new MockLanguageModelV4({
            doStream: async () => {
              throw highDemand();
            },
          });
        }
        return fakeModel("Answered by the next brain.");
      },
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await handler(
      chatRequest({ messages: [userMessage("what is a DST gap")] }),
    );
    const body = await response.text();
    vi.restoreAllMocks();

    expect(response.status).toBe(200);
    expect(body).toContain("Answered by the next brain.");
    expect(asked).toEqual([BRAINS[0].id, BRAINS[1].id]);
    const [opening] = retrievalParts(body);
    expect((opening.data as Record<string, unknown>).attempts).toEqual([
      { brainId: BRAINS[0].id, ms: expect.any(Number), outcome: "busy" },
      { brainId: BRAINS[1].id, ms: expect.any(Number), outcome: "answered" },
    ]);
    // A busy minute is not a spent day: the next request tries it again.
    const snapshot = await readUsage(usage, BRAINS, "x", getUnixNowMs());
    expect(snapshot.states[BRAINS[0].id] ?? "ok").toBe("ok");
  });

  it("asks the reader to try again, not 'allowance used', when every brain is busy", async () => {
    const asked: string[] = [];
    const handler = makeHandler({
      brains: BRAINS.slice(0, 3),
      resolveModel: (brainId) => {
        asked.push(brainId);
        return new MockLanguageModelV4({
          doStream: async () => {
            throw highDemand();
          },
        });
      },
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await handler(
      chatRequest({ messages: [userMessage("what is a DST gap")] }),
    );
    const refusal = refusalOf(await response.text());
    vi.restoreAllMocks();

    expect(asked).toEqual(BRAINS.slice(0, 3).map((brain) => brain.id));
    expect(refusal.status).not.toBe(429);
    expect(refusal.payload.retryable).toBe(true);
    expect(String(refusal.payload.error)).not.toContain("allowance");
  });

  it("narrates the walk across brains as transient progress, before the answer", async () => {
    const handler = makeHandler({
      resolveModel: (brainId) =>
        brainId === BRAINS[0].id
          ? new MockLanguageModelV4({
              doStream: async () => {
                throw highDemand();
              },
            })
          : fakeModel("An answer."),
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await handler(
      chatRequest({ messages: [userMessage("what is a DST gap")] }),
    );
    const body = await response.text();
    vi.restoreAllMocks();

    const status = partsOfType(body, "data-status");
    expect(status.every((part) => part.transient === true)).toBe(true);
    expect(status.map((part) => (part.data as { text: string }).text)).toEqual([
      `Asking ${BRAINS[0].label}\u2026`,
      `${BRAINS[0].label} is busy \u2014 trying the next model\u2026`,
      `Asking ${BRAINS[1].label}\u2026`,
    ]);
    // All progress lands before the trace, which lands before the answer.
    expect(body.indexOf("data-status")).toBeLessThan(
      body.indexOf("data-retrieval"),
    );
    expect(partsOfType(body, "data-refusal")).toEqual([]);
  });

  it("still stops at the first brain on a 500, which says nothing about the model", async () => {
    const asked: string[] = [];
    const handler = makeHandler({
      resolveModel: (brainId) => {
        asked.push(brainId);
        return new MockLanguageModelV4({
          doStream: async () => {
            throw new APICallError({
              message: "internal",
              url: "https://x.test",
              requestBodyValues: {},
              statusCode: 500,
              isRetryable: true,
            });
          },
        });
      },
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await handler(
      chatRequest({ messages: [userMessage("what is a DST gap")] }),
    );
    vi.restoreAllMocks();
    expect(asked).toEqual([BRAINS[0].id]);
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
    expect(refusalOf(await response.text()).status).toBe(500);
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

    expect(
      await usage.get(`state:${brainDay(BRAINS[0])}:${BRAINS[0].id}`),
    ).toBe("spent");
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

  describe("Workers AI brains (DOX-C4)", () => {
    const NOW = convertUtcToUnix("2026-06-15T19:00:00Z")!; // noon Pacific
    const cfBrains = BRAINS.filter((brain) => brain.provider === "workers-ai");
    const geminiBrain = BRAINS.find((brain) => brain.provider === "google")!;
    /** Two Workers AI brains, whatever `BRAINS` currently enables — the shared
     * pool behaviour under test only exists when there is more than one. */
    const cfPool: Brain[] = [
      cfBrains[0],
      { ...cfBrains[0], id: "cf-second", label: "Second · CF" },
    ];

    function failing(error: unknown) {
      return new MockLanguageModelV4({
        doStream: async () => {
          throw error;
        },
      });
    }

    it("retires every Workers AI brain at once when the shared allocation is gone", async () => {
      // The 10,000 Neurons are per account. One brain saying so is all of them
      // saying so; asking the other three would spend three doomed requests.
      const allocationGone = new APICallError({
        message:
          "4006: you have used up your daily free allocation of 10,000 neurons, please upgrade to Cloudflare's Workers Paid plan",
        url: `workers-ai:binding/run/${cfBrains[0].model}`,
        requestBodyValues: {},
      });

      const ttls = new Map<string, number | undefined>();
      const usage: UsageStore = {
        async get() {
          return null;
        },
        async put(key, _value, options) {
          ttls.set(key, options?.expirationTtl);
        },
      };

      const asked: string[] = [];
      const handler = makeHandler({
        brains: [...cfPool, geminiBrain],
        usage,
        now: () => NOW,
        resolveModel: (brainId) => {
          asked.push(brainId);
          return brainId === geminiBrain.id
            ? fakeModel("Gemini picked it up.")
            : failing(allocationGone);
        },
      });

      const response = await handler(
        chatRequest({ messages: [userMessage("what is a DST gap")] }),
      );
      expect(response.status).toBe(200);
      expect(await response.text()).toContain("Gemini picked it up.");
      expect(asked).toEqual([cfBrains[0].id, geminiBrain.id]);

      // Every Workers AI brain is marked — bucketed by the UTC day and expiring
      // at the UTC midnight its pool refills on.
      for (const brain of cfPool) {
        expect(ttls.get(`state:${dayKey(NOW, "UTC")}:${brain.id}`)).toBe(
          secondsUntilMidnight(NOW, "UTC"),
        );
      }
    });

    it("moves past a capacity 429 without retiring the rest of the pool", async () => {
      // 3040 is one model briefly out of capacity, not the account's day.
      const busy = new APICallError({
        message: "3040: No more data centers to forward the request to",
        url: `workers-ai:binding/run/${cfBrains[0].model}`,
        requestBodyValues: {},
        statusCode: 429,
        isRetryable: false,
        data: { workersAIErrorCode: 3040 },
      });

      const asked: string[] = [];
      const handler = makeHandler({
        brains: cfPool,
        resolveModel: (brainId) => {
          asked.push(brainId);
          return brainId === cfPool[0].id
            ? failing(busy)
            : fakeModel("The next Workers AI brain answered.");
        },
      });

      const response = await handler(
        chatRequest({ messages: [userMessage("what is a DST gap")] }),
      );
      expect(await response.text()).toContain(
        "The next Workers AI brain answered.",
      );
      expect(asked).toEqual([cfPool[0].id, cfPool[1].id]);
    });

    it("passes the brain's output cap, since Workers AI's default truncates at 256 tokens", async () => {
      const model = fakeModel("capped");
      const handler = makeHandler({
        brains: cfBrains,
        resolveModel: () => model,
      });

      await (
        await handler(
          chatRequest({ messages: [userMessage("what is a DST gap")] }),
        )
      ).text();
      expect(cfBrains[0].maxOutputTokens).toBeGreaterThan(256);
      expect(model.doStreamCalls[0].maxOutputTokens).toBe(
        cfBrains[0].maxOutputTokens,
      );
    });

    it("keeps a reasoning model's thinking out of the reader's stream", async () => {
      // DoxChat renders no reasoning part; forwarded, it would be invisible yet
      // re-sent upstream — and re-billed — on every later turn.
      const model = new MockLanguageModelV4({
        doStream: async () => ({
          stream: convertArrayToReadableStream<LanguageModelV4StreamPart>([
            { type: "stream-start", warnings: [] },
            { type: "reasoning-start", id: "r" },
            { type: "reasoning-delta", id: "r", delta: "PRIVATE-THINKING" },
            { type: "reasoning-end", id: "r" },
            ...textStreamParts("The visible answer.").slice(1),
          ]),
        }),
      });
      const handler = makeHandler({ resolveModel: () => model });

      const body = await (
        await handler(
          chatRequest({ messages: [userMessage("what is a DST gap")] }),
        )
      ).text();
      expect(body).toContain("The visible answer.");
      expect(body).not.toContain("PRIVATE-THINKING");
    });

    it("only tries the brains it is given", async () => {
      const { asked, resolveModel } = spyResolver();
      const handler = makeHandler({ brains: cfBrains, resolveModel });

      await (
        await handler(
          chatRequest({ messages: [userMessage("what is a DST gap")] }),
        )
      ).text();
      expect(asked).toEqual([cfBrains[0].id]);
    });
  });
});
