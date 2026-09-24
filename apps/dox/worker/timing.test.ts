/// <reference types="vitest/globals" />
import { convertArrayToReadableStream } from "ai/test";
import { observeOutput, Stopwatch } from "./timing";

async function drain<T>(stream: ReadableStream<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const chunk of stream as unknown as AsyncIterable<T>)
    out.push(chunk);
  return out;
}

describe("Stopwatch", () => {
  it("times each stage in whole milliseconds and reports every pre-stream stage", async () => {
    let now = 0;
    const watch = new Stopwatch(() => now);

    await watch.time("usage", () => {
      now += 3.4;
    });
    await watch.time("search", async () => {
      now += 60;
      return "ignored";
    });

    expect(watch.snapshot()).toEqual({
      usage: 3,
      corpus: 0,
      search: 60,
      prompt: 0,
      brains: 0,
    });
  });

  it("returns the stage's own result", async () => {
    const watch = new Stopwatch(() => 0);
    await expect(watch.time("corpus", async () => 42)).resolves.toBe(42);
  });

  it("still records a stage that throws", async () => {
    let now = 0;
    const watch = new Stopwatch(() => now);
    await expect(
      watch.time("brains", () => {
        now += 10;
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(watch.snapshot().brains).toBe(10);
  });

  it("marks the first token once and the total from the request start", () => {
    let now = 100;
    const watch = new Stopwatch(() => now);
    now = 350;
    watch.markFirstToken();
    now = 900;
    watch.markFirstToken(); // a second call must not move it
    watch.markTotal();
    expect(watch.snapshot()).toMatchObject({ firstToken: 250, total: 800 });
  });
});

describe("observeOutput", () => {
  it("passes every chunk through untouched", async () => {
    const parts = [
      { type: "start" },
      { type: "text-delta", text: "hi" },
      { type: "finish" },
    ];
    const out = await drain(
      observeOutput(convertArrayToReadableStream(parts), {
        onFirstOutput: () => {},
        onToolCall: () => {},
        onEnd: () => {},
      }),
    );
    expect(out).toEqual(parts);
  });

  it("reports the first visible output once, and the end once", async () => {
    const events: string[] = [];
    await drain(
      observeOutput(
        convertArrayToReadableStream([
          { type: "start" },
          { type: "start-step" },
          { type: "text-delta", text: "a" },
          { type: "text-delta", text: "b" },
          { type: "finish" },
        ]),
        {
          onFirstOutput: () => events.push("first"),
          onToolCall: () => events.push("tool"),
          onEnd: () => events.push("end"),
        },
      ),
    );
    expect(events).toEqual(["first", "end"]);
  });

  it("names a tool call, and counts its input as the first output", async () => {
    const events: string[] = [];
    await drain(
      observeOutput(
        convertArrayToReadableStream([
          { type: "start" },
          { type: "tool-input-start", id: "t1", toolName: "showGlobe" },
          { type: "tool-call", toolCallId: "t1", toolName: "showGlobe" },
          { type: "finish" },
        ]),
        {
          onFirstOutput: () => events.push("first"),
          onToolCall: (name) => events.push(`tool:${name}`),
          onEnd: () => events.push("end"),
        },
      ),
    );
    expect(events).toEqual(["first", "tool:showGlobe", "end"]);
  });

  it("ends on an error chunk, and not again when the stream closes", async () => {
    const events: string[] = [];
    await drain(
      observeOutput(
        convertArrayToReadableStream([
          { type: "text-delta", text: "a" },
          { type: "error", error: new Error("mid-answer") },
        ]),
        {
          onFirstOutput: () => events.push("first"),
          onToolCall: () => {},
          onEnd: () => events.push("end"),
        },
      ),
    );
    expect(events).toEqual(["first", "end"]);
  });
});
