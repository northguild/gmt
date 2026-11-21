/**
 * Fake `/gmt/api/chat` answers for the deck's live-answer tests: a `fetch` that returns a UI-message
 * event stream, one that never answers, and the recording that goes with it.
 */
import type { UIMessageChunk } from "ai";
import type { RetrievalTraceData } from "~/lib/chat-types";
import type { Recording } from "~/lib/slides/replay";

export function textChunks(text: string, brain = "gemma"): UIMessageChunk[] {
  return [
    { type: "start" },
    {
      type: "data-retrieval",
      data: {
        totalChunks: 1,
        retrievedCount: 1,
        chunkTitles: ["Leap seconds"],
        chunkUrls: [],
        brainId: brain,
        brainLabel: "Gemma 4 26B",
      } satisfies RetrievalTraceData,
    },
    { type: "text-start", id: "t" },
    { type: "text-delta", id: "t", delta: text },
    { type: "text-end", id: "t" },
    { type: "finish" },
  ];
}

export function toolChunks(): UIMessageChunk[] {
  return [
    { type: "start" },
    {
      type: "tool-input-start",
      toolCallId: "c1",
      toolName: "convert_time_zone",
    },
    {
      type: "tool-input-available",
      toolCallId: "c1",
      toolName: "convert_time_zone",
      input: { instant: "2027-03-28T01:30:00Z" },
    },
    {
      type: "tool-output-available",
      toolCallId: "c1",
      output: { local: "04:30" },
    },
    { type: "finish" },
  ];
}

function eventStream(
  chunks: readonly UIMessageChunk[],
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const lines = [
    ...chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`),
    "data: [DONE]\n\n",
  ];
  return new ReadableStream({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(line));
      controller.close();
    },
  });
}

export function answering(chunks: readonly UIMessageChunk[]): typeof fetch {
  return async () =>
    new Response(eventStream(chunks), {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });
}

export function failingWith(status: number): typeof fetch {
  return async () => new Response(JSON.stringify({ error: "no" }), { status });
}

export function refusing(): typeof fetch {
  return answering([
    { type: "start" },
    {
      type: "data-refusal",
      data: { status: 429, payload: {} },
    } as unknown as UIMessageChunk,
  ]);
}

export function unreachable(): typeof fetch {
  return async () => {
    throw new TypeError("network down");
  };
}

/** Answers with headers and then nothing, until the request is aborted. */
export function stalling(): typeof fetch {
  return async (_input, init) => {
    const signal = init?.signal;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        signal?.addEventListener(
          "abort",
          () => controller.error(signal.reason),
          { once: true },
        );
      },
    });
    return new Response(body, {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });
  };
}

export function recordingOf(id: string, text: string): Recording {
  return {
    id,
    question: "What is a leap second?",
    brain: { id: "gemma", label: "Gemma 4 26B" },
    instant: "2026-12-10T09:00:00Z",
    chunks: textChunks(text).map((chunk, i) => ({ at: i * 10, chunk })),
  };
}
