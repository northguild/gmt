import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { emptyRecord, linesOf, readStream } from "./read-stream";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) =>
  readFileSync(join(here, "fixtures", `${name}.sse`), "utf8").split("\n");

describe("readStream", () => {
  it("reads a clean tool-then-prose turn", async () => {
    const record = await readStream(fixture("tool-then-prose"));
    expect(record.brainId).toBe("cf-gemma-4-26b");
    expect(record.toolCalls).toEqual([
      {
        toolName: "showConverterBench",
        input: {
          value: "2024-03-15T14:30:00+11:00[Australia/Sydney]",
          from: "Australia/Sydney",
          to: "Asia/Tokyo",
        },
      },
    ]);
    expect(record.answer).toContain("That is 12:30 in Tokyo.");
    expect(record.answer).toContain("convertZonedToZoned");
    expect(record.toolErrors).toEqual([]);
    expect(record.errors).toEqual([]);
    expect(record.refusalPart).toBe(false);
  });

  it("lets the second write of the retrieval part win", async () => {
    const record = await readStream(fixture("tool-then-prose"));
    expect(record.timings).toEqual({ firstToken: 1210, total: 3480 });
    const plain = await readStream(fixture("retrieval-twice"));
    expect(plain.timings).toEqual({ firstToken: 500, total: 900 });
    expect(plain.chunkUrls).toEqual(["/reference/a", "/reference/b"]);
    expect(plain.toolCalls).toEqual([]);
  });

  it("records a rejected tool input and a call that never completed", async () => {
    const record = await readStream(fixture("tool-input-error"));
    expect(record.toolCalls).toEqual([]);
    expect(record.toolErrors).toEqual([
      "showGlobe: Invalid input for tool showGlobe",
      "showDstInspector: call never completed",
    ]);
    expect(record.answer).toBe("Sorry about that.");
  });

  it("flags a data-refusal part", async () => {
    const record = await readStream(fixture("refusal"));
    expect(record.refusalPart).toBe(true);
    expect(record.answer).toBe("");
  });

  it("keeps raw tool-call text in the answer and collects error parts", async () => {
    const record = await readStream(fixture("tool-call-markup"));
    expect(record.answer).toContain("<tool_call>");
    expect(record.errors).toEqual(["upstream hiccup"]);
  });

  it("carries the status the caller gives and skips lines that are not data", async () => {
    expect(
      (await readStream(["", ": ping", "data: nope"], 200)).errors,
    ).toEqual(["unreadable stream line"]);
    expect((await readStream([], 429)).status).toBe(429);
    expect(emptyRecord(500).status).toBe(500);
  });

  it("splits a streamed body into lines across chunk edges", async () => {
    const encoder = new TextEncoder();
    const body = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"type":"text-del'));
          controller.enqueue(
            encoder.encode('ta","delta":"hi"}\n\ndata: [DONE]'),
          );
          controller.close();
        },
      }),
    ).body!;
    const record = await readStream(linesOf(body));
    expect(record.answer).toBe("hi");
  });
});
