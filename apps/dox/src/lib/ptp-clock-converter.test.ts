import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ptpToUtc } from "@northguild/gmt/iot/convert";
import { iotLib } from "~/test/iot-lib";
import {
  BEFORE_1972_VERDICT,
  MATCH_VERDICT,
  NO_READING_VERDICT,
  READ_PRESETS,
  WRITE_PRESETS,
  callsSizer,
  checkOffset,
  differenceVerdict,
  isSeeded,
  lit,
  markStart,
  matchReadPreset,
  matchWritePreset,
  permalinkOf,
  presetState,
  readArgs,
  readDecimal,
  readPtp,
  readSeconds,
  rulerOf,
  writePtp,
  type PtpState,
} from "./ptp-clock-converter";

const state = (over: Partial<PtpState> = {}): PtpState => ({
  ...presetState(),
  ...over,
});

const readPreset = (id: string) => READ_PRESETS.find((p) => p.id === id)!;

describe("the text readers", () => {
  it("reads seconds as a bigint", () => {
    expect(readSeconds("1704067237")).toEqual({
      kind: "ok",
      value: 1704067237n,
    });
    expect(readSeconds("-5")).toEqual({ kind: "ok", value: -5n });
    expect(readSeconds("99999999999999999999")).toEqual({
      kind: "ok",
      value: 99999999999999999999n,
    });
  });

  it("tells an empty box from a text that is not a number", () => {
    expect(readSeconds("")).toEqual({ kind: "empty" });
    for (const text of [
      "x",
      " 1",
      "1e3",
      "1.",
      ".5",
      "999999999999999999999",
    ]) {
      expect(readSeconds(text)).toEqual({ kind: "notNumber" });
    }
    expect(readDecimal("")).toEqual({ kind: "empty" });
    expect(readDecimal("abc")).toEqual({ kind: "notNumber" });
  });

  // A fraction is a number, not text off the pattern: it goes to the library as a `number`, and
  // the library refuses it (PR #532 review).
  it.each`
    text      | value
    ${"1.5"}  | ${1.5}
    ${"-1.5"} | ${-1.5}
    ${"1.0"}  | ${1}
  `(
    "reads seconds $text with a fraction as the number $value",
    ({ text, value }) => {
      expect(readSeconds(text)).toEqual({ kind: "ok", value });
    },
  );

  it("reads a decimal as a number and turns negative zero into zero", () => {
    expect(readDecimal("37.5")).toEqual({ kind: "ok", value: 37.5 });
    expect(readDecimal("-0")).toEqual({ kind: "ok", value: 0 });
    expect(Object.is((readDecimal("-0") as { value: number }).value, 0)).toBe(
      true,
    );
  });
});

describe("printing", () => {
  it("prints a bigint with its n", () => {
    expect(lit({ seconds: 5n, nanoseconds: 0 })).toBe(
      "{ seconds: 5n, nanoseconds: 0 }",
    );
    expect(lit("x")).toBe('"x"');
    expect(lit(null)).toBe("null");
  });
});

describe("every read preset, against the library", () => {
  const expected: Record<
    string,
    { utc: string; ignored: string; valid: boolean }
  > = {
    "announced-37": {
      utc: "2024-01-01T00:00:00Z",
      ignored: "2024-01-01T00:00:37Z",
      valid: true,
    },
    "stale-36": {
      utc: "2024-01-01T00:00:01Z",
      ignored: "2024-01-01T00:00:37Z",
      valid: true,
    },
    "announced-0": {
      utc: "2024-01-01T00:00:37Z",
      ignored: "2024-01-01T00:00:37Z",
      valid: true,
    },
    "half-second": {
      utc: "2024-01-01T00:00:00.5Z",
      ignored: "2024-01-01T00:00:37.5Z",
      valid: true,
    },
    "unset-clock": { utc: "", ignored: "1970-01-01T00:00:00Z", valid: true },
    "out-of-range": { utc: "", ignored: "", valid: false },
    "before-1972": {
      utc: "1971-01-01T00:00:00Z",
      ignored: "1971-01-01T00:00:10Z",
      valid: true,
    },
  };

  it.each(READ_PRESETS.map((p) => p.id))(
    "%s reads as the library says",
    (id) => {
      const p = readPreset(id);
      const r = readPtp(iotLib, state({ ...p }));
      expect(r.utc).toBe(expected[id]!.utc);
      expect(r.valid).toBe(expected[id]!.valid);
      if (id !== "out-of-range") expect(r.ignored).toBe(expected[id]!.ignored);
    },
  );

  it("names each refusal by asking the library again", () => {
    const reason = (id: string) =>
      readPtp(iotLib, state({ ...readPreset(id) })).reason;
    expect(reason("announced-37")).toBe("read");
    expect(reason("out-of-range")).toBe("recordOut");
    expect(reason("unset-clock")).toBe("before1970");
    expect(
      readPtp(iotLib, state({ ...readPreset("announced-37"), offset: "37.5" }))
        .reason,
    ).toBe("offsetRefused");
  });

  it("sends fractional seconds to the library, which refuses the record", () => {
    const r = readPtp(
      iotLib,
      state({ ...readPreset("announced-37"), seconds: "1.5" }),
    );
    expect(r).toMatchObject({
      kind: "refused",
      reason: "recordOut",
      valid: false,
      utc: "",
    });
    expect(r.calls[0]).toBe(
      "isValidPtpTimestamp({ seconds: 1.5, nanoseconds: 0 }); // false",
    );
  });

  it("names a record past the last writable instant", () => {
    // The largest valid count: read at offset 0 it is past the last instant, and any offset
    // the library takes does not rescue it. Find a refused-at-zero record from the library.
    const big = { ...readPreset("announced-37"), seconds: "281474976710655" };
    const r = readPtp(iotLib, state(big));
    expect(r.utc).toBe(
      ptpToUtc({ seconds: 281474976710655n, nanoseconds: 0 }, 37),
    );
    if (r.utc === "") expect(r.reason).toBe("pastEnd");
  });

  it("makes no call for an empty or non-numeric box", () => {
    const r = readPtp(iotLib, state({ seconds: "" }));
    expect(r).toMatchObject({ kind: "empty", utc: null, calls: [] });
    const n = readPtp(iotLib, state({ offset: "abc" }));
    expect(n).toMatchObject({ kind: "notNumber", utc: null, calls: [] });
  });

  it("prints each call as it was made", () => {
    const r = readPtp(iotLib, state());
    expect(r.calls[1]).toBe(
      'ptpToUtc({ seconds: 1704067237n, nanoseconds: 0 }, 37); // "2024-01-01T00:00:00Z"',
    );
  });
});

describe("the check", () => {
  const check = (id: string) =>
    checkOffset(iotLib, readPtp(iotLib, state({ ...readPreset(id) })));

  it("matches the table at 37", () => {
    const c = check("announced-37");
    expect(c.table).toBe(37);
    expect(c.tableUtc).toBe("2024-01-01T00:00:00Z");
    expect(c.verdict).toEqual(MATCH_VERDICT);
  });

  it("says a stale offset is 1 s out, and later", () => {
    expect(check("stale-36").verdict).toEqual({
      tone: "bad",
      title: "Offset differs from the table by 1 s",
      detail: "Every reading is 1 s later than UTC",
    });
  });

  it("says offset 0 is 37 s out", () => {
    expect(check("announced-0").verdict.title).toBe(
      "Offset differs from the table by 37 s",
    );
  });

  it("says earlier when the table is smaller", () => {
    expect(differenceVerdict(40, 37).detail).toBe(
      "Every reading is 3 s earlier than UTC",
    );
  });

  it("has no table value before 1972", () => {
    const c = check("before-1972");
    expect(c.table).toBeNull();
    expect(c.verdict).toEqual(BEFORE_1972_VERDICT);
  });

  it("has nothing to check without a reading", () => {
    expect(check("unset-clock").verdict).toEqual(NO_READING_VERDICT);
    expect(check("out-of-range").kind).toBe("noReading");
    expect(
      checkOffset(iotLib, readPtp(iotLib, state({ seconds: "" }))).kind,
    ).toBe("empty");
  });
});

describe("the ruler", () => {
  const ruler = (id: string) =>
    rulerOf(checkOffset(iotLib, readPtp(iotLib, state({ ...readPreset(id) }))));

  it("draws one mark when they match", () => {
    const r = ruler("announced-37");
    expect(r.marks).toHaveLength(1);
    expect(r.marks[0]!.label).toBe("Announced = table, 37 s");
    expect(r.gap).toBeNull();
  });

  it("draws two marks and the gap between", () => {
    const r = ruler("stale-36");
    expect(r.marks.map((m) => m.kind)).toEqual(["announced", "table"]);
    expect(r.gap?.label).toBe("1 s apart");
  });

  it("clamps an offset off the ruler and says so", () => {
    expect(
      rulerOf({
        kind: "checked",
        announced: 90,
        table: 37,
        tableUtc: "",
        verdict: MATCH_VERDICT,
        calls: [],
      }).marks[0]!.label,
    ).toBe("Announced offset, off the ruler: 90 s");
    expect(markStart(1)).toBeLessThan(1);
    expect(markStart(0)).toBe(0);
  });
});

describe("the write", () => {
  it("writes the default instant", () => {
    const w = writePtp(iotLib, state());
    expect(w.seconds).toBe(1704067237n);
    expect(w.nanoseconds).toBe(0);
    expect(w.back).toBe("2024-01-01T00:00:00Z");
    expect(w.calls[0]).toBe(
      'utcToPtp("2024-01-01T02:00:00+02:00", 37); // { seconds: 1704067237n, nanoseconds: 0 }',
    );
  });

  it("names a leap second and a time before 1970 only for their own text", () => {
    const reason = (instant: string) =>
      writePtp(iotLib, state({ instant })).reason;
    expect(reason("2016-12-31T23:59:60Z")).toBe("leapSecond");
    expect(reason("1969-12-31T23:59:59Z")).toBe("before1970");
    expect(reason("1969-12-31T23:59:58Z")).toBe("noInstant");
    expect(reason("2016-12-31T23:59:60Z ")).toBe("noInstant");
  });

  it("names a refused offset", () => {
    expect(writePtp(iotLib, state({ offset: "37.5" })).reason).toBe(
      "offsetRefused",
    );
  });

  it("makes no call for an empty box or a missing offset", () => {
    expect(writePtp(iotLib, state({ instant: "" }))).toMatchObject({
      kind: "empty",
      calls: [],
    });
    expect(writePtp(iotLib, state({ offset: "" }))).toMatchObject({
      kind: "empty",
      reason: "needOffset",
    });
    expect(writePtp(iotLib, state({ offset: "x" })).kind).toBe("notNumber");
  });

  it("writes every write preset as the library says", () => {
    expect(
      WRITE_PRESETS.map(
        (p) => writePtp(iotLib, state({ instant: p.instant })).kind,
      ),
    ).toEqual(["written", "refused", "refused"]);
  });
});

describe("seeds and permalinks", () => {
  it("opens on the default presets", () => {
    expect(matchReadPreset(state())).toBe("announced-37");
    expect(matchWritePreset(state().instant)).toBe("utc-offset-instant");
    expect(permalinkOf(state())).toEqual({
      preset: "announced-37",
      writePreset: "utc-offset-instant",
    });
  });

  it("keeps typed text, even blank", () => {
    const s = state({ seconds: "5", instant: "" });
    expect(permalinkOf(s)).toEqual({
      seconds: "5",
      nanoseconds: "0",
      offset: "37",
      instant: "",
    });
    expect(readArgs({ seconds: "5", instant: "" }).instant).toBe("");
    expect(isSeeded({ instant: "" })).toBe(true);
    expect(isSeeded({})).toBe(false);
  });

  it("reads a preset id and lets text override it", () => {
    expect(readArgs({ preset: "stale-36", offset: "35" })).toMatchObject({
      seconds: "1704067237",
      offset: "35",
    });
  });
});

describe("the call frames", () => {
  it("size every frame for the lines the widest reading prints", () => {
    expect(callsSizer("read").lines).toBeGreaterThanOrEqual(4);
    expect(callsSizer("check").lines).toBeGreaterThanOrEqual(1);
    expect(callsSizer("write").lines).toBeGreaterThanOrEqual(2);
  });
});

describe("no range lives in the site", () => {
  const forbidden = [
    "2n ** 48n",
    "2 ** 48",
    "281474976710",
    "999999999",
    "32767",
    "32768",
  ];
  for (const file of [
    "ptp-clock-converter.ts",
    "ptp-clock-converter-mount.ts",
  ]) {
    it(`${file} holds none of them`, () => {
      const text = readFileSync(join(__dirname, file), "utf8");
      for (const needle of forbidden) expect(text).not.toContain(needle);
    });
  }
});
