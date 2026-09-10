/// <reference types="vitest/globals" />
/**
 * Two things are pinned here:
 *
 * 1. Each tool's `execute` accepts a real call and reports a hallucinated zone
 *    rather than throwing.
 * 2. **The `ai` SDK behaviour the whole execute-vs-execute-less decision rests
 *    on.** That is a claim about a dependency, so it is asserted rather than
 *    written down — an `ai` upgrade that changed it would otherwise reintroduce
 *    a bug that only shows up on a reader's second question.
 */
import { convertToModelMessages, type UIMessage } from "ai";
import { DOX_TOOL_NAMES } from "../src/lib/dox-tools";
import { buildWorkerTools } from "./tools";

/* Every defined tool, not only the offered ones: a pending tool's `execute` is
   worth testing before its widget lands, so enabling it is a one-line change
   rather than a change plus a new test. Production never passes an argument —
   see `buildWorkerTools`. */
const tools = buildWorkerTools(DOX_TOOL_NAMES);

/** Invoke a tool's `execute` the way `streamText` does. */
async function run(name: keyof typeof tools, input: unknown) {
  const tool = tools[name] as {
    execute: (input: unknown, options: unknown) => unknown;
  };
  return (await tool.execute(input, {
    toolCallId: "c1",
    messages: [],
  })) as { ok: boolean; widget: string; note?: string };
}

describe("worker tool execute", () => {
  it("accepts a real globe call", async () => {
    const result = await run("showGlobe", { zone: "Asia/Tokyo" });
    expect(result.ok).toBe(true);
    expect(result.widget).toBe("globe");
  });

  it("reports an invented zone instead of throwing", async () => {
    // Shape-valid, semantically nonsense — it clears the zod regex by design.
    const result = await run("showGlobe", { zone: "Mars/Olympus_Mons" });
    expect(result.ok).toBe(false);
    expect(result.note).toContain("Mars/Olympus_Mons");
  });

  it("checks both ends of a conversion", async () => {
    expect(
      (
        await run("showConverterBench", {
          value: "2026-11-01T01:30",
          from: "America/New_York",
          to: "Asia/Tokyo",
        })
      ).ok,
    ).toBe(true);

    expect(
      (
        await run("showConverterBench", {
          value: "2026-11-01T01:30",
          from: "America/New_York",
          to: "Nowhere/Special",
        })
      ).ok,
    ).toBe(false);
  });

  it("validates the DST inspector's zone", async () => {
    expect(
      (await run("showDstInspector", { zone: "America/New_York", year: 2026 }))
        .ok,
    ).toBe(true);
    expect(
      (await run("showDstInspector", { zone: "Fake/Zone", year: 2026 })).ok,
    ).toBe(false);
  });

  it("does no I/O and no model call — execute is synchronous work only", () => {
    // The premise of "costs no extra latency and no extra quota". If a tool
    // ever needs to await something, that claim has to be re-argued.
    for (const name of Object.keys(tools) as (keyof typeof tools)[]) {
      const tool = tools[name] as { execute: (...a: unknown[]) => unknown };
      const returned = tool.execute(
        {
          zone: "UTC",
          year: 2026,
          value: "2026-01-01T00:00",
          from: "UTC",
          to: "UTC",
        },
        {},
      );
      expect(returned).not.toBeInstanceOf(Promise);
    }
  });
});

/* These pin `ai@7.0.95`'s own behaviour. See worker/tools.ts's docstring. */
describe("convertToModelMessages — why the tools carry an execute", () => {
  const assistantTurn = (state: string, extra: Record<string, unknown> = {}) =>
    [
      {
        id: "u1",
        role: "user",
        parts: [{ type: "text", text: "world clock" }],
      },
      {
        id: "a1",
        role: "assistant",
        parts: [
          { type: "text", text: "Here you go." },
          {
            type: "tool-showGlobe",
            toolCallId: "c1",
            state,
            input: { zone: "Asia/Tokyo" },
            ...extra,
          },
        ],
      },
    ] as unknown as UIMessage[];

  const shape = (messages: { role: string; content: unknown }[]) =>
    messages.map(
      (m) =>
        `${m.role}[${
          typeof m.content === "string"
            ? "text"
            : (m.content as { type: string }[]).map((c) => c.type).join(",")
        }]`,
    );

  it("leaves a DANGLING tool-call when the part never reaches a terminal state", async () => {
    // This is the failure. A `functionCall` with no `functionResponse` is
    // history Gemini rejects — and it would only ever surface one turn later.
    const converted = await convertToModelMessages(
      assistantTurn("input-available"),
    );
    expect(shape(converted)).toEqual([
      "user[text]",
      "assistant[text,tool-call]",
    ]);
  });

  it("emits a matching tool-result once the part is terminal", async () => {
    const converted = await convertToModelMessages(
      assistantTurn("output-available", {
        output: { ok: true, widget: "globe" },
      }),
    );
    expect(shape(converted)).toEqual([
      "user[text]",
      "assistant[text,tool-call]",
      "tool[tool-result]",
    ]);
  });

  it("drops an incomplete call when asked, which is what Stop mid-call leaves behind", async () => {
    // With `execute` attached the window is small, but a reader who stops the
    // stream between the call chunk and the result chunk still lands here.
    const converted = await convertToModelMessages(
      assistantTurn("input-available"),
      { ignoreIncompleteToolCalls: true },
    );
    expect(shape(converted)).toEqual(["user[text]", "assistant[text]"]);
  });
});
