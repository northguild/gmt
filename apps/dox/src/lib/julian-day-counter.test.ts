import { lib } from "~/test/day-count-lib";
import {
  LAST_INSTANT,
  SCALES,
  microsText,
  numberText,
} from "./day-count-widgets";
import {
  COUNTER_PRESETS,
  CUSTOM_PRESET_ID,
  DEFAULT_PRESET,
  EDGE_NOTE,
  EMPTY_TEXT,
  MAX_VALUE_LENGTH,
  SENTENCES,
  emptyRead,
  isSeeded,
  matchPreset,
  permalinkOf,
  presetState,
  readArgs,
  readCounter,
  summaryText,
  type CounterState,
} from "./julian-day-counter";

const read = (state: CounterState) => readCounter(lib, state);
const instant = (
  value: string,
  scale: CounterState["scale"] = "UTC",
): CounterState => ({
  value,
  read: "instant",
  scale,
});

describe("every preset reads, against the real library", () => {
  it.each(COUNTER_PRESETS.map((p) => [p.id, p] as const))(
    "%s",
    (_id, preset) => {
      const r = read(preset.state);
      expect(r.status).toBe("ok");
      const utc =
        preset.state.read === "instant"
          ? preset.state.value
          : lib.fromJulianDate(Number(preset.state.value), preset.state.scale);
      expect(r.utc).toBe(utc);
      const parts = lib.toJulianDateParts(utc, preset.state.scale);
      expect(parts).not.toBeNull();
      expect(r.plates[0]!.value).toBe(
        `${numberText(parts!.jd1)} + ${numberText(parts!.jd2)}`,
      );
      const jd = lib.toJulianDate(utc, preset.state.scale);
      expect(r.plates[1]!.value).toBe(jd === null ? null : numberText(jd));
      const mjd = lib.toModifiedJulianDate(utc, preset.state.scale);
      expect(r.plates[2]!.value).toBe(mjd === null ? null : numberText(mjd));
      const sec = lib.toJ2000Seconds(utc, preset.state.scale);
      expect(r.plates[3]!.value).toBe(sec === null ? null : numberText(sec));
      expect(r.rows).toHaveLength(4);
    },
  );

  it("the J2000 preset is noon on TT and not noon on UTC", () => {
    const r = read(DEFAULT_PRESET.state);
    expect(r.utc).not.toBe("2000-01-01T12:00:00Z");
    expect(r.utc).toBe(lib.fromJ2000Seconds(0, "TT"));
  });

  it("the twenty-microsecond preset drops them in a single JD and keeps them in two parts", () => {
    const preset = COUNTER_PRESETS.find((p) => p.id === "lost")!;
    const r = read(preset.state);
    expect(r.rows[0]!.shift).toBe("0 ns");
    expect(r.rows[1]!.shift).toBe(microsText(-20_000n));
  });

  it("the midnight preset has a .5 JD and a whole MJD", () => {
    const r = read(COUNTER_PRESETS.find((p) => p.id === "midnight")!.state);
    expect(lib.toJulianDate(r.utc!, "UTC")! % 1).toBe(0.5);
    expect(lib.toModifiedJulianDate(r.utc!, "UTC")! % 1).toBe(0);
  });
});

describe("each read mode round-trips", () => {
  const utc = "2026-01-01T12:00:00Z";
  it("reads a JD, an MJD and J2000 seconds back to the instant", () => {
    for (const scale of SCALES) {
      const jd = lib.toJulianDate(utc, scale)!;
      const mjd = lib.toModifiedJulianDate(utc, scale)!;
      const sec = lib.toJ2000Seconds(utc, scale)!;
      expect(read({ value: String(jd), read: "jd", scale }).utc).toBe(
        lib.fromJulianDate(jd, scale),
      );
      expect(read({ value: String(mjd), read: "mjd", scale }).utc).toBe(
        lib.fromModifiedJulianDate(mjd, scale),
      );
      expect(read({ value: String(sec), read: "j2000", scale }).utc).toBe(
        lib.fromJ2000Seconds(sec, scale),
      );
    }
  });

  it("reads two parts through fromJulianDateParts", () => {
    const r = read({ value: "2461042 + 0.5", read: "jd", scale: "UTC" });
    expect(r.utc).toBe(
      lib.fromJulianDateParts({ jd1: 2461042, jd2: 0.5 }, "UTC"),
    );
    expect(r.calls[0]!.fn).toBe("fromJulianDateParts");
  });

  it("noon on 2026-01-01 is JD 2461042", () => {
    expect(lib.toJulianDate(utc, "UTC")).toBe(2461042);
    expect(read({ value: "2461042", read: "jd", scale: "UTC" }).utc).toBe(utc);
  });
});

describe("what a reading says in place of an answer", () => {
  it("is empty, not a sentinel, with no value", () => {
    const r = read(instant("  "));
    expect(r.status).toBe("empty");
    expect(r.emptyText).toBe(EMPTY_TEXT);
    expect(r.calls).toHaveLength(0);
    expect(emptyRead().status).toBe("empty");
    expect(summaryText(r)).toBe(EMPTY_TEXT);
  });

  it("says each sentence for its own cause", () => {
    const failure = (s: CounterState) => read(s).failure;
    expect(failure(instant("2026-01-01T12:00:00"))).toBe(
      SENTENCES.missingOffset,
    );
    expect(failure(instant("2025-06-01T23:59:60Z"))).toBe(
      SENTENCES.noInsertedSecond,
    );
    expect(failure(instant("not a time"))).toBe(SENTENCES.notAnInstant);
    expect(failure(instant("1971-12-31T23:59:59Z"))).toBe(SENTENCES.range);
    expect(failure({ value: "abc", read: "jd", scale: "UTC" })).toBe(
      SENTENCES.notANumber,
    );
    expect(failure({ value: "1", read: "mjd", scale: "UTC" })).toBe(
      SENTENCES.outside,
    );
    for (const s of ["1971-12-31T23:59:59Z", "abc"]) {
      expect(read(instant(s)).status).toBe("sentinel");
    }
  });

  it("is a correct answer, not a sentinel, when only a single double cannot hold the instant", () => {
    const r = read(COUNTER_PRESETS.find((p) => p.id === "last")!.state);
    // The preset itself reads; probe the very edge for the footnote.
    expect(r.status).toBe("ok");
    const edge = read(instant(LAST_INSTANT));
    if (edge.status === "ok") {
      expect(edge.footnote).toBe(EDGE_NOTE);
      expect(edge.plates[1]!.value).toBeNull();
      expect(edge.plates[0]!.value).not.toBeNull();
    }
  });
});

describe("the ruler", () => {
  it("holds the instant inside its window for every preset on every scale", () => {
    for (const p of COUNTER_PRESETS) {
      for (const scale of SCALES) {
        const utc =
          p.state.read === "instant"
            ? p.state.value
            : lib.fromJulianDate(Number(p.state.value), p.state.scale);
        const r = read(instant(utc, scale));
        if (r.status !== "ok") continue;
        expect(r.ruler).not.toBeNull();
        expect(r.ruler!.cursor).toBeGreaterThanOrEqual(0);
        expect(r.ruler!.cursor).toBeLessThanOrEqual(1);
        for (const l of r.ruler!.lanes) {
          for (const m of l.marks) {
            expect(m.at).toBeGreaterThanOrEqual(0);
            expect(m.at).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  it("holds the cursor for the ends of the range", () => {
    for (const scale of SCALES) {
      for (const value of ["1972-01-01T00:00:00Z", "9999-12-31T23:59:59Z"]) {
        const r = read(instant(value, scale));
        if (r.status === "ok") {
          expect(r.ruler!.cursor).toBeGreaterThanOrEqual(0);
          expect(r.ruler!.cursor).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("draws a third lane only off UTC", () => {
    expect(
      read(instant("2026-01-01T12:00:00Z", "UTC")).ruler!.lanes,
    ).toHaveLength(2);
    expect(
      read(instant("2026-01-01T12:00:00Z", "TT")).ruler!.lanes,
    ).toHaveLength(3);
  });

  it("puts a JD-day mark at noon, half way along the window, on UTC", () => {
    const r = read(instant("2026-01-01T12:00:00Z"));
    const jd = r.ruler!.lanes[0]!.marks.filter((m) => m.series === 1);
    expect(jd).toHaveLength(2);
    expect(jd[0]!.at).toBeCloseTo(0.25, 3);
    expect(jd[1]!.at).toBeCloseTo(0.75, 3);
  });

  it("notes an inserted second only where the window holds one", () => {
    const leap = read(COUNTER_PRESETS.find((p) => p.id === "leap")!.state);
    expect(leap.ruler!.leap).toBe(true);
    expect(read(instant("2026-01-01T12:00:00Z")).ruler!.leap).toBe(false);
  });
});

describe("state, seeds and the permalink", () => {
  it("writes nothing for the default and the three keys for anything else", () => {
    expect(permalinkOf(presetState(DEFAULT_PRESET))).toEqual({});
    const other = COUNTER_PRESETS[1]!;
    expect(permalinkOf(other.state)).toEqual({
      value: other.state.value,
      read: other.state.read,
      scale: other.state.scale,
    });
    expect(permalinkOf(instant(""))).toEqual({});
  });

  it("round-trips every preset through its permalink", () => {
    for (const p of COUNTER_PRESETS) {
      expect(readArgs(permalinkOf(p.state))).toEqual(p.state);
    }
  });

  it("reads a number as a JD, an instant as an instant, and never guesses a scale", () => {
    expect(readArgs({ value: "2461042" })).toEqual({
      value: "2461042",
      read: "jd",
      scale: "UTC",
    });
    expect(readArgs({ value: "2461041 + 0.5" }).read).toBe("jd");
    expect(readArgs({ value: "2026-01-01T12:00:00Z" })).toEqual(
      instant("2026-01-01T12:00:00Z"),
    );
    expect(readArgs({ value: "5", read: "mjd", scale: "TAI" })).toEqual({
      value: "5",
      read: "mjd",
      scale: "TAI",
    });
  });

  it("seeds from a preset id, with a named read or scale replacing its own", () => {
    expect(readArgs({ preset: "midnight" })).toEqual(
      COUNTER_PRESETS.find((p) => p.id === "midnight")!.state,
    );
    expect(readArgs({ preset: "midnight", scale: "TT" }).scale).toBe("TT");
    expect(readArgs({})).toEqual(presetState(DEFAULT_PRESET));
    expect(readArgs({ scale: "TDB", read: "gps" })).toEqual(
      presetState(DEFAULT_PRESET),
    );
  });

  it("caps the value", () => {
    expect(readArgs({ value: "1".repeat(100) }).value).toHaveLength(
      MAX_VALUE_LENGTH,
    );
  });

  it("matches a preset by value, read mode and scale, else custom", () => {
    for (const p of COUNTER_PRESETS) expect(matchPreset(p.state)).toBe(p.id);
    expect(matchPreset({ ...DEFAULT_PRESET.state, scale: "UTC" })).toBe(
      CUSTOM_PRESET_ID,
    );
    expect(matchPreset({ ...DEFAULT_PRESET.state, value: " 2451545 " })).toBe(
      DEFAULT_PRESET.id,
    );
  });

  it("is seeded by any of its four keys and by nothing else", () => {
    expect(isSeeded(undefined)).toBe(false);
    expect(isSeeded({})).toBe(false);
    expect(isSeeded({ value: "" })).toBe(false);
    for (const key of ["value", "preset", "read", "scale"]) {
      expect(isSeeded({ [key]: "x" })).toBe(true);
    }
  });
});
