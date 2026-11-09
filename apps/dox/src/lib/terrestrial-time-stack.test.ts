import { lib } from "~/test/timescale-lib";
import {
  CUSTOM_PRESET_ID,
  DEFAULT_PRESET,
  INSIDE_FOOTNOTE,
  INSIDE_SECOND_TEXT,
  MAX_VALUE_LENGTH,
  NO_RESULT_TEXT,
  PAST_9999_FOOTNOTE,
  SENTENCES,
  SLIDER_MAX,
  SLIDER_MIN,
  STACK_PRESETS,
  driftSeries,
  driftYears,
  emptyRead,
  isSeeded,
  laneAria,
  matchPreset,
  permalinkOf,
  platesOf,
  readArgs,
  readStack,
  secondsText,
  stackAria,
  stackReach,
  summaryText,
  yearInstant,
  yearOf,
} from "./terrestrial-time-stack";
import { durationSecondsText } from "./gnss-widgets";
import { INTEGER_UTC_FROM } from "./timescale-widgets";

const preset = (id: string) => STACK_PRESETS.find((p) => p.id === id)!;
const readPreset = (id: string) => readStack(lib, preset(id).state);
const read = (value: string) => readStack(lib, { value });
const dt = (label: string) => label.split(" ")[0]!;

describe("routing the typed value", () => {
  it("takes a value with no space as UTC and makes no recorded call to read it", () => {
    const r = read("2026-01-01T00:00:00Z");
    expect(r.status).toBe("ok");
    expect(r.scale).toBe("UTC");
    expect(r.utc).toBe("2026-01-01T00:00:00Z");
    expect(r.calls[0]!.fn).toBe("toTAI");
  });

  it("spells an offset value in the library's own Z form", () => {
    expect(read("2026-01-01T01:00:00+01:00").utc).toBe("2026-01-01T00:00:00Z");
  });

  it.each`
    token    | fn
    ${"TAI"} | ${"fromTAI"}
    ${"TT"}  | ${"fromTT"}
    ${"TCG"} | ${"fromTCG"}
  `(
    "sends a $token label to $fn and records that call first",
    ({ token, fn }: { token: string; fn: string }) => {
      const base = read("2026-01-01T00:00:00Z");
      const label = base.rows.find((r) => r.scale === token)!.label;
      const r = read(label);
      expect(r.scale).toBe(token);
      expect(r.calls[0]!.fn).toBe(fn);
      expect(r.calls[0]!.args).toEqual([label]);
      expect(r.utc).toBe("2026-01-01T00:00:00Z");
      expect(r.rows.find((x) => x.yours)!.scale).toBe(token);
    },
  );

  it("makes the calls once each, in order", () => {
    const r = read("2026-01-01T00:00:00Z");
    expect(r.calls.map((c) => c.fn)).toEqual([
      "toTAI",
      "toTT",
      "toTCG",
      "fromTAI",
      "fromTT",
      "fromTCG",
      "taiMinusUtc",
      "diffUtcAsDuration",
      "tcgMinusTt",
      "diffUtcAsDuration",
    ]);
  });

  it("empty value makes no call and is not a sentinel", () => {
    const r = read("   ");
    expect(r.status).toBe("empty");
    expect(r.calls).toEqual([]);
    expect(r.emptyText).toBe(emptyRead().emptyText);
  });
});

describe("the sentences", () => {
  it.each`
    value                                  | sentence
    ${"2026-01-01T00:00:00 UTC"}           | ${SENTENCES.unknownToken}
    ${"2026-01-01T00:00:00 GPS"}           | ${SENTENCES.unknownToken}
    ${"2026-01-01T00:00:00Z extra words"}  | ${SENTENCES.notAnInstant}
    ${"2026-01-01T00:00:00"}               | ${SENTENCES.notAnInstant}
    ${"not a time"}                        | ${SENTENCES.notAnInstant}
    ${"2017-12-31T23:59:60Z"}              | ${SENTENCES.noLeapSecond}
    ${"1971-12-31T23:59:59Z"}              | ${SENTENCES.before1972}
    ${"9999-12-31T23:59:59Z"}              | ${SENTENCES.past9999}
    ${"9999-12-31T23:00:00-05:00"}         | ${SENTENCES.past9999}
    ${"1972-01-01T00:00:00 TT"}            | ${SENTENCES.before1972}
    ${"1972-01-01T00:00:09.999999999 TAI"} | ${SENTENCES.before1972}
    ${"1972-01-01T00:00:42 TCG"}           | ${SENTENCES.before1972}
    ${"0001-01-01T00:00:00 TT"}            | ${SENTENCES.before1972}
    ${"2026-13-01T00:00:00 TT"}            | ${SENTENCES.notOnScale}
    ${"1960-13-01T00:00:00 TT"}            | ${SENTENCES.notOnScale}
    ${"1971-06-30T23:59:60 TAI"}           | ${SENTENCES.notOnScale}
    ${"garbage TT"}                        | ${SENTENCES.notOnScale}
  `(
    "$value says its sentence",
    ({ value, sentence }: { value: string; sentence: string }) => {
      const r = read(value);
      expect(r.status).toBe("sentinel");
      expect(r.failure).toBe(sentence);
      expect(r.rows.every((row) => row.label === "")).toBe(true);
      expect(r.plates.every((p) => p.value === null)).toBe(true);
    },
  );

  it("the last instant of 9999 is a valid UTC instant with no TT label", () => {
    const value = "9999-12-31T23:59:59Z";
    expect(lib.isValidInstant(value)).toBe(true);
    expect(lib.taiMinusUtc(value)).not.toBeNull();
    expect(lib.toTT(value)).toBe("");
  });

  it("reads each scale's label for the first instant of integer UTC", () => {
    for (const label of [
      lib.toTAI(INTEGER_UTC_FROM),
      lib.toTT(INTEGER_UTC_FROM),
      lib.toTCG(INTEGER_UTC_FROM),
    ]) {
      const r = read(label);
      expect(r.status, label).toBe("ok");
      expect(r.utc, label).toBe(INTEGER_UTC_FROM);
    }
  });

  it("a label before 1972 keeps only the call it made", () => {
    expect(read("1972-01-01T00:00:00 TT").calls.map((c) => c.fn)).toEqual([
      "fromTT",
    ]);
  });

  it("a missing offset is named before a leap second", () => {
    expect(read("2017-12-31T23:59:60").failure).toBe(SENTENCES.notAnInstant);
  });

  it("a token that did not read keeps the call it made", () => {
    const r = read("garbage TT");
    expect(r.calls.map((c) => c.fn)).toEqual(["fromTT"]);
  });
});

describe("each preset", () => {
  it("has a unique id and fits the permalink", () => {
    expect(new Set(STACK_PRESETS.map((p) => p.id)).size).toBe(8);
    for (const p of STACK_PRESETS) {
      expect(p.state.value.length).toBeLessThanOrEqual(MAX_VALUE_LENGTH);
      expect(matchPreset(p.state)).toBe(p.id);
    }
  });

  it("utc-2026: TT is ahead of UTC by the TAI step plus the constant", () => {
    const r = readPreset("utc-2026");
    expect(r.status).toBe("ok");
    expect(r.gap.text).toBe("69.184 s");
    expect(r.segments.steps.text).toBe("37 s");
    expect(r.segments.constant.text).toBe("32.184 s");
    expect(r.segments.drift.text).toBe("1.077661917 s");
    expect(preset("utc-2026").description).toContain("69.184");
    expect(preset("utc-2026").description).toContain("1.08");
  });

  it("tt-label and tcg-label read back to the same UTC as the default", () => {
    for (const id of ["tt-label", "tcg-label"]) {
      const r = readPreset(id);
      expect(r.utc).toBe("2026-01-01T00:00:00Z");
      expect(r.rows.find((x) => x.yours)!.label).toBe(preset(id).state.value);
    }
    expect(preset("tcg-label").state.value).toBe(
      `${dt(readPreset("utc-2026").rows[3]!.label)} TCG`,
    );
  });

  it("epoch: TCG - TT is 0 and UTC is 1976-12-31T23:59:45Z", () => {
    const r = readPreset("epoch");
    expect(r.utc).toBe("1976-12-31T23:59:45Z");
    expect(r.segments.drift.seconds).toBe(0);
    expect(preset("epoch").description).toContain(r.utc!);
  });

  it("first-integer-utc: the drift is negative", () => {
    const r = readPreset("first-integer-utc");
    expect(r.segments.drift.seconds).toBeLessThan(0);
    expect(r.segments.drift.text.startsWith("−")).toBe(true);
    expect(preset("first-integer-utc").description).toContain(
      r.segments.drift.text.replace(" s", ""),
    );
  });

  it("inside-leap-second: labels exist, the UTC gap is inside", () => {
    const r = readPreset("inside-leap-second");
    expect(r.rows.every((row) => row.label !== "")).toBe(true);
    expect(r.gap.kind).toBe("inside");
    expect(r.gap.text).toBe(INSIDE_SECOND_TEXT);
    expect(r.segments.steps.seconds).toBe(36);
    expect(r.rows.map((row) => row.back)).toEqual(
      r.rows.map(() => "2016-12-31T23:59:60Z"),
    );
  });

  it("far-future: the drift outgrows both other segments", () => {
    const r = readPreset("far-future");
    expect(r.segments.drift.seconds!).toBeGreaterThan(
      r.segments.steps.seconds! + r.segments.constant.seconds!,
    );
    expect(preset("far-future").description).toContain(
      r.segments.drift.text.replace(" s", ""),
    );
  });

  it("before-1972: no signal", () => {
    const r = readPreset("before-1972");
    expect(r.status).toBe("sentinel");
    expect(r.failure).toBe(SENTENCES.before1972);
  });

  it.each`
    id
    ${"utc-2026"}
    ${"epoch"}
    ${"far-future"}
  `(
    "$id: steps + constant + drift is TT-label-in-TCG minus UTC",
    ({ id }: { id: string }) => {
      const r = readPreset(id);
      const tcg = dt(r.rows[3]!.label);
      const whole = durationSecondsText(
        lib.diffUtcAsDuration(r.utc!, `${tcg}Z`, "seconds"),
      );
      const sum =
        r.segments.steps.seconds! +
        r.segments.constant.seconds! +
        r.segments.drift.seconds!;
      expect(Math.abs(sum - Number(whole))).toBeLessThan(1e-9);
    },
  );
});

describe("the end of 9999", () => {
  it("an ok reading near the end has no TCG label, and the footnote says why", () => {
    const value = "9999-12-31T23:57:00Z";
    expect(lib.toTT(value)).not.toBe("");
    expect(lib.toTCG(value)).toBe("");
    const r = read(value);
    expect(r.status).toBe("ok");
    expect(r.rows.map((row) => row.label === "")).toEqual([
      false,
      false,
      false,
      true,
    ]);
    expect(r.rows[3]!.back).toBe("");
    expect(r.segments.drift.kind).toBe("seconds");
    expect(r.footnote).toBe(PAST_9999_FOOTNOTE);
  });

  it("a TAI label in the last seconds of 9999 has neither a TT nor a TCG label", () => {
    const r = read("9999-12-31T23:59:59 TAI");
    expect(r.status).toBe("ok");
    expect(r.rows.map((row) => row.label === "")).toEqual([
      false,
      false,
      true,
      true,
    ]);
    expect(r.gap.kind).toBe("none");
    expect(r.footnote).toBe(PAST_9999_FOOTNOTE);
  });

  it("no footnote while every label is written, and the inside one in a leap second", () => {
    expect(readPreset("far-future").footnote).toBe("");
    expect(readPreset("utc-2026").footnote).toBe("");
    expect(readPreset("inside-leap-second").footnote).toBe(INSIDE_FOOTNOTE);
  });
});

describe("the drift lane", () => {
  it("lists every 25th year and both slider ends, once, in order", () => {
    const years = driftYears();
    expect(years[0]).toBe(SLIDER_MIN);
    expect(years.at(-1)).toBe(SLIDER_MAX);
    expect(new Set(years).size).toBe(years.length);
    expect([...years].sort((a, b) => a - b)).toEqual(years);
    expect(years).toContain(2025);
  });

  it("is monotonic and crosses 0 at the epoch", () => {
    const series = driftSeries(lib, driftYears());
    const values = series.map((p) => p.value!);
    expect(values.every((v) => typeof v === "number")).toBe(true);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]!).toBeGreaterThan(values[i - 1]!);
    }
    const epochUtc = readPreset("epoch").utc!;
    expect(Math.abs(lib.tcgMinusTt(epochUtc)!)).toBeLessThan(1e-9);
    const before = series.filter((p) => p.year <= 1975).at(-1)!.value!;
    const after = series.find((p) => p.year >= 1977)!.value!;
    expect(before).toBeLessThan(0);
    expect(after).toBeGreaterThanOrEqual(0);
  });

  it("leaves a gap, not a zero, where the library gives null", () => {
    const stub = { tcgMinusTt: () => null };
    expect(driftSeries(stub, [2000]).map((p) => p.value)).toEqual([null]);
  });
});

describe("the reach", () => {
  it("is the larger of the two end-year reads", () => {
    const end = (year: number) => {
      const utc = yearInstant(year);
      const gap = Number(
        durationSecondsText(
          lib.diffUtcAsDuration(utc, `${dt(lib.toTT(utc))}Z`, "seconds"),
        ),
      );
      return gap + lib.tcgMinusTt(utc)!;
    };
    expect(stackReach(lib)).toBe(Math.max(end(SLIDER_MIN), end(SLIDER_MAX)));
    expect(stackReach(lib)).toBeGreaterThan(
      readPreset("utc-2026").gap.seconds!,
    );
  });
});

describe("the slider's years", () => {
  it("round-trips a year", () => {
    expect(yearInstant(2026)).toBe("2026-01-01T00:00:00Z");
    expect(yearOf("2026-06-01T12:00:00Z")).toBe(2026);
    expect(SLIDER_MIN).toBe(1972);
  });
});

describe("text", () => {
  it("writes seconds with a true minus and no exponent", () => {
    expect(secondsText(-0.11001219)).toBe("−0.11001219");
    expect(secondsText(1.1e-8)).toBe("0.000000011");
    expect(secondsText(37)).toBe("37");
  });

  it("states the pieces in the aria-label and the summary", () => {
    const r = readPreset("utc-2026");
    expect(stackAria(r)).toBe(
      "TAI − UTC 37 s, TT − TAI 32.184 s, TCG − TT 1.077661917 s",
    );
    expect(summaryText(r)).toContain("TT − UTC 69.184 s");
    expect(stackAria(read("1971-12-31T23:59:59Z"))).toBe(SENTENCES.before1972);
  });

  it("shows no result on every plate when there is no reading", () => {
    expect(platesOf(null)).toHaveLength(4);
    expect(platesOf(null).every((p) => p.value === null)).toBe(true);
    expect(NO_RESULT_TEXT).toBe("no result");
  });
});

describe("seed and permalink", () => {
  it("seeds from a value, a preset id or nothing", () => {
    expect(isSeeded({ value: "2026-01-01T00:00:00Z" })).toBe(true);
    expect(isSeeded({ value: "" })).toBe(false);
    expect(isSeeded({ value: 3 })).toBe(false);
    expect(isSeeded(undefined)).toBe(false);
    expect(isSeeded({ preset: "epoch" })).toBe(true);
    expect(isSeeded({ value: "", preset: "epoch" })).toBe(true);
    expect(isSeeded({ value: "", preset: "" })).toBe(false);
    expect(readArgs({ value: "", preset: "epoch" })).toEqual(
      preset("epoch").state,
    );
    expect(readArgs({ value: 3 })).toEqual(DEFAULT_PRESET.state);
    expect(readArgs({ preset: "epoch" })).toEqual(preset("epoch").state);
    expect(readArgs({ value: "x".repeat(100) }).value).toHaveLength(
      MAX_VALUE_LENGTH,
    );
  });

  it("writes nothing for the default and the trimmed value otherwise", () => {
    expect(permalinkOf(DEFAULT_PRESET.state)).toEqual({});
    expect(permalinkOf({ value: "" })).toEqual({});
    for (const p of STACK_PRESETS.slice(1)) {
      expect(permalinkOf(p.state)).toEqual({ value: p.state.value });
      expect(readArgs(permalinkOf(p.state))).toEqual(p.state);
    }
    expect(permalinkOf({ value: " 1999-01-01T00:00:00Z " })).toEqual({
      value: "1999-01-01T00:00:00Z",
    });
    expect(matchPreset({ value: "nope" })).toBe(CUSTOM_PRESET_ID);
  });
});

describe("laneAria", () => {
  it("names both ends of the series and the reader's year", () => {
    const series = driftSeries(lib, driftYears());
    const text = laneAria(series, readPreset("utc-2026"));
    expect(text).toContain("TCG − TT against the year");
    expect(text).toContain("−0.11001219 s in 1972");
    expect(text).toContain("176.427468382 s in 9999");
    expect(text).toContain("at 2026 it is 1.077661917 s");
    expect(laneAria(series, read("1971-12-31T23:59:59Z"))).not.toContain(
      " at ",
    );
  });
});
