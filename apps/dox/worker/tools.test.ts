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

  it("validates the planner's zones", async () => {
    expect(
      (
        await run("showZonePlanner", {
          zones: ["America/New_York", "Asia/Tokyo"],
        })
      ).ok,
    ).toBe(true);
    const rejected = await run("showZonePlanner", {
      zones: ["America/New_York", "Fake/Zone"],
    });
    expect(rejected.ok).toBe(false);
    expect(rejected.note).toContain("Fake/Zone");
  });

  it("validates the Holiday Rule Builder's zone", async () => {
    expect(await run("showHolidayRuleBuilder", {})).toEqual({
      ok: true,
      widget: "holiday-rule-builder",
    });
    expect(
      await run("showHolidayRuleBuilder", { zone: "Europe/Oslo" }),
    ).toEqual({ ok: true, widget: "holiday-rule-builder" });
    const rejected = await run("showHolidayRuleBuilder", {
      zone: "Fake/Zone",
    });
    expect(rejected.ok).toBe(false);
    expect(rejected.note).toContain("Fake/Zone");
  });

  it("accepts a B/L date stamp for a zone the library cannot read, and for an offset", async () => {
    // Other zone tools reject an unknown zone. This one does not: a place the
    // library does not read is the widget's own NO SIGNAL, with its reason.
    for (const timeZone of ["Mars/Base", "+08:00", "America/New_York"]) {
      const result = await run("showBlDateStamp", {
        value: "2024-06-16T01:00:00Z",
        event: "shippedOnBoard",
        timeZone,
        zone2: "Fake/Zone",
      });
      expect(result, timeZone).toEqual({ ok: true, widget: "bl-date-stamp" });
    }
  });

  it("accepts the Canada checker with no zone or a listed one, and refuses any other", async () => {
    expect(await run("showCanadaClockChange", {})).toEqual({
      ok: true,
      widget: "canada-clock-change",
    });
    expect(
      await run("showCanadaClockChange", { zone: "America/Winnipeg" }),
    ).toEqual({ ok: true, widget: "canada-clock-change" });
    const refused = await run("showCanadaClockChange", {
      zone: "Europe/London",
    });
    expect(refused).toMatchObject({ ok: false, widget: "canada-clock-change" });
  });

  it("accepts the Morocco checker with no zone or a listed one, and refuses any other", async () => {
    expect(await run("showMoroccoClockChange", {})).toEqual({
      ok: true,
      widget: "morocco-clock-change",
    });
    expect(
      await run("showMoroccoClockChange", { zone: "Europe/Madrid" }),
    ).toEqual({ ok: true, widget: "morocco-clock-change" });
    const refused = await run("showMoroccoClockChange", {
      zone: "America/Toronto",
    });
    expect(refused).toMatchObject({
      ok: false,
      widget: "morocco-clock-change",
    });
    expect(refused).toHaveProperty("note");
  });

  it("rejects a whitespace-only stored-time list in the tool's own schema", () => {
    const schema = (
      tools.showStoredTimeAudit as unknown as {
        inputSchema: {
          safeParse: (v: unknown) => { success: boolean; data?: unknown };
        };
      }
    ).inputSchema;
    for (const values of [" ", "\n", " \t\n "]) {
      expect(schema.safeParse({ values }).success, values).toBe(false);
    }
    const padded = " 2026-03-29T01:30:00+02:00[Europe/London] ";
    const ok = schema.safeParse({ values: padded });
    expect(ok.success).toBe(true);
    expect(ok.data).toEqual({ values: padded });
  });

  describe("showColumnTimestampBridge refusals", () => {
    const refused = async (input: Record<string, unknown>, words: RegExp) => {
      const r = await run("showColumnTimestampBridge", input);
      expect(r.ok).toBe(false);
      expect(r.note).toMatch(words);
    };

    it("accepts an encode call and a stored-value call", async () => {
      expect(
        (
          await run("showColumnTimestampBridge", {
            value: "2024-01-01T00:00:00Z",
          })
        ).ok,
      ).toBe(true);
      expect(
        (
          await run("showColumnTimestampBridge", {
            int64: "-1",
            unit: "second",
          })
        ).ok,
      ).toBe(true);
    });

    it("refuses a zone this runtime does not know", async () => {
      await refused(
        { value: "2024-01-01T00:00:00Z", zone: "Mars/Olympus" },
        /Mars\/Olympus/,
      );
    });

    it("refuses a unit that is not one of the four", async () => {
      await refused({ value: "2024-01-01T00:00:00Z", unit: "decade" }, /unit/);
    });

    it("refuses an int96Form that is not record or bytes", async () => {
      await refused({ bytes: "00".repeat(12), int96Form: "xyz" }, /int96Form/);
    });

    it("refuses a stored value that is not the right shape", async () => {
      await refused({ int64: "1.5" }, /int64/);
    });

    it("refuses a call with neither a value nor a stored value", async () => {
      await refused({ unit: "second" }, /Send a value/);
    });

    it("refuses mode encode with a stored value", async () => {
      await refused({ mode: "encode", int64: "0" }, /mode decode/);
    });

    it("refuses mode decode with a value", async () => {
      await refused(
        { mode: "decode", value: "2024-01-01T00:00:00Z", int64: "0" },
        /encode mode/,
      );
    });

    it("refuses bytes with int96Form record", async () => {
      await refused(
        { bytes: "00".repeat(12), int96Form: "record" },
        /int96Form bytes/,
      );
    });
  });

  describe("showIdTimestampDecoder refusals", () => {
    it("accepts a real id", async () => {
      expect(
        (
          await run("showIdTimestampDecoder", {
            id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
          })
        ).ok,
      ).toBe(true);
    });

    it("refuses a blank id", async () => {
      expect((await run("showIdTimestampDecoder", { id: "" })).ok).toBe(false);
    });

    it("refuses an id over 96 characters", async () => {
      const r = await run("showIdTimestampDecoder", { id: "a".repeat(97) });
      expect(r.ok).toBe(false);
      expect(r.note).toMatch(/96/);
    });

    it("refuses a Snowflake layout that is not a whole number", async () => {
      const r = await run("showIdTimestampDecoder", { id: "1", shift: "x" });
      expect(r.ok).toBe(false);
      expect(r.note).toMatch(/shift/);
    });
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
