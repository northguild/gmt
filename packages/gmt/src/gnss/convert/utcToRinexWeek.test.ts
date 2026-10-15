import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { rinexWeekToUtc } from "./rinexWeekToUtc";
import { utcToRinexWeek } from "./utcToRinexWeek";

const rows = [
  {
    system: "BDT",
    utcString: "2021-07-05T21:59:56Z",
    week: 809,
    timeOfWeekSeconds: 165600,
    why: "RINEX Table A27's C05 record",
  },
  {
    system: "BDT",
    utcString: "2024-01-01T00:00:00Z",
    week: 939,
    timeOfWeekSeconds: 86404,
    why: "BDT weeks from 2006",
  },
  {
    system: "IRN",
    utcString: "2024-01-01T00:00:00Z",
    week: 2295,
    timeOfWeekSeconds: 86418,
    why: "Table A30: from 1980, same as GPS",
  },
  {
    system: "GPS",
    utcString: "2024-01-01T00:00:00Z",
    week: 2295,
    timeOfWeekSeconds: 86418,
    why: "continuous from 1980",
  },
  {
    system: "GAL",
    utcString: "2024-01-01T00:00:00Z",
    week: 2295,
    timeOfWeekSeconds: 86418,
    why: "continuous from 1980",
  },
  {
    system: "QZS",
    utcString: "2024-01-01T00:00:00Z",
    week: 2295,
    timeOfWeekSeconds: 86418,
    why: "continuous from 1980",
  },
  {
    system: "GPS",
    utcString: "2016-12-31T23:59:60Z",
    week: 1930,
    timeOfWeekSeconds: 17,
    why: "the inserted second",
  },
  {
    system: "GPS",
    utcString: "1980-01-06T00:00:00Z",
    week: 0,
    timeOfWeekSeconds: 0,
    why: "the GPS epoch",
  },
  {
    system: "GAL",
    utcString: "1999-08-21T23:59:47Z",
    week: 1024,
    timeOfWeekSeconds: 0,
    why: "the Galileo epoch",
  },
] as const;

describe("utcToRinexWeek", () => {
  it.each(rows)(
    "returns week $week, $timeOfWeekSeconds s for $system $utcString ($why)",
    ({ system, utcString, week, timeOfWeekSeconds }) => {
      expect(utcToRinexWeek(system, utcString)).toEqual({
        week,
        timeOfWeekSeconds,
      });
    },
  );

  it.each(rows)(
    "reads $system week $week, $timeOfWeekSeconds s back as $utcString",
    ({ system, utcString, week, timeOfWeekSeconds }) => {
      expect(rinexWeekToUtc(system, week, timeOfWeekSeconds)).toBe(utcString);
    },
  );

  it.each`
    system   | utcString                 | why
    ${"BDT"} | ${"2005-12-31T23:59:59Z"} | ${"before the BeiDou epoch"}
    ${"GPS"} | ${"1980-01-05T23:59:59Z"} | ${"before the GPS epoch"}
    ${"GAL"} | ${"1999-08-21T23:59:46Z"} | ${"before the Galileo epoch"}
    ${"IRN"} | ${"1999-08-21T23:59:46Z"} | ${"before the NavIC epoch"}
    ${"GPS"} | ${"2017-12-31T23:59:60Z"} | ${"second 60 with no insertion that day"}
  `("returns null for $system $utcString ($why)", ({ system, utcString }) => {
    expect(utcToRinexWeek(system, utcString)).toBeNull();
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
    expect(utcToRinexWeek("GPS", utcString)).toBeNull();
  });

  it.each`
    system        | why
    ${"GPS-LNAV"} | ${"a broadcast counter"}
    ${"BDS"}      | ${"the constellation name"}
    ${null}       | ${"null"}
  `("returns null for the system $system ($why)", ({ system }) => {
    expect(utcToRinexWeek(system, "2024-01-01T00:00:00Z")).toBeNull();
  });

  it("returns null for GLO, whose RINEX records carry no week", () => {
    // @ts-expect-error RINEX GLONASS records carry no week number, so GLO is not a RinexWeekSystem
    expect(utcToRinexWeek("GLO", "2024-01-01T00:00:00Z")).toBeNull();
  });

  it("returns a new object on every call", () => {
    const first = utcToRinexWeek("GPS", "2024-01-01T00:00:00Z");
    const second = utcToRinexWeek("GPS", "2024-01-01T00:00:00Z");
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
  });

  it("returns null when Temporal.Instant.from throws on a second-60 string", () => {
    mockTemporalInstantFromThrow();
    expect(utcToRinexWeek("GPS", "2016-12-31T23:59:60Z")).toBeNull();
  });
});
