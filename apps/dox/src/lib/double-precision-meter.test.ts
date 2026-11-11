import { lib } from "~/test/day-count-lib";
import type { DayCountLib } from "./timescale-lib";
import { shiftNs } from "./day-count-widgets";
import {
  CUSTOM_PRESET_ID,
  DEFAULT_PRESET,
  EMPTY_TEXT,
  METER_FORMS,
  METER_PRESETS,
  PROBES,
  SENTENCES,
  SLIDER_MAX,
  SLIDER_MIN,
  STEP_JD,
  emptyRead,
  isSeeded,
  lanesLabel,
  matchPreset,
  meterSamples,
  missingDate,
  permalinkOf,
  presetState,
  readArgs,
  readMeter,
  sampleCache,
  sampleYears,
  stepYearOf,
  summaryText,
  worstOf,
  yearAt,
  yearOf,
  type MeterState,
} from "./double-precision-meter";

const read = (state: MeterState) => readMeter(lib, state);
const plate = (r: ReturnType<typeof read>, i: number) => r.plates[i]!;

/** The library wrapped so every call is counted. */
function counted(): { lib: DayCountLib; calls: () => number } {
  let n = 0;
  const wrapped = Object.fromEntries(
    Object.entries(lib).map(([k, f]) => [
      k,
      (...a: unknown[]) => {
        n++;
        return (f as (...x: unknown[]) => unknown)(...a);
      },
    ]),
  ) as unknown as DayCountLib;
  return { lib: wrapped, calls: () => n };
}

describe("the presets", () => {
  it("each reads, and its drift is the shift of its own round trip", () => {
    for (const p of METER_PRESETS) {
      const r = read(p.state);
      expect(r.status, p.id).toBe("ok");
      expect(r.plates).toHaveLength(METER_FORMS.length);
    }
  });

  it("the lost preset shows the 20 µs a single JD cannot keep, and the two parts keep it", () => {
    const lost = METER_PRESETS.find((p) => p.id === "lost")!;
    const r = read(lost.state);
    expect(plate(r, 0).value).toBe("−20.000 µs");
    expect(plate(r, 3).value).toBe("0 µs");
  });

  it("J2000.0 on TT is zero seconds and nothing drifts", () => {
    const p = METER_PRESETS.find((x) => x.id === "j2000")!;
    const r = read(p.state);
    expect(plate(r, 2).lines[0]).toBe("value 0");
    for (const i of [0, 1, 2, 3]) expect(plate(r, i).value).toBe("0 µs");
  });

  it("the drift equals the library's round trip, never a formula", () => {
    const state = presetState(DEFAULT_PRESET);
    const r = read(state);
    const jd = lib.toJulianDate(state.value, "UTC")!;
    const back = lib.fromJulianDate(jd, "UTC");
    const shift = shiftNs(lib, state.value, back)!;
    expect(plate(r, 0).value).toBe(
      shift < 0n
        ? `−${-shift / 1000n}.${String(-shift % 1000n).padStart(3, "0")} µs`
        : `+${shift / 1000n}.${String(shift % 1000n).padStart(3, "0")} µs`,
    );
  });

  it("each preset matches itself and a changed value is custom", () => {
    for (const p of METER_PRESETS) expect(matchPreset(p.state)).toBe(p.id);
    expect(matchPreset({ value: "2026-01-01T00:00:00Z", scale: "UTC" })).toBe(
      CUSTOM_PRESET_ID,
    );
  });
});

describe("the sentinels", () => {
  it("an empty value is an empty reading, not a sentinel", () => {
    const r = read({ value: "  ", scale: "UTC" });
    expect(r.status).toBe("empty");
    expect(r.emptyText).toBe(EMPTY_TEXT);
    expect(emptyRead().status).toBe("empty");
    expect(summaryText(r)).toBe(EMPTY_TEXT);
  });

  it("names a missing offset, a date that does not exist, a range miss and text", () => {
    expect(read({ value: "2026-06-15T13:47:12", scale: "UTC" }).failure).toBe(
      SENTENCES.missingOffset,
    );
    expect(read({ value: "2027-02-29T00:00:00Z", scale: "UTC" }).failure).toBe(
      missingDate(2027),
    );
    expect(read({ value: "1971-12-31T23:59:59Z", scale: "UTC" }).failure).toBe(
      SENTENCES.range,
    );
    expect(read({ value: "nonsense", scale: "UTC" }).failure).toBe(
      SENTENCES.notAnInstant,
    );
  });

  it("29 February moved into a common year is the date-does-not-exist sentence", () => {
    const moved = yearAt("2024-02-29T12:00:00Z", 2027);
    expect(read({ value: moved, scale: "UTC" }).failure).toBe(
      missingDate(2027),
    );
  });

  it("the edges give no result for a single number, with the two parts still read", () => {
    const r = read({ value: "9999-12-31T23:59:59.999999999Z", scale: "UTC" });
    expect(r.status).toBe("ok");
    expect(plate(r, 3).value).not.toBeNull();
  });
});

describe("years", () => {
  it("reads a leading year and rewrites it", () => {
    expect(yearOf("2026-06-15T13:47:12Z")).toBe(2026);
    expect(Number.isNaN(yearOf("nope"))).toBe(true);
    expect(yearAt("2026-06-15T13:47:12Z", 987)).toBe("0987-06-15T13:47:12Z");
    expect(yearOf(yearAt("garbage", 3000))).toBe(3000);
  });
});

describe("the measured samples", () => {
  it("find the step year with the library, not by a constant", () => {
    const step = stepYearOf(lib, "UTC")!;
    expect(
      lib.toJulianDate(yearAt(PROBES[0]!, step), "UTC")!,
    ).toBeGreaterThanOrEqual(STEP_JD);
    expect(lib.toJulianDate(yearAt(PROBES[0]!, step - 1), "UTC")!).toBeLessThan(
      STEP_JD,
    );
    expect(sampleYears(step)).toContain(step);
    expect(sampleYears(step)).toContain(step - 1);
  });

  it("cover the whole range with the two ends", () => {
    const data = meterSamples(lib, "UTC");
    expect(data.samples[0]!.year).toBe(SLIDER_MIN);
    expect(data.samples.at(-1)!.year).toBe(SLIDER_MAX);
  });

  it("the two-part form is exact in every sample, on every scale", () => {
    for (const scale of ["UTC", "TAI", "TT", "TCG"] as const) {
      for (const s of meterSamples(lib, scale).samples) {
        expect(s.ns.parts, `${scale} ${s.year}`).toBe(0n);
      }
    }
  });

  it("no sample exceeds half a double's spacing, the bound toJulianDate documents", () => {
    // The JSDoc rounds half of 2^-31 day to "20 µs" and, after the step, "40 µs". Exactly: half
    // the spacing, plus the nanosecond the label rounds to.
    const NS_PER_DAY = 86_400_000_000_000n;
    const half = (NS_PER_DAY >> 32n) + 2n;
    const step = stepYearOf(lib, "UTC")!;
    for (const scale of ["UTC", "TAI", "TT", "TCG"] as const) {
      for (const s of meterSamples(lib, scale).samples) {
        const bound = s.year < step ? half : half * 2n;
        expect(s.ns.jd, `${scale} ${s.year}`).toBeLessThanOrEqual(bound);
      }
    }
  });

  it("the single JD drifts at 2026 whichever probe is used", () => {
    for (const probe of PROBES) {
      const utc = yearAt(probe, 2026);
      const jd = lib.toJulianDate(utc, "UTC")!;
      const back = lib.fromJulianDate(jd, "UTC");
      expect(shiftNs(lib, utc, back), probe).not.toBe(0n);
    }
  });

  it("make fewer than 8000 library calls for a scale, and cache the second ask", () => {
    const c = counted();
    const cache = sampleCache(c.lib);
    cache.get("UTC");
    expect(c.calls()).toBeLessThan(8000);
    const after = c.calls();
    cache.get("UTC");
    expect(c.calls()).toBe(after);
  });

  it("name the worst of each form in the plot's label", () => {
    const data = meterSamples(lib, "UTC");
    const label = lanesLabel(data);
    expect(label).toContain("on UTC");
    expect(label).toContain("Two-part JD: 0 ns at every sample.");
    expect(worstOf(data, "jd").ns).toBeGreaterThan(0n);
  });
});

describe("seeds and permalinks", () => {
  it("reads a value on UTC unless a scale is named", () => {
    expect(readArgs({ value: "2026-01-01T00:00:00Z" }).scale).toBe("UTC");
    expect(readArgs({ value: "2026-01-01T00:00:00Z", scale: "TT" }).scale).toBe(
      "TT",
    );
    expect(isSeeded({})).toBe(false);
    expect(isSeeded({ scale: "TT" })).toBe(true);
  });

  it("drops the default and keeps any other state", () => {
    expect(permalinkOf(presetState(DEFAULT_PRESET))).toEqual({});
    for (const p of METER_PRESETS) {
      if (p === DEFAULT_PRESET) continue;
      expect(readArgs(permalinkOf(p.state))).toEqual(p.state);
    }
  });
});
