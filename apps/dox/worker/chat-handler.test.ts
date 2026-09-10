/// <reference types="vitest/globals" />
import { convertArrayToReadableStream, MockLanguageModelV4 } from "ai/test";
import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { createChatHandler, type ChatHandlerDeps } from "./chat-handler";
import { resetRateLimitState } from "./rate-limit";
import type { RetrievalChunk } from "../src/lib/retrieval/types";

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
        inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
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
  overrides: Partial<ChatHandlerDeps> & Pick<ChatHandlerDeps, "model">,
) {
  return createChatHandler({
    vocabulary: "FAKE_VOCABULARY_CONTENT",
    coreRules: "FAKE_CORE_RULES_CONTENT",
    fetchChunksImpl: async () => SAMPLE_CHUNKS,
    ...overrides,
  });
}

function chatRequest(body: unknown): Request {
  return new Request("https://gmt-dox.example/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": "9.9.9.9" },
    body: JSON.stringify(body),
  });
}

function userMessage(text: string) {
  return { id: "m1", role: "user", parts: [{ type: "text", text }] };
}

describe("createChatHandler", () => {
  beforeEach(() => resetRateLimitState());

  it("streams a grounded response when retrieval finds relevant chunks", async () => {
    const handler = makeHandler({
      model: fakeModel("Use convertZonedToZoned to convert between IANA zones."),
    });

    const response = await handler(
      chatRequest({ messages: [userMessage("how do I convert between zones")] }),
    );

    expect(response.status).toBe(200);
    const bodyText = await response.text();
    expect(bodyText).toContain("convertZonedToZoned");
  });

  it("assembles an empty-context prompt (refusal setup) when retrieval finds nothing", async () => {
    const model = fakeModel("The documentation does not cover this.");
    const handler = makeHandler({ model });

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
    const handler = makeHandler({ model });

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
    const handler = makeHandler({ model });

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
    const handler = makeHandler({ model });

    const response = await handler(chatRequest({ messages: [] }));
    expect(response.status).toBe(400);
    expect(model.doStreamCalls).toHaveLength(0);
  });

  it("maps an upstream model failure to a mapped in-stream error, not a crash", async () => {
    // The model call happens lazily while the stream is consumed, not when
    // streamText() is invoked — verified live during this story (an invalid
    // model name did not throw synchronously; it surfaced as an in-stream
    // error frame after a 200 response). A doStream rejection behaves the
    // same way, so the mapped message shows up in the SSE body, not the
    // HTTP status.
    const model = new MockLanguageModelV4({
      doStream: async () => {
        throw new Error("simulated upstream failure");
      },
    });
    const handler = makeHandler({ model });

    const response = await handler(
      chatRequest({ messages: [userMessage("how do I convert between zones")] }),
    );
    expect(response.status).toBe(200);
    const bodyText = await response.text();
    expect(bodyText).not.toContain("simulated upstream failure");
    expect(bodyText).toContain("Something went wrong answering that question.");
  });
});
