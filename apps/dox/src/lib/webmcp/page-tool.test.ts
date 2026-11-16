import { z } from "zod";
import { WidgetLoadError } from "../widget-mount";
import {
  definePageTool,
  describeTool,
  toModelContextTool,
  type PageToolRun,
} from "./page-tool";

const input = z.object({
  anchor: z.string().min(4),
  days: z.number().int().min(1).max(7),
});

function def(
  run: (
    args: z.output<typeof input>,
    signal: AbortSignal,
  ) => Promise<PageToolRun<unknown>>,
  rules?: string[],
) {
  return definePageTool({
    page: "cutoff-ruler",
    name: "check_eta_against_cutoff",
    title: "Cut-off Ruler",
    doxTool: "showCutoffRuler",
    returns: "Three readings of one cut-off",
    calls: ["etaAtZone", "cutoffAt"],
    rules,
    input,
    example: { anchor: "2024-04-08T18:00:00Z", days: 2 },
    run,
  });
}

const ok = async (): Promise<PageToolRun<unknown>> => ({
  input: {},
  result: { at: "2024-04-06T18:00:00Z" },
  notes: [],
});

describe("toModelContextTool", () => {
  it("names the tool and marks it read-only", () => {
    const tool = toModelContextTool(def(ok));
    expect(tool).toMatchObject({
      name: "check_eta_against_cutoff",
      title: "Cut-off Ruler",
      annotations: { readOnlyHint: true },
    });
  });

  it("describes the input as a caller sends it, not as it parses", () => {
    const schema = toModelContextTool(def(ok)).inputSchema as {
      type: string;
      properties: Record<string, unknown>;
      additionalProperties?: unknown;
    };
    expect(schema.type).toBe("object");
    expect(Object.keys(schema.properties)).toEqual(["anchor", "days"]);
    expect(schema).not.toHaveProperty("additionalProperties", false);
  });

  it("resolves the run with the tool's name", async () => {
    const tool = toModelContextTool(def(ok));
    await expect(
      tool.execute({ anchor: "2024-04-08T18:00:00Z", days: 2 }),
    ).resolves.toEqual({
      ok: true,
      tool: "check_eta_against_cutoff",
      input: {},
      result: { at: "2024-04-06T18:00:00Z" },
      notes: [],
    });
  });

  it("resolves invalid input with the path and message of each issue, and runs nothing", async () => {
    const run = vi.fn(ok);
    const result = await toModelContextTool(def(run)).execute({ days: 9 });
    expect(result).toMatchObject({
      ok: false,
      error: "invalid-input",
      tool: "check_eta_against_cutoff",
    });
    if (result.ok || result.error !== "invalid-input") throw new Error("shape");
    expect(result.issues.map((issue) => issue.path).sort()).toEqual([
      "anchor",
      "days",
    ]);
    expect(result.issues.every((issue) => issue.message !== "")).toBe(true);
    expect(run).not.toHaveBeenCalled();
  });

  it("resolves a library that could not load as unavailable", async () => {
    const tool = toModelContextTool(
      def(async () => {
        throw new WidgetLoadError(new Error("offline"));
      }),
    );
    await expect(
      tool.execute({ anchor: "2024-04-08T18:00:00Z", days: 2 }),
    ).resolves.toEqual({
      ok: false,
      tool: "check_eta_against_cutoff",
      error: "unavailable",
      message: "The library for this widget could not be loaded.",
    });
  });

  it("rejects with the signal's reason when the call is aborted", async () => {
    const controller = new AbortController();
    const tool = toModelContextTool(
      def(async (_args, signal) => {
        controller.abort(new DOMException("stopped", "AbortError"));
        if (signal.aborted) throw signal.reason;
        return ok();
      }),
    );
    await expect(
      tool.execute(
        { anchor: "2024-04-08T18:00:00Z", days: 2 },
        { signal: controller.signal },
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it.each([
    ["an undefined field", { at: undefined }],
    ["a NaN", { at: Number.NaN }],
    ["a Map", { at: new Map() }],
    ["a class instance", { at: new (class Stamp {})() }],
  ])(
    "refuses a result with %s, which the browser could not serialise",
    async (_label, result) => {
      const tool = toModelContextTool(
        def(async () => ({ input: {}, result, notes: [] })),
      );
      await expect(
        tool.execute({ anchor: "2024-04-08T18:00:00Z", days: 2 }),
      ).rejects.toThrow(/JSON round trip/);
    },
  );
});

describe("describeTool", () => {
  const FORBIDDEN = /\b(drag|click|slider|drawn|widget|shown|page)s?\b/i;

  it("says what it returns, when to use it, the arguments, the rules and the calls", () => {
    const text = describeTool(def(ok, ["The days count runs from 1 to 7."]));
    expect(text).toMatch(/^Three readings of one cut-off\. Use it when /);
    expect(text).toContain("anchor (an instant");
    expect(text).toContain("The days count runs from 1 to 7.");
    expect(text).toMatch(/Calls etaAtZone, cutoffAt\.$/);
  });

  it("applies its argsSwaps to the chat args", () => {
    const swapped = definePageTool({
      ...def(ok),
      argsSwaps: [["anchor (an instant", "start (a moment"]],
    });
    const text = describeTool(swapped);
    expect(text).toContain("start (a moment");
    expect(text).not.toContain("anchor (an instant");
  });

  it("applies its whenSwaps to the chat when line, before the backticks go", () => {
    // showCronInAZone's chat line sets `30 2 * * *` in backticks.
    const swapped = definePageTool({
      ...def(ok),
      doxTool: "showCronInAZone",
      whenSwaps: [["`30 2 * * *` job", "daily 02:30 job"]],
    });
    const text = describeTool(swapped);
    expect(text).toContain("what happens to a daily 02:30 job in spring");
    expect(text).not.toMatch(/[`*]/);
  });

  it("throws when a whenSwap's text is not in the chat when line", () => {
    const stale = definePageTool({
      ...def(ok),
      whenSwaps: [["words the chat text no longer holds", "anything"]],
    });
    expect(() => describeTool(stale)).toThrow(/whenSwaps/);
  });

  it("says when to use it once, whichever way the chat line opens", () => {
    // showSsimDateReader's chat line opens "Call when the reader asks…".
    const text = describeTool({ ...def(ok), doxTool: "showSsimDateReader" });
    expect(text).toContain(" Use it when the reader asks about SSIM");
    expect(text).not.toMatch(/Call when/);
  });

  it("drops the backticks a chat line sets around a sample", () => {
    // showTai64nLogReader's chat line sets @4000… in backticks.
    const text = describeTool({ ...def(ok), doxTool: "showTai64nLogReader" });
    expect(text).toContain("starting with @4000");
    expect(text).not.toContain("`");
  });

  it("throws when a swap's text is not in the chat args", () => {
    const stale = definePageTool({
      ...def(ok),
      argsSwaps: [["words the chat text no longer holds", "anything"]],
    });
    expect(() => describeTool(stale)).toThrow(/argsSwaps/);
  });

  it("is plain prose of at most 1,000 characters", () => {
    const text = describeTool(def(ok));
    expect(text.length).toBeLessThanOrEqual(1000);
    expect(text).not.toMatch(FORBIDDEN);
    expect(text).not.toMatch(/[`*#]/);
  });
});
