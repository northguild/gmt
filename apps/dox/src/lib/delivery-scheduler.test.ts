import { Temporal } from "@js-temporal/polyfill";
import {
  crossingTime,
  scheduleDelivery,
  transitTime,
} from "@northguild/gmt/transport/calculate";
import { etaAtZone } from "@northguild/gmt/transport/convert";
import { isValidTimeZone } from "@northguild/gmt/zoned/validate";
import { isValidDateTime } from "@northguild/gmt/plain/validate";
import { resolveLocal } from "@northguild/gmt/instant/convert";
import {
  collectJourneyFacts,
  legObject,
  type TransportLib,
} from "./transport-widgets";
import {
  CUSTOM_PRESET_ID,
  DELIVERY_PRESETS,
  legCalls,
  legsOf,
  matchPreset,
  optionsOf,
  originZoneOf,
  permalinkOf,
  readArgs,
  buildChartData,
  buildEtaSummary,
  buildItinerary,
  shortZoneLabel,
  type DeliveryState,
} from "./delivery-scheduler";

const lib: TransportLib = {
  scheduleDelivery,
  transitTime,
  etaAtZone,
  crossingTime,
  isValidTimeZone,
  isValidDateTime,
  resolveLocal,
};

describe("readArgs", () => {
  it("reads the chat legs array, inferring legCount from its length", () => {
    const state = readArgs({
      legs: [
        {
          departure: "2024-06-15T00:00:00Z",
          duration: "PT1H",
          timeZone: "UTC",
        },
        { duration: "PT1H", timeZone: "UTC" },
      ],
    });
    expect(state.legCount).toBe("2");
    expect(state.legs[0].departure).toBe("2024-06-15T00:00:00Z");
    expect(state.legs[1].departure).toBe("");
  });

  it("reads the flat permalink keys", () => {
    const state = readArgs({
      legCount: "2",
      departure1: "2024-06-15T00:00:00Z",
      duration1: "PT1H",
      timeZone1: "UTC",
      duration2: "PT1H",
      timeZone2: "UTC",
    });
    expect(state.legCount).toBe("2");
    expect(state.legs[0].timeZone).toBe("UTC");
  });

  it("infers legCount from the highest non-blank leg when legCount is absent", () => {
    const state = readArgs({
      departure1: "2024-06-15T00:00:00Z",
      duration1: "PT1H",
      timeZone1: "UTC",
      duration3: "PT1H",
      timeZone3: "UTC",
    });
    expect(state.legCount).toBe("3");
  });

  it("defaults to legCount 1 with nothing set", () => {
    expect(readArgs({}).legCount).toBe("1");
  });

  it("turns junk into blank strings", () => {
    const state = readArgs({
      legs: [
        {
          departure: 42 as unknown as string,
          duration: "PT1H",
          timeZone: "UTC",
        },
      ],
    });
    expect(state.legs[0].departure).toBe("");
  });
});

describe("matchPreset", () => {
  it("matches every preset", () => {
    for (const preset of DELIVERY_PRESETS) {
      const state: DeliveryState = {
        legCount: String(preset.legs.length),
        startTimeZone: preset.startTimeZone,
        legs: [
          preset.legs[0] ?? {
            departure: "",
            duration: "",
            timeZone: "",
            dwellAfter: "",
            mode: "",
          },
          preset.legs[1] ?? {
            departure: "",
            duration: "",
            timeZone: "",
            dwellAfter: "",
            mode: "",
          },
          preset.legs[2] ?? {
            departure: "",
            duration: "",
            timeZone: "",
            dwellAfter: "",
            mode: "",
          },
          preset.legs[3] ?? {
            departure: "",
            duration: "",
            timeZone: "",
            dwellAfter: "",
            mode: "",
          },
        ],
      };
      expect(matchPreset(state)).toBe(preset.id);
    }
  });

  it("falls back to custom", () => {
    const state: DeliveryState = {
      legCount: "1",
      startTimeZone: "",
      legs: [
        {
          departure: "2024-01-01T00:00:00Z",
          duration: "PT1H",
          timeZone: "UTC",
          dwellAfter: "",
          mode: "",
        },
        { departure: "", duration: "", timeZone: "", dwellAfter: "", mode: "" },
        { departure: "", duration: "", timeZone: "", dwellAfter: "", mode: "" },
        { departure: "", duration: "", timeZone: "", dwellAfter: "", mode: "" },
      ],
    };
    expect(matchPreset(state)).toBe(CUSTOM_PRESET_ID);
  });
});

describe("legCalls", () => {
  const journey = (preset: (typeof DELIVERY_PRESETS)[number]) => {
    const legs = preset.legs.map(legObject);
    const options =
      preset.startTimeZone === ""
        ? undefined
        : { startTimeZone: preset.startTimeZone };
    return { legs, facts: collectJourneyFacts(legs, options, lib) };
  };

  it("gives, for every leg of every made journey, the arrival and local arrival scheduleDelivery reports", () => {
    let checked = 0;
    for (const preset of DELIVERY_PRESETS) {
      const { legs, facts } = journey(preset);
      if (facts.result === null) continue;
      facts.result.legTimes.forEach((legTime, k) => {
        const calls = legCalls(facts, legs, k, lib)!;
        expect({ preset: preset.id, k, arrival: calls.arrival }).toEqual({
          preset: preset.id,
          k,
          arrival: legTime.arrival,
        });
        expect({ preset: preset.id, k, local: calls.local }).toEqual({
          preset: preset.id,
          k,
          local: legTime.localArrival,
        });
        checked += 1;
      });
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("passes on exactly what each call was given", () => {
    const preset = DELIVERY_PRESETS.find((p) => p.id === "truck-ship-rail")!;
    const { legs, facts } = journey(preset);
    const calls = legCalls(facts, legs, 0, lib)!;
    expect(calls.departure).toBe(facts.departures[0]);
    expect(calls.duration).toBe("PT45H");
    expect(calls.zone).toBe("Europe/London");
    expect(calls.arrival).toBe(transitTime(calls.departure, "PT45H"));
    expect(calls.local).toBe(etaAtZone(calls.arrival, "Europe/London"));
  });

  it("returns a sentinel, not a guess, for a duration that is not one", () => {
    const preset = DELIVERY_PRESETS.find((p) => p.id === "truck-ship-rail")!;
    const legs = preset.legs.map(legObject);
    legs[0] = { ...legs[0]!, duration: "soon" };
    const facts = collectJourneyFacts(legs, undefined, lib);
    const calls = legCalls(facts, legs, 0, lib)!;
    expect(calls.arrival).toBe("");
    expect(calls.local).toBe("");
  });

  it("is null for a leg the journey does not have", () => {
    const preset = DELIVERY_PRESETS.find((p) => p.id === "truck-ship-rail")!;
    const { legs, facts } = journey(preset);
    expect(legCalls(facts, legs, 9, lib)).toBeNull();
  });
});

describe("legsOf / optionsOf / permalinkOf", () => {
  const preset = DELIVERY_PRESETS.find((p) => p.id === "truck-ship-rail")!;
  const state: DeliveryState = {
    legCount: "3",
    startTimeZone: "",
    legs: [
      preset.legs[0]!,
      preset.legs[1]!,
      preset.legs[2]!,
      { departure: "", duration: "", timeZone: "", dwellAfter: "", mode: "" },
    ],
  };

  it("legsOf produces V30's exact result", () => {
    expect(scheduleDelivery(legsOf(state))).toEqual({
      eta: "2024-04-12T17:30:00+09:00[Asia/Tokyo]",
      legTimes: [
        {
          arrival: "2024-03-31T04:00:00Z",
          localArrival: "2024-03-31T05:00:00+01:00[Europe/London]",
          dwellAfter: "PT2H",
          mode: "truck",
        },
        {
          arrival: "2024-04-11T06:00:00Z",
          localArrival: "2024-04-11T15:00:00+09:00[Asia/Tokyo]",
          dwellAfter: "PT24H",
          mode: "ship",
        },
        {
          arrival: "2024-04-12T08:30:00Z",
          localArrival: "2024-04-12T17:30:00+09:00[Asia/Tokyo]",
          dwellAfter: "PT0S",
          mode: "rail",
        },
      ],
    });
  });

  it("optionsOf is undefined when startTimeZone is blank", () => {
    expect(optionsOf(state)).toBeUndefined();
    expect(optionsOf({ ...state, startTimeZone: "America/New_York" })).toEqual({
      startTimeZone: "America/New_York",
    });
  });

  it("permalinkOf carries only strings, with blanks omitted", () => {
    const link = permalinkOf(state);
    for (const v of Object.values(link)) expect(typeof v).toBe("string");
    expect(link.legCount).toBe("3");
    expect(link.startTimeZone).toBeUndefined();
    expect(link.mode1).toBe("truck");
    expect(link.departure2).toBeUndefined();
  });

  it("originZoneOf reads leg 1's bracketed zone", () => {
    expect(originZoneOf(state)).toBe("Europe/Rome");
  });
});

describe("shortZoneLabel", () => {
  it("takes the city off an IANA id, underscores as spaces", () => {
    expect(shortZoneLabel("America/Los_Angeles")).toBe("Los Angeles");
    expect(shortZoneLabel("Asia/Tokyo")).toBe("Tokyo");
    expect(shortZoneLabel("UTC")).toBe("UTC");
  });
});

describe("buildItinerary", () => {
  const preset = DELIVERY_PRESETS.find((p) => p.id === "truck-ship-rail")!;
  const legs = preset.legs.map((l) => legObject(l));
  const facts = collectJourneyFacts(legs, undefined, lib);
  const itinerary = buildItinerary(facts, legs, "Europe/Rome", lib)!;

  function flatEvents(it: ReturnType<typeof buildItinerary>) {
    return it!.groups.flatMap((g) => g.events);
  }

  it("walks every event in strict instant order, never reordered by local date", () => {
    const events = flatEvents(itinerary);
    for (let i = 1; i < events.length; i++) {
      expect(
        Temporal.Instant.compare(events[i]!.instant, events[i - 1]!.instant),
      ).toBeGreaterThanOrEqual(0);
    }
    // Grouping follows that same order — no group's date appears again after
    // a later group has moved past it.
    const dates = itinerary.groups.map((g) => g.date);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it("gives London and Rome spring-forward DST notes inside the itinerary", () => {
    const events = flatEvents(itinerary);
    const dstEvents = events.filter((e) => e.kind === "dst");
    expect(dstEvents.length).toBeGreaterThan(0);
    const lon = dstEvents.find((e) => e.zone === "Europe/London");
    const rome = dstEvents.find((e) => e.zone === "Europe/Rome");
    expect(lon?.note).toBe("London clocks spring forward 01:00 → 02:00");
    expect(rome?.note).toContain("Rome clocks spring forward");
  });

  it("reads London's arrival 1 h early against the offset table (V41)", () => {
    const events = flatEvents(itinerary);
    const laArrival = events.find(
      (e) => e.kind === "arrival" && e.zone === "Europe/London",
    )!;
    expect(laArrival.time).toBe("05:00");
    expect(laArrival.offsetCheck).toEqual({
      agrees: false,
      badge: "1 h early",
      naiveTime: "04:00",
    });
  });

  it("marks the final Tokyo arrival as the ETA", () => {
    const events = flatEvents(itinerary);
    const last = events.filter((e) => e.kind === "arrival").at(-1)!;
    expect(last.isEta).toBe(true);
    expect(last.isoText).toBe("2024-04-12T17:30:00+09:00[Asia/Tokyo]");
  });

  it("marks the scheduled departure and the missed handoff on V32", () => {
    const missedPreset = DELIVERY_PRESETS.find(
      (p) => p.id === "missed-connection",
    )!;
    const missedLegs = missedPreset.legs.map((l) => legObject(l));
    expect(scheduleDelivery(missedLegs)).toBeNull();
    const missedFacts = collectJourneyFacts(missedLegs, undefined, lib);
    const missedItinerary = buildItinerary(
      missedFacts,
      missedLegs,
      "Europe/Rome",
      lib,
    )!;
    const missedChart = buildChartData(
      missedFacts,
      missedLegs,
      "Europe/Rome",
      lib,
    )!;
    expect(missedChart.legs.some((l) => l.missed)).toBe(true);
    const missedStation = missedChart.stations.find((s) =>
      s.badges.some((b) => b.kind === "missed"),
    );
    expect(missedStation).toBeDefined();
    // The station itself is the scheduled (but never made) departure; its
    // own badge names the ready instant it missed.
    expect(missedStation!.time).toBe("06:30");
    expect(
      missedStation!.badges.find((b) => b.kind === "missed")!.text,
    ).toContain("07:00");
    // The truck's own arrival station must never carry a "wait" badge here:
    // the ship never actually waited for anything, it missed the handoff.
    const truckStation = missedChart.stations.find(
      (s) => s.zone === "Europe/London",
    )!;
    expect(truckStation.badges.some((b) => b.kind === "wait")).toBe(false);
    expect(missedChart.conflict?.legIndex).toBe(1);
    expect(missedChart.conflict?.zone).toBe("Europe/London");
    // Scheduled to leave before the cargo was ready: the conflict this
    // record exists to mark.
    expect(missedChart.conflict!.scheduledMs).toBeLessThan(
      missedChart.conflict!.readyMs,
    );
    const events = flatEvents(missedItinerary);
    const missedHandoff = events.find((e) => e.tail === "missed")!;
    expect(missedHandoff).toBeDefined();
    expect(missedHandoff.missedText).toContain("06:30");
  });

  it("reads a naive delta of an hour on both London arrivals (V58)", () => {
    const p = DELIVERY_PRESETS.find((pp) => pp.id === "fall-back-night")!;
    const l = p.legs.map((leg) => legObject(leg));
    const f = collectJourneyFacts(l, undefined, lib);
    const t = buildItinerary(f, l, "Europe/London", lib)!;
    const arrivals = flatEvents(t).filter((e) => e.kind === "arrival");
    expect(arrivals.map((e) => e.offsetCheck?.naiveTime)).toEqual([
      "04:00",
      "07:00",
    ]);
    expect(arrivals.map((e) => e.time)).toEqual(["03:00", "06:00"]);
  });

  it("annotates the Date Line crossing on the trans-pacific preset", () => {
    const p = DELIVERY_PRESETS.find((pp) => pp.id === "trans-pacific")!;
    const l = p.legs.map((leg) => legObject(leg));
    const f = collectJourneyFacts(l, undefined, lib);
    const t = buildItinerary(f, l, "Asia/Tokyo", lib)!;
    const withAnomaly = t.groups.find((g) => g.anomaly !== null);
    expect(withAnomaly).toBeDefined();
    expect(withAnomaly!.anomaly).toContain("Date Line");
    // The departure (Tokyo, 17 June) and the arrival (Los Angeles, also 17
    // June by the wall clock, six hours "before" it left) land in the same
    // date group — the ordering stays by instant even though the group's
    // events span two zones reading two different calendars at once.
    const events = withAnomaly!.events;
    expect(
      events.some((e) => e.kind === "departure" && e.zone === "Asia/Tokyo"),
    ).toBe(true);
    expect(
      events.some(
        (e) => e.kind === "arrival" && e.zone === "America/Los_Angeles",
      ),
    ).toBe(true);
  });

  it("shows no offset-table disagreement on the trans-pacific preset (V57)", () => {
    const p = DELIVERY_PRESETS.find((pp) => pp.id === "trans-pacific")!;
    const l = p.legs.map((leg) => legObject(leg));
    const f = collectJourneyFacts(l, undefined, lib);
    const t = buildItinerary(f, l, "Asia/Tokyo", lib)!;
    const arrivals = flatEvents(t).filter((e) => e.kind === "arrival");
    for (const a of arrivals) expect(a.offsetCheck?.agrees).toBe(true);
  });

  it("builds chart data as equal-count legs, one per leg, with the leg's own duration text", () => {
    const chart = buildChartData(facts, legs, "Europe/Rome", lib)!;
    expect(chart.legs).toHaveLength(3);
    expect(chart.legs.map((l) => l.durationText)).toEqual([
      "1 d 21 h",
      "11 d",
      "2 h 30 min",
    ]);
    // origin + one station per leg
    expect(chart.stations).toHaveLength(4);
    expect(chart.stations[0]!.isOrigin).toBe(true);
    expect(chart.stations.at(-1)!.isEta).toBe(true);
    const laStation = chart.stations.find((s) => s.zone === "Europe/London")!;
    expect(laStation.badges.some((b) => b.kind === "offset")).toBe(true);
    expect(laStation.badges.find((b) => b.kind === "offset")!.text).toBe(
      "1 h early",
    );
    expect(laStation.badges.some((b) => b.kind === "handling")).toBe(true);
  });

  it("attaches both Rome's and London's spring-forward transitions to leg ① (default preset)", () => {
    const chart = buildChartData(facts, legs, "Europe/Rome", lib)!;
    const legOneTransitions = chart.transitions.filter(
      (t) => t.legIndex === 0 && t.kind === "dst",
    );
    const zones = new Set(legOneTransitions.map((t) => t.zone));
    expect(zones.has("Europe/Rome")).toBe(true);
    expect(zones.has("Europe/London")).toBe(true);
  });
});

describe("buildEtaSummary", () => {
  const preset = DELIVERY_PRESETS.find((p) => p.id === "truck-ship-rail")!;
  const legs = preset.legs.map((l) => legObject(l));
  const facts = collectJourneyFacts(legs, undefined, lib);
  const chartData = buildChartData(facts, legs, "Europe/Rome", lib);

  it("names the real ETA, its exact ISO, the door-to-door span and the DST and offset flags (V30)", () => {
    const summary = buildEtaSummary(facts, legs, chartData);
    expect(summary.status).toBe("ok");
    expect(summary.legCount).toBe(3);
    expect(summary.etaIso).toBe("2024-04-12T17:30:00+09:00[Asia/Tokyo]");
    expect(summary.etaLocal).toBe("Fri 12 Apr 2024 · 17:30 Tokyo (+09:00)");
    // 2024-03-29T07:00:00Z (the exact departure) to 2024-04-12T08:30:00Z
    // (the exact final arrival) is 14 days, 1 hour, 30 minutes.
    expect(summary.doorToDoor).toBe("14 d 1 h 30 min door to door");
    expect(summary.flags).toContain("DST ×2");
    expect(summary.flags).toContain("1 h offset-table error");
    expect(summary.flags).not.toContain("Date Line");
  });

  it("names the failing leg and a short headline on a missed connection (V32)", () => {
    const missedPreset = DELIVERY_PRESETS.find(
      (p) => p.id === "missed-connection",
    )!;
    const missedLegs = missedPreset.legs.map((l) => legObject(l));
    const missedFacts = collectJourneyFacts(missedLegs, undefined, lib);
    const missedChart = buildChartData(
      missedFacts,
      missedLegs,
      "Europe/Rome",
      lib,
    );
    const summary = buildEtaSummary(missedFacts, missedLegs, missedChart);
    expect(summary.status).toBe("failed");
    expect(summary.failureLeg).toBe(2);
    expect(summary.failureHeadline).toBe("Missed connection");
    expect(summary.etaIso).toBeUndefined();
  });

  it("flags a Date Line crossing on the trans-pacific preset, with no offset-table flag", () => {
    const p = DELIVERY_PRESETS.find((pp) => pp.id === "trans-pacific")!;
    const l = p.legs.map((leg) => legObject(leg));
    const f = collectJourneyFacts(l, undefined, lib);
    const t = buildChartData(f, l, "Asia/Tokyo", lib);
    const summary = buildEtaSummary(f, l, t);
    expect(summary.flags).toContain("Date Line");
    expect(summary.flags.some((flag) => flag.includes("offset-table"))).toBe(
      false,
    );
  });
});
