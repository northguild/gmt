import type { UIMessageChunk } from "ai";
import {
  formatRecordedLabel,
  parseRecording,
  replayStream,
  type Recording,
} from "./replay";

const chunk = (id: string): UIMessageChunk => ({ type: "text-start", id });

const recording: Recording = {
  id: "demo",
  question: "What is a leap second?",
  brain: { id: "gemma", label: "Gemma 4 26B" },
  instant: "2026-12-10T09:00:00Z",
  chunks: [
    { at: 0, chunk: chunk("a") },
    { at: 100, chunk: chunk("b") },
    { at: 350, chunk: chunk("c") },
  ],
};

let controller: AbortController;

beforeEach(() => {
  vi.useFakeTimers();
  controller = new AbortController();
});

afterEach(() => {
  controller.abort();
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
});

/** Reads the stream into `seen` as chunks arrive; resolves when it ends. */
function collect(stream: ReadableStream<UIMessageChunk>, seen: string[]) {
  return (async () => {
    const reader = stream.getReader();
    for (;;) {
      const next = await reader.read();
      if (next.done) return;
      seen.push((next.value as { id: string }).id);
    }
  })();
}

describe("replayStream", () => {
  it("delivers the chunks in order, each at its offset", async () => {
    const seen: string[] = [];
    const done = collect(replayStream(recording, controller.signal), seen);
    await vi.advanceTimersByTimeAsync(0);
    expect(seen).toEqual(["a"]);
    await vi.advanceTimersByTimeAsync(99);
    expect(seen).toEqual(["a"]);
    await vi.advanceTimersByTimeAsync(1);
    expect(seen).toEqual(["a", "b"]);
    await vi.advanceTimersByTimeAsync(249);
    expect(seen).toEqual(["a", "b"]);
    await vi.advanceTimersByTimeAsync(1);
    await done;
    expect(seen).toEqual(["a", "b", "c"]);
  });

  it("stops, and leaves no timer, when the signal aborts", async () => {
    const seen: string[] = [];
    const reason = new Error("left the slide");
    const failure = collect(
      replayStream(recording, controller.signal),
      seen,
    ).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(100);
    controller.abort(reason);
    expect(await failure).toBe(reason);
    expect(seen).toEqual(["a", "b"]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(seen).toEqual(["a", "b"]);
  });

  it("starts already aborted without playing", async () => {
    const reason = new Error("gone");
    controller.abort(reason);
    const seen: string[] = [];
    const failure = collect(
      replayStream(recording, controller.signal),
      seen,
    ).catch((error: unknown) => error);
    expect(await failure).toBe(reason);
    expect(seen).toEqual([]);
  });

  it("stops its timer when the reader cancels", async () => {
    const stream = replayStream(recording);
    const reader = stream.getReader();
    await vi.advanceTimersByTimeAsync(0);
    await reader.read();
    await reader.cancel();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("parseRecording", () => {
  it("accepts a recording and returns it", () => {
    expect(parseRecording(JSON.parse(JSON.stringify(recording)))).toEqual(
      recording,
    );
  });

  it.each([
    ["not an object", 7],
    ["no question", { ...recording, question: "" }],
    ["no brain label", { ...recording, brain: { id: "gemma", label: "" } }],
    ["no instant", { ...recording, instant: "" }],
    ["no chunks", { ...recording, chunks: [] }],
    [
      "offsets that go back",
      {
        ...recording,
        chunks: [
          { at: 5, chunk: chunk("a") },
          { at: 1, chunk: chunk("b") },
        ],
      },
    ],
    ["a chunk with no type", { ...recording, chunks: [{ at: 0, chunk: {} }] }],
  ])("refuses %s", (_label, value) => {
    expect(parseRecording(value)).toBeNull();
  });
});

describe("formatRecordedLabel", () => {
  it("says Recorded, the date in the talk's zone and the brain", async () => {
    expect(await formatRecordedLabel(recording)).toBe(
      "Recorded 10 December 2026, Gemma 4 26B",
    );
  });

  it("keeps the brain when the instant is not a date", async () => {
    const label = await formatRecordedLabel({
      ...recording,
      instant: "not a date",
    });
    expect(label).toBe("Recorded, Gemma 4 26B");
  });
});
