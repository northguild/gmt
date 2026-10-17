import { Temporal } from "@js-temporal/polyfill";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { gnssWeekToUtc } from "./gnssWeekToUtc";
import { utcToGnssWeek } from "./utcToGnssWeek";

const rows = [
  {
    counter: "GPS-LNAV",
    utcString: "2019-04-07T00:00:00Z",
    week: 0,
    timeOfWeekSeconds: 18,
    era: 2,
    why: "MAR-16: era 2 after the second rollover",
  },
  {
    counter: "GPS-CNAV",
    utcString: "2019-04-07T00:00:00Z",
    week: 2048,
    timeOfWeekSeconds: 18,
    era: 0,
    why: "CNAV has not wrapped",
  },
  {
    counter: "GAL",
    utcString: "2019-04-07T00:00:00Z",
    week: 1024,
    timeOfWeekSeconds: 18,
    era: 0,
    why: "MAR-16: Galileo era 0",
  },
  {
    counter: "BDT",
    utcString: "2019-04-07T00:00:00Z",
    week: 692,
    timeOfWeekSeconds: 4,
    era: 0,
    why: "BDT − UTC 4 s",
  },
  {
    counter: "QZS-LNAV",
    utcString: "2019-04-07T00:00:00Z",
    week: 0,
    timeOfWeekSeconds: 18,
    era: 2,
    why: "QZSS weeks are GPS weeks",
  },
  {
    counter: "GPS-LNAV",
    utcString: "2024-01-01T00:00:00Z",
    week: 247,
    timeOfWeekSeconds: 86418,
    era: 2,
    why: "LNAV in 2024",
  },
  {
    counter: "GPS-CNAV",
    utcString: "2024-01-01T00:00:00Z",
    week: 2295,
    timeOfWeekSeconds: 86418,
    era: 0,
    why: "CNAV in 2024",
  },
  {
    counter: "QZS-CNAV",
    utcString: "2024-01-01T00:00:00Z",
    week: 2295,
    timeOfWeekSeconds: 86418,
    era: 0,
    why: "QZSS CNAV in 2024",
  },
  {
    counter: "GAL",
    utcString: "2024-01-01T00:00:00Z",
    week: 1271,
    timeOfWeekSeconds: 86418,
    era: 0,
    why: "Galileo in 2024",
  },
  {
    counter: "BDT",
    utcString: "2024-01-01T00:00:00Z",
    week: 939,
    timeOfWeekSeconds: 86404,
    era: 0,
    why: "BeiDou in 2024",
  },
  {
    counter: "GPS-LNAV",
    utcString: "1980-01-06T00:00:00Z",
    week: 0,
    timeOfWeekSeconds: 0,
    era: 0,
    why: "the GPS epoch",
  },
  {
    counter: "GPS-LNAV",
    utcString: "2016-12-31T23:59:60Z",
    week: 906,
    timeOfWeekSeconds: 17,
    era: 1,
    why: "the inserted second",
  },
  {
    counter: "GPS-LNAV",
    utcString: "2024-01-01T00:00:00.5Z",
    week: 247,
    timeOfWeekSeconds: 86418.5,
    era: 2,
    why: "a fraction",
  },
  {
    counter: "GPS-LNAV",
    utcString: "2024-01-01T00:00:00.123456789Z",
    week: 247,
    timeOfWeekSeconds: 86418.123456789,
    era: 2,
    why: "nine fraction digits",
  },
  {
    counter: "GPS-LNAV",
    utcString: "2019-04-06T23:59:41.999999999Z",
    week: 1023,
    timeOfWeekSeconds: 604799.999999999,
    era: 1,
    why: "the last nanosecond before a rollover",
  },
  {
    counter: "GPS-LNAV",
    utcString: "2019-04-06T23:59:42Z",
    week: 0,
    timeOfWeekSeconds: 0,
    era: 2,
    why: "the second rollover",
  },
  {
    counter: "GPS-LNAV",
    utcString: "1999-08-21T23:59:47Z",
    week: 0,
    timeOfWeekSeconds: 0,
    era: 1,
    why: "the first rollover",
  },
  {
    counter: "GAL",
    utcString: "1999-08-21T23:59:47Z",
    week: 0,
    timeOfWeekSeconds: 0,
    era: 0,
    why: "the Galileo epoch",
  },
  {
    counter: "BDT",
    utcString: "2006-01-01T00:00:00Z",
    week: 0,
    timeOfWeekSeconds: 0,
    era: 0,
    why: "the BeiDou epoch",
  },
  {
    counter: "GPS-LNAV",
    utcString: "2027-06-28T00:00:00Z",
    week: 429,
    timeOfWeekSeconds: 86418,
    era: 2,
    why: "18 s: the table is closed",
  },
  {
    counter: "GPS-LNAV",
    utcString: "2100-01-01T00:00:00Z",
    week: 116,
    timeOfWeekSeconds: 432018,
    era: 6,
    why: "era 6",
  },
  {
    counter: "IRN-LNAV",
    utcString: "2024-01-01T00:00:00Z",
    week: 247,
    timeOfWeekSeconds: 86418,
    era: 1,
    why: "NavIC week 0 is GPS week 1024",
  },
  {
    counter: "IRN-L1NV",
    utcString: "2024-01-01T00:00:00Z",
    week: 1271,
    timeOfWeekSeconds: 86418,
    era: 0,
    why: "NavIC L1NV has not wrapped",
  },
  {
    counter: "IRN-LNAV",
    utcString: "2019-04-07T00:00:00Z",
    week: 0,
    timeOfWeekSeconds: 18,
    era: 1,
    why: "the first NavIC 10-bit rollover",
  },
  {
    counter: "GPS-CNAV",
    utcString: "9999-12-31T23:59:59.999999999Z",
    week: 670,
    timeOfWeekSeconds: 518417.999999999,
    era: 51,
    why: "the last four-digit UTC instant: full week 418462",
  },
  {
    counter: "GPS-LNAV",
    utcString: "9999-12-31T23:59:59.999999999Z",
    week: 670,
    timeOfWeekSeconds: 518417.999999999,
    era: 408,
    why: "the last four-digit UTC instant: 408 × 1024 + 670",
  },
] as const;

describe("utcToGnssWeek", () => {
  it.each(rows)(
    "returns week $week, $timeOfWeekSeconds s, era $era for $counter $utcString ($why)",
    ({ counter, utcString, week, timeOfWeekSeconds, era }) => {
      expect(utcToGnssWeek(counter, utcString)).toEqual({
        week,
        timeOfWeekSeconds,
        era,
      });
    },
  );

  it.each(rows)(
    "reads $counter week $week, $timeOfWeekSeconds s, era $era back as $utcString",
    ({ counter, utcString, week, timeOfWeekSeconds, era }) => {
      expect(gnssWeekToUtc(counter, week, timeOfWeekSeconds, era)).toBe(
        utcString,
      );
    },
  );

  it.each`
    counter       | utcString                           | why
    ${"IRN-LNAV"} | ${"1999-08-21T23:59:46Z"}           | ${"before the NavIC epoch"}
    ${"GPS-LNAV"} | ${"1980-01-05T23:59:59Z"}           | ${"before the GPS epoch"}
    ${"GAL"}      | ${"1999-08-21T23:59:46Z"}           | ${"before the Galileo epoch"}
    ${"BDT"}      | ${"2005-12-31T23:59:59Z"}           | ${"before the BeiDou epoch"}
    ${"GPS-LNAV"} | ${"2017-12-31T23:59:60Z"}           | ${"second 60 with no insertion that day"}
    ${"GPS-LNAV"} | ${"1980-01-05T23:59:59.999999999Z"} | ${"one nanosecond before the GPS epoch"}
    ${"GPS-LNAV"} | ${"-271821-04-20T00:00:00Z"}        | ${"Temporal's first instant, before 1972"}
  `("returns null for $counter $utcString ($why)", ({ counter, utcString }) => {
    expect(utcToGnssWeek(counter, utcString)).toBeNull();
  });

  it.each`
    utcString
    ${null}
    ${undefined}
    ${123}
    ${""}
    ${"x"}
    ${"2024-01-01"}
    ${"2024-01-01T00:00:00"}
    ${"2024-01-01T00:00:00[UTC]"}
    ${"20240101T000000Z"}
  `("returns null for the invalid instant $utcString", ({ utcString }) => {
    expect(utcToGnssWeek("GPS-LNAV", utcString)).toBeNull();
  });

  it.each`
    counter   | why
    ${"GPS"}  | ${"a system: GPS has two counters"}
    ${"QZS"}  | ${"a system: QZSS has two counters"}
    ${"IRN"}  | ${"a system: NavIC has two counters"}
    ${"BDS"}  | ${"the constellation name"}
    ${"LNAV"} | ${"a message without its system"}
    ${null}   | ${"null"}
  `("returns null for the counter $counter ($why)", ({ counter }) => {
    expect(utcToGnssWeek(counter, "2024-01-01T00:00:00Z")).toBeNull();
  });

  // Not in the round-trip rows: gnssWeekToUtc writes these instants back in another spelling, or
  // not at all.
  it.each`
    counter       | utcString                      | week   | timeOfWeekSeconds | era  | why
    ${"GPS-LNAV"} | ${"2017-01-01T08:59:60+09:00"} | ${906} | ${17}             | ${1} | ${"the inserted second written at +09:00"}
  `(
    "returns week $week, $timeOfWeekSeconds s, era $era for $counter $utcString ($why)",
    ({ counter, utcString, week, timeOfWeekSeconds, era }) => {
      expect(utcToGnssWeek(counter, utcString)).toEqual({
        week,
        timeOfWeekSeconds,
        era,
      });
    },
  );

  it.each`
    counter       | utcString                      | why
    ${"GPS-LNAV"} | ${"+010000-01-01T00:00:00Z"}   | ${"one second past 9999-12-31T23:59:59Z: gnssWeekToUtc cannot write it back"}
    ${"GPS-CNAV"} | ${"+010000-01-01T00:00:00.5Z"} | ${"half a second into year 10000"}
    ${"BDT"}      | ${"+275760-09-13T00:00:00Z"}   | ${"Temporal's last instant"}
    ${"IRN-LNAV"} | ${"+010000-01-01T00:00:00Z"}   | ${"NavIC, past year 9999"}
  `("returns null for $counter $utcString ($why)", ({ counter, utcString }) => {
    expect(utcToGnssWeek(counter, utcString)).toBeNull();
  });

  it.each`
    counter       | utcString                           | why
    ${"GPS-LNAV"} | ${"9999-12-31T23:59:59Z"}           | ${"the last whole second of year 9999"}
    ${"GAL"}      | ${"9999-12-31T23:59:59Z"}           | ${"Galileo, the last whole second of year 9999"}
    ${"GPS-LNAV"} | ${"9999-12-31T23:59:59.999999999Z"} | ${"the last nanosecond of year 9999"}
  `(
    "round-trips $counter $utcString through gnssWeekToUtc ($why)",
    ({ counter, utcString }) => {
      const week = utcToGnssWeek(counter, utcString);
      expect(week).not.toBeNull();
      expect(
        gnssWeekToUtc(counter, week!.week, week!.timeOfWeekSeconds, week!.era),
      ).toBe(utcString);
    },
  );

  it("returns null for GLO, which has no week counter", () => {
    // @ts-expect-error GLONASS broadcasts no week number, so GLO is not a GnssWeekCounter
    expect(utcToGnssWeek("GLO", "2024-01-01T00:00:00Z")).toBeNull();
  });

  it("returns a new object on every call", () => {
    const first = utcToGnssWeek("GPS-LNAV", "2024-01-01T00:00:00Z");
    const second = utcToGnssWeek("GPS-LNAV", "2024-01-01T00:00:00Z");
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
  });

  it("never reads the clock", () => {
    const now = vi.spyOn(Temporal.Now, "instant");
    utcToGnssWeek("GPS-LNAV", "2024-01-01T00:00:00Z");
    expect(now).not.toHaveBeenCalled();
  });

  it("returns null when Temporal.Instant.from throws on a second-60 string", () => {
    mockTemporalInstantFromThrow();
    expect(utcToGnssWeek("GPS-LNAV", "2016-12-31T23:59:60Z")).toBeNull();
  });
});
