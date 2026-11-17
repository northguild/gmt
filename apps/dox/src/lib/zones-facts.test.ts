/**
 * The facts the zone pages draw from and answer with: the converter bench, the DST inspector,
 * the interval visualizer and the planner's zone readings. Each is checked against the library
 * call it stands for, never against a value typed here.
 */
import { converterLib, dstLib, intervalLib } from "~/test/zones-lib";
import { converterFacts, getRegexList } from "./converter-bench";
import { dstFacts, dstScrubFor, getTickerWindow, isGap } from "./dst-inspector";
import { INTERVAL_OPERATIONS, intervalFacts } from "./interval-visualizer";
import { readZoneAt, readZonesAt } from "./zone-clock";

const LONDON = "2024-03-15T14:30:00.000+00:00[Europe/London]";

describe("converterFacts", () => {
  const state = {
    convertValue: LONDON,
    target: "Australia/Sydney",
    formatValue: LONDON,
    locale: "en",
    regexInput: "2024-03-15T14:30:00",
  };

  it("holds the three calls the bench makes", () => {
    const facts = converterFacts(state, converterLib);
    expect(facts.converted).toBe(
      converterLib.convertZonedToZoned(LONDON, "Australia/Sydney"),
    );
    expect(facts.parts).toEqual(converterLib.formatZonedToParts(LONDON, "en"));
    expect(facts.relative).toBe(converterLib.formatRelativeZoned(LONDON, "en"));
    expect(facts.converted).not.toBe("");
  });

  it("tests every pattern against the sample, in name order", () => {
    const { regexMatches } = converterFacts(state, converterLib);
    const names = getRegexList(converterLib.regexes).map((r) => r.name);
    expect(regexMatches.map((m) => m.name)).toEqual(names);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("returns the sentinels for a value or zone the library refuses", () => {
    const facts = converterFacts(
      {
        ...state,
        convertValue: "nope",
        formatValue: "nope",
        target: "Nope/Zone",
      },
      converterLib,
    );
    expect(facts.converted).toBe("");
    expect(facts.parts).toEqual([]);
    expect(facts.relative).toBe("");
  });
});

describe("dstFacts", () => {
  const zone = "America/New_York";
  const stateFor = (preset: string, disambiguation = "compatible") => ({
    zone,
    year: 2024,
    preset,
    disambiguation,
    scrub: dstScrubFor(zone, 2024, preset, dstLib),
  });

  it("holds the year's transitions", () => {
    const facts = dstFacts(stateFor("gap"), dstLib);
    expect(facts.transitions).toEqual(dstLib.getDstTransitions(zone, 2024));
    expect(facts.transitions).toHaveLength(2);
  });

  it("resolves the gap probe with the chosen disambiguation", () => {
    const later = dstFacts(stateFor("gap", "later"), dstLib);
    const earlier = dstFacts(stateFor("gap", "earlier"), dstLib);
    expect(later.result).toBe(
      dstLib.convertPlainDateTimeToZoned(later.plainValue, zone, {
        disambiguation: "later",
      }),
    );
    expect(later.result).not.toBe("");
    expect(later.result).not.toBe(earlier.result);
  });

  it("gives no result when reject meets a gap", () => {
    const facts = dstFacts(stateFor("gap", "reject"), dstLib);
    expect(facts.plainValue).not.toBe("");
    expect(facts.result).toBe("");
  });

  it("probes nothing in a zone with no transition", () => {
    const facts = dstFacts(
      {
        ...stateFor("gap"),
        zone: "Asia/Tokyo",
        scrub: dstScrubFor("Asia/Tokyo", 2024, "gap", dstLib),
      },
      dstLib,
    );
    expect(facts.transitions).toEqual([]);
    expect(facts.value).toBe("");
    expect(facts.result).toBe("");
  });

  it("reads a normal preset without a strip", () => {
    const state = stateFor("normal");
    expect(state.scrub).toEqual({
      activeTransition: null,
      tickerWindow: null,
      handleMinuteOfDay: null,
    });
    expect(dstFacts(state, dstLib).value).not.toBe("");
  });
});

describe("dstScrubFor", () => {
  it("scrubs the first gap for the gap preset, from its midpoint", () => {
    const scrub = dstScrubFor("America/New_York", 2024, "gap", dstLib);
    const first = dstLib
      .getDstTransitions("America/New_York", 2024)
      .find(isGap);
    expect(scrub.activeTransition).toEqual(first);
    expect(scrub.tickerWindow).toEqual(
      getTickerWindow(first!, "America/New_York"),
    );
    expect(scrub.handleMinuteOfDay).not.toBeNull();
  });

  it("scrubs nothing for an unknown preset", () => {
    expect(dstScrubFor("America/New_York", 2024, "fixed", dstLib)).toEqual({
      activeTransition: null,
      tickerWindow: null,
      handleMinuteOfDay: null,
    });
  });
});

describe("intervalFacts", () => {
  const a = {
    aStart: "2024-01-01T00:00:00+00:00[UTC]",
    aEnd: "2024-06-30T00:00:00+00:00[UTC]",
  };
  const b = {
    bStart: "2024-04-01T00:00:00+00:00[UTC]",
    bEnd: "2024-12-31T00:00:00+00:00[UTC]",
  };

  it("runs the four operations in order, unchanged", () => {
    const facts = intervalFacts({ ...a, ...b }, intervalLib);
    expect(facts).toMatchObject({ aValid: true, bValid: true, valid: true });
    for (const op of INTERVAL_OPERATIONS) {
      expect(facts.results?.[op.id]).toEqual(
        intervalLib.fns[op.id](a.aStart, a.aEnd, b.bStart, b.bEnd),
      );
    }
  });

  it("keeps an empty intersection apart from a refusal", () => {
    const apart = {
      aStart: a.aStart,
      aEnd: "2024-03-01T00:00:00+00:00[UTC]",
      bStart: "2024-06-01T00:00:00+00:00[UTC]",
      bEnd: "2024-09-01T00:00:00+00:00[UTC]",
    };
    const facts = intervalFacts(apart, intervalLib);
    expect(facts.valid).toBe(true);
    expect(facts.results?.intersection).toBeNull();
    expect(facts.results?.xor).toHaveLength(2);
  });

  it("names the interval that is not valid and runs nothing", () => {
    const facts = intervalFacts(
      { ...a, bStart: b.bEnd, bEnd: b.bStart },
      intervalLib,
    );
    expect(facts).toEqual({
      aValid: true,
      bValid: false,
      valid: false,
      results: null,
    });
  });

  it("refuses a plain date-time, which has no zone", () => {
    const facts = intervalFacts(
      { ...a, bStart: "2024-04-01T00:00:00", bEnd: "2024-05-01T00:00:00" },
      intervalLib,
    );
    expect(facts.bValid).toBe(false);
    expect(facts.results).toBeNull();
  });
});

describe("readZonesAt", () => {
  const anchor = "2024-07-01T12:00:00+00:00[UTC]";

  it("reads each zone in order, as readZoneAt does", () => {
    const ids = ["Europe/London", "Asia/Tokyo", "America/New_York"];
    expect(readZonesAt(ids, anchor)).toEqual(
      ids.map((id) => readZoneAt(id, anchor)),
    );
    expect(readZonesAt(ids, anchor).map((r) => r.id)).toEqual(ids);
  });

  it("marks a zone the library does not know as signal lost, and keeps the rest", () => {
    const [good, bad] = readZonesAt(["Europe/London", "Not/AZone"], anchor);
    expect(good?.ok).toBe(true);
    expect(good?.time).toBe("13:00:00");
    expect(bad).toMatchObject({ id: "Not/AZone", ok: false, time: "" });
  });

  it("reads nothing for no zones", () => {
    expect(readZonesAt([], anchor)).toEqual([]);
  });
});
