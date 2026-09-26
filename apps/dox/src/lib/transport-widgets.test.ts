import { describe, expect, it } from "vitest";
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
  ZERO_LEG,
  collectJourneyFacts,
  departureAt,
  diagnose,
  formatCrossing,
  formatSchedule,
  legObject,
  minutesText,
  offsetTableReading,
  readyAt,
  scheduleCallSource,
  scheduleNullText,
  type LegFields,
  type TransportLib,
} from "./transport-widgets";

const lib: TransportLib = {
  scheduleDelivery,
  transitTime,
  etaAtZone,
  crossingTime,
  isValidTimeZone,
  isValidDateTime,
  resolveLocal,
};

const truck: LegFields = {
  departure: "2024-03-08T08:00:00-06:00[America/Chicago]",
  duration: "PT46H",
  timeZone: "America/Los_Angeles",
  dwellAfter: "PT2H",
  mode: "truck",
};
const ship = (departure: string): LegFields => ({
  departure,
  duration: "P11D",
  timeZone: "Asia/Tokyo",
  dwellAfter: "PT24H",
  mode: "ship",
});
const rail: LegFields = {
  departure: "",
  duration: "PT2H30M",
  timeZone: "Asia/Tokyo",
  dwellAfter: "",
  mode: "rail",
};
const blank = (over: Partial<LegFields>): LegFields => ({
  departure: "",
  duration: "",
  timeZone: "",
  dwellAfter: "",
  mode: "",
  ...over,
});

describe("legObject", () => {
  it("keys in JSDoc order, with every blank field omitted", () => {
    expect(legObject(truck)).toEqual({
      departure: "2024-03-08T08:00:00-06:00[America/Chicago]",
      duration: "PT46H",
      timeZone: "America/Los_Angeles",
      dwellAfter: "PT2H",
      mode: "truck",
    });
    expect(Object.keys(legObject(truck))).toEqual([
      "departure",
      "duration",
      "timeZone",
      "dwellAfter",
      "mode",
    ]);
  });

  it("omits blank departure, dwellAfter and mode", () => {
    const noDep = ship("");
    expect(legObject(noDep)).toEqual({
      duration: "P11D",
      timeZone: "Asia/Tokyo",
      dwellAfter: "PT24H",
      mode: "ship",
    });
    expect(legObject(rail)).toEqual({
      duration: "PT2H30M",
      timeZone: "Asia/Tokyo",
      mode: "rail",
    });
  });
});

describe("scheduleCallSource", () => {
  it("matches the JSDoc call text verbatim for V2", () => {
    const legs = [
      legObject(
        blank({
          departure: "2024-06-15T00:00:00Z",
          duration: "PT10H",
          timeZone: "UTC",
          dwellAfter: "PT2H",
        }),
      ),
      legObject(blank({ duration: "PT5H", timeZone: "Asia/Tokyo" })),
    ];
    const [, plain] = scheduleCallSource(legs);
    expect(plain).toBe(
      '[{ departure: "2024-06-15T00:00:00Z", duration: "PT10H", timeZone: "UTC", dwellAfter: "PT2H" }, { duration: "PT5H", timeZone: "Asia/Tokyo" }]',
    );
  });

  it("matches the JSDoc call text verbatim for V4, options included", () => {
    const legs = [
      legObject(
        blank({
          departure: "2024-06-15T10:00:00",
          duration: "PT1H",
          timeZone: "UTC",
        }),
      ),
    ];
    const [, plain] = scheduleCallSource(legs, {
      startTimeZone: "America/New_York",
    });
    expect(plain).toBe(
      '[{ departure: "2024-06-15T10:00:00", duration: "PT1H", timeZone: "UTC" }], { startTimeZone: "America/New_York" }',
    );
  });

  it("omits startTimeZone from the source when blank", () => {
    const legs = [legObject(truck)];
    const [, plain] = scheduleCallSource(legs);
    expect(plain).not.toContain("startTimeZone");
  });
});

describe("formatSchedule / formatCrossing", () => {
  it("collapses to the V1 literal", () => {
    const r = scheduleDelivery([
      {
        departure: "2024-06-15T10:00:00Z",
        duration: "PT36H",
        timeZone: "Asia/Tokyo",
      },
    ])!;
    expect(formatSchedule(r).replace(/\n\s+/g, " ")).toBe(
      '{ eta: "2024-06-17T07:00:00+09:00[Asia/Tokyo]", legTimes: [{ arrival: "2024-06-16T22:00:00Z", localArrival: "2024-06-17T07:00:00+09:00[Asia/Tokyo]", dwellAfter: "PT0S" }] }',
    );
  });

  it("collapses to the V2 literal", () => {
    const r = scheduleDelivery([
      {
        departure: "2024-06-15T00:00:00Z",
        duration: "PT10H",
        timeZone: "UTC",
        dwellAfter: "PT2H",
      },
      { duration: "PT5H", timeZone: "Asia/Tokyo" },
    ])!;
    expect(formatSchedule(r).replace(/\n\s+/g, " ")).toBe(
      '{ eta: "2024-06-16T02:00:00+09:00[Asia/Tokyo]", legTimes: [{ arrival: "2024-06-15T10:00:00Z", localArrival: "2024-06-15T10:00:00+00:00[UTC]", dwellAfter: "PT2H" }, { arrival: "2024-06-15T17:00:00Z", localArrival: "2024-06-16T02:00:00+09:00[Asia/Tokyo]", dwellAfter: "PT0S" }] }',
    );
  });

  it("renders V5's empty schedule", () => {
    const r = scheduleDelivery([])!;
    expect(formatSchedule(r)).toBe('{ eta: "", legTimes: [] }');
  });

  it("collapses crossingTime's V46 to its JSDoc literal", () => {
    const r = crossingTime(
      "2024-06-15T08:00:00Z",
      "2024-06-15T17:30:00Z",
      "Europe/Berlin",
    )!;
    expect(formatCrossing(r).replace(/\n\s+/g, " ")).toBe(
      '{ duration: "PT9H30M", enter: "2024-06-15T10:00:00+02:00[Europe/Berlin]", exit: "2024-06-15T19:30:00+02:00[Europe/Berlin]" }',
    );
  });
});

describe("minutesText", () => {
  it("renders hours and minutes only", () => {
    expect(minutesText(0)).toBe("0 min");
    expect(minutesText(5)).toBe("5 min");
    expect(minutesText(60)).toBe("1 h");
    expect(minutesText(90)).toBe("1 h 30 min");
    expect(minutesText(55)).toBe("55 min");
    expect(minutesText(-60)).toBe("1 h");
  });
});

describe("readyAt / departureAt", () => {
  it("readyAt gives V35's second leg arrival", () => {
    const legs = [
      legObject(truck),
      legObject(blank({ duration: "PT0S", timeZone: "UTC" })),
    ];
    expect(readyAt([legObject(truck)], 0, undefined, lib)).toBe(
      "2024-03-10T14:00:00Z",
    );
    void legs;
  });

  it("departureAt resolves V43's alone-standing departure", () => {
    expect(
      departureAt(
        "2024-03-10T06:30:00[America/Los_Angeles]",
        false,
        undefined,
        lib,
      ),
    ).toBe("2024-03-10T13:30:00Z");
  });
});

describe("diagnose", () => {
  const one = (over: Partial<LegFields>) => [legObject(blank(over))];

  it("invalid-start-zone (V17)", () => {
    const legs = one({
      departure: "2024-06-15T10:00:00Z",
      duration: "PT1H",
      timeZone: "UTC",
    });
    expect(
      scheduleDelivery(legs, { startTimeZone: "Mars/Olympus_Mons" }),
    ).toBeNull();
    expect(diagnose(legs, { startTimeZone: "Mars/Olympus_Mons" }, lib)).toEqual(
      { leg: -1, reason: "invalid-start-zone" },
    );
  });

  it("no-departure (V9)", () => {
    const legs = one({ duration: "PT1H", timeZone: "UTC" });
    expect(scheduleDelivery(legs)).toBeNull();
    expect(diagnose(legs, undefined, lib)).toEqual({
      leg: 0,
      reason: "no-departure",
    });
  });

  it("zoneless-first (V7)", () => {
    const legs = one({
      departure: "2024-06-15T10:00:00",
      duration: "PT1H",
      timeZone: "UTC",
    });
    expect(scheduleDelivery(legs)).toBeNull();
    expect(diagnose(legs, undefined, lib)).toEqual({
      leg: 0,
      reason: "zoneless-first",
    });
  });

  it("zoneless-later (V16)", () => {
    const legs = [
      legObject(
        blank({
          departure: "2024-06-15T10:00:00Z",
          duration: "PT1H",
          timeZone: "UTC",
        }),
      ),
      legObject(
        blank({
          departure: "2024-06-15T12:00:00",
          duration: "PT1H",
          timeZone: "UTC",
        }),
      ),
    ];
    expect(scheduleDelivery(legs)).toBeNull();
    expect(diagnose(legs, undefined, lib)).toEqual({
      leg: 1,
      reason: "zoneless-later",
    });
  });

  it("invalid-departure (V28)", () => {
    const legs = one({
      departure: "2024-06-15T10:00:00-05:00[America/New_York]",
      duration: "PT1H",
      timeZone: "UTC",
    });
    expect(scheduleDelivery(legs)).toBeNull();
    expect(diagnose(legs, undefined, lib)).toEqual({
      leg: 0,
      reason: "invalid-departure",
    });
  });

  it("missed-connection (V32, leg index 1)", () => {
    const legs = [
      legObject(truck),
      legObject(ship("2024-03-10T06:30:00[America/Los_Angeles]")),
    ];
    expect(scheduleDelivery(legs)).toBeNull();
    expect(diagnose(legs, undefined, lib)).toEqual({
      leg: 1,
      reason: "missed-connection",
    });
  });

  it("invalid-duration (V10)", () => {
    const legs = one({
      departure: "2024-06-15T10:00:00Z",
      duration: "P1M",
      timeZone: "UTC",
    });
    expect(scheduleDelivery(legs)).toBeNull();
    expect(diagnose(legs, undefined, lib)).toEqual({
      leg: 0,
      reason: "invalid-duration",
    });
  });

  it("negative-duration (V8)", () => {
    const legs = one({
      departure: "2024-06-15T10:00:00Z",
      duration: "-PT1H",
      timeZone: "UTC",
    });
    expect(scheduleDelivery(legs)).toBeNull();
    expect(diagnose(legs, undefined, lib)).toEqual({
      leg: 0,
      reason: "negative-duration",
    });
  });

  it("invalid-zone", () => {
    const legs = one({
      departure: "2024-06-15T10:00:00Z",
      duration: "PT1H",
      timeZone: "Not/AZone",
    });
    expect(scheduleDelivery(legs)).toBeNull();
    expect(diagnose(legs, undefined, lib)).toEqual({
      leg: 0,
      reason: "invalid-zone",
    });
  });

  it("invalid-dwell (V29)", () => {
    const legs = [
      legObject(
        blank({
          departure: "2024-06-15T10:00:00Z",
          duration: "PT1H",
          timeZone: "UTC",
          dwellAfter: "-PT1H",
        }),
      ),
      legObject(blank({ duration: "PT1H", timeZone: "UTC" })),
    ];
    expect(scheduleDelivery(legs)).toBeNull();
    expect(diagnose(legs, undefined, lib)).toEqual({
      leg: 0,
      reason: "invalid-dwell",
    });
  });

  it("scheduleNullText gives a reason string for every reason", () => {
    for (const reason of [
      "invalid-start-zone",
      "no-departure",
      "zoneless-first",
      "zoneless-later",
      "invalid-departure",
      "missed-connection",
      "invalid-duration",
      "negative-duration",
      "invalid-zone",
      "invalid-dwell",
      "out-of-range",
    ] as const) {
      expect(scheduleNullText(reason, 2)).toBeTruthy();
    }
  });
});

describe("collectJourneyFacts", () => {
  it("reaches every leg and collects V30's arrivals", () => {
    const legs = [legObject(truck), legObject(ship("")), legObject(rail)];
    const facts = collectJourneyFacts(legs, undefined, lib);
    expect(facts.result).not.toBeNull();
    expect(facts.arrivals).toEqual([
      "2024-03-10T12:00:00Z",
      "2024-03-21T14:00:00Z",
      "2024-03-22T16:30:00Z",
    ]);
    expect(facts.readies[0]).toBe("2024-03-10T14:00:00Z");
  });

  it("reaches only the legs before the failing one on V32", () => {
    const legs = [
      legObject(truck),
      legObject(ship("2024-03-10T06:30:00[America/Los_Angeles]")),
    ];
    const facts = collectJourneyFacts(legs, undefined, lib);
    expect(facts.result).toBeNull();
    expect(facts.failure).toEqual({ leg: 1, reason: "missed-connection" });
    expect(facts.arrivals).toEqual(["2024-03-10T12:00:00Z"]);
    expect(facts.readies[0]).toBe("2024-03-10T14:00:00Z");
    expect(facts.scheduled[1]).toBe("2024-03-10T06:30:00[America/Los_Angeles]");
  });
});

describe("offsetTableReading", () => {
  it("matches the spec's worked example", () => {
    expect(
      offsetTableReading(
        "2024-03-10T12:00:00Z",
        "America/Los_Angeles",
        "2024-03-08T14:00:00Z",
      ),
    ).toEqual({
      wall: "2024-03-10T04:00",
      offset: "-08:00",
      deltaMinutes: -60,
    });
  });

  it("agrees (delta 0) when no DST transition intervenes", () => {
    const reading = offsetTableReading(
      "2024-06-15T10:00:00Z",
      "UTC",
      "2024-06-01T00:00:00Z",
    );
    expect(reading.deltaMinutes).toBe(0);
  });
});

describe("ZERO_LEG", () => {
  it("is a valid zero-length UTC leg", () => {
    expect(
      scheduleDelivery([{ ...ZERO_LEG, departure: "2024-06-15T10:00:00Z" }]),
    ).toEqual({
      eta: "2024-06-15T10:00:00+00:00[UTC]",
      legTimes: [
        {
          arrival: "2024-06-15T10:00:00Z",
          localArrival: "2024-06-15T10:00:00+00:00[UTC]",
          dwellAfter: "PT0S",
        },
      ],
    });
  });
});
