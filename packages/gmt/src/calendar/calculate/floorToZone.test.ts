import { battleTestTimeZones } from "../../test";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { floorToZone } from "./floorToZone";

/** The spec's own example instant: 03:00 UTC on 15 June, which is 14 June in the Americas. */
const sourceInstant = "2024-06-15T03:00:00Z";

describe("floorToZone", () => {
  it.each`
    timeZone                 | expected
    ${"UTC"}                 | ${"2024-06-15T00:00:00Z"}
    ${"GMT"}                 | ${"2024-06-15T00:00:00Z"}
    ${"Etc/GMT"}             | ${"2024-06-15T00:00:00Z"}
    ${"America/Nome"}        | ${"2024-06-14T08:00:00Z"}
    ${"Asia/Anadyr"}         | ${"2024-06-14T12:00:00Z"}
    ${"Europe/Lisbon"}       | ${"2024-06-14T23:00:00Z"}
    ${"Europe/Dublin"}       | ${"2024-06-14T23:00:00Z"}
    ${"Europe/Berlin"}       | ${"2024-06-14T22:00:00Z"}
    ${"Europe/Helsinki"}     | ${"2024-06-14T21:00:00Z"}
    ${"Europe/Istanbul"}     | ${"2024-06-14T21:00:00Z"}
    ${"Asia/Kolkata"}        | ${"2024-06-14T18:30:00Z"}
    ${"Asia/Kathmandu"}      | ${"2024-06-14T18:15:00Z"}
    ${"Asia/Shanghai"}       | ${"2024-06-14T16:00:00Z"}
    ${"Australia/Lord_Howe"} | ${"2024-06-14T13:30:00Z"}
    ${"Pacific/Chatham"}     | ${"2024-06-14T11:15:00Z"}
    ${"Pacific/Apia"}        | ${"2024-06-14T11:00:00Z"}
    ${"Pacific/Niue"}        | ${"2024-06-14T11:00:00Z"}
    ${"America/New_York"}    | ${"2024-06-14T04:00:00Z"}
    ${"America/Chicago"}     | ${"2024-06-14T05:00:00Z"}
    ${"America/Phoenix"}     | ${"2024-06-14T07:00:00Z"}
  `(
    "floors 2024-06-15T03:00:00Z to the local day in $timeZone as $expected",
    ({ timeZone, expected }) => {
      expect(floorToZone(sourceInstant, "day", timeZone)).toBe(expected);
    },
  );

  it.each`
    timeZone                 | expected
    ${"UTC"}                 | ${"2024-06-15T03:00:00Z"}
    ${"GMT"}                 | ${"2024-06-15T03:00:00Z"}
    ${"Etc/GMT"}             | ${"2024-06-15T03:00:00Z"}
    ${"America/Nome"}        | ${"2024-06-15T03:00:00Z"}
    ${"Asia/Anadyr"}         | ${"2024-06-15T03:00:00Z"}
    ${"Europe/Lisbon"}       | ${"2024-06-15T03:00:00Z"}
    ${"Europe/Dublin"}       | ${"2024-06-15T03:00:00Z"}
    ${"Europe/Berlin"}       | ${"2024-06-15T03:00:00Z"}
    ${"Europe/Helsinki"}     | ${"2024-06-15T03:00:00Z"}
    ${"Europe/Istanbul"}     | ${"2024-06-15T03:00:00Z"}
    ${"Asia/Kolkata"}        | ${"2024-06-15T02:30:00Z"}
    ${"Asia/Kathmandu"}      | ${"2024-06-15T02:15:00Z"}
    ${"Asia/Shanghai"}       | ${"2024-06-15T03:00:00Z"}
    ${"Australia/Lord_Howe"} | ${"2024-06-15T02:30:00Z"}
    ${"Pacific/Chatham"}     | ${"2024-06-15T02:15:00Z"}
    ${"Pacific/Apia"}        | ${"2024-06-15T03:00:00Z"}
    ${"Pacific/Niue"}        | ${"2024-06-15T03:00:00Z"}
    ${"America/New_York"}    | ${"2024-06-15T03:00:00Z"}
    ${"America/Chicago"}     | ${"2024-06-15T03:00:00Z"}
    ${"America/Phoenix"}     | ${"2024-06-15T03:00:00Z"}
  `(
    "floors 2024-06-15T03:00:00Z to the local hour in $timeZone as $expected",
    ({ timeZone, expected }) => {
      expect(floorToZone(sourceInstant, "hour", timeZone)).toBe(expected);
    },
  );

  it.each`
    timeZone                 | expected
    ${"UTC"}                 | ${"2024-06-10T00:00:00Z"}
    ${"GMT"}                 | ${"2024-06-10T00:00:00Z"}
    ${"Etc/GMT"}             | ${"2024-06-10T00:00:00Z"}
    ${"America/Nome"}        | ${"2024-06-10T08:00:00Z"}
    ${"Asia/Anadyr"}         | ${"2024-06-09T12:00:00Z"}
    ${"Europe/Lisbon"}       | ${"2024-06-09T23:00:00Z"}
    ${"Europe/Dublin"}       | ${"2024-06-09T23:00:00Z"}
    ${"Europe/Berlin"}       | ${"2024-06-09T22:00:00Z"}
    ${"Europe/Helsinki"}     | ${"2024-06-09T21:00:00Z"}
    ${"Europe/Istanbul"}     | ${"2024-06-09T21:00:00Z"}
    ${"Asia/Kolkata"}        | ${"2024-06-09T18:30:00Z"}
    ${"Asia/Kathmandu"}      | ${"2024-06-09T18:15:00Z"}
    ${"Asia/Shanghai"}       | ${"2024-06-09T16:00:00Z"}
    ${"Australia/Lord_Howe"} | ${"2024-06-09T13:30:00Z"}
    ${"Pacific/Chatham"}     | ${"2024-06-09T11:15:00Z"}
    ${"Pacific/Apia"}        | ${"2024-06-09T11:00:00Z"}
    ${"Pacific/Niue"}        | ${"2024-06-10T11:00:00Z"}
    ${"America/New_York"}    | ${"2024-06-10T04:00:00Z"}
    ${"America/Chicago"}     | ${"2024-06-10T05:00:00Z"}
    ${"America/Phoenix"}     | ${"2024-06-10T07:00:00Z"}
  `(
    "floors 2024-06-15T03:00:00Z to the local Monday-start week in $timeZone as $expected",
    ({ timeZone, expected }) => {
      expect(floorToZone(sourceInstant, "week", timeZone)).toBe(expected);
    },
  );

  it.each`
    timeZone                 | expected
    ${"UTC"}                 | ${"2024-06-01T00:00:00Z"}
    ${"GMT"}                 | ${"2024-06-01T00:00:00Z"}
    ${"Etc/GMT"}             | ${"2024-06-01T00:00:00Z"}
    ${"America/Nome"}        | ${"2024-06-01T08:00:00Z"}
    ${"Asia/Anadyr"}         | ${"2024-05-31T12:00:00Z"}
    ${"Europe/Lisbon"}       | ${"2024-05-31T23:00:00Z"}
    ${"Europe/Dublin"}       | ${"2024-05-31T23:00:00Z"}
    ${"Europe/Berlin"}       | ${"2024-05-31T22:00:00Z"}
    ${"Europe/Helsinki"}     | ${"2024-05-31T21:00:00Z"}
    ${"Europe/Istanbul"}     | ${"2024-05-31T21:00:00Z"}
    ${"Asia/Kolkata"}        | ${"2024-05-31T18:30:00Z"}
    ${"Asia/Kathmandu"}      | ${"2024-05-31T18:15:00Z"}
    ${"Asia/Shanghai"}       | ${"2024-05-31T16:00:00Z"}
    ${"Australia/Lord_Howe"} | ${"2024-05-31T13:30:00Z"}
    ${"Pacific/Chatham"}     | ${"2024-05-31T11:15:00Z"}
    ${"Pacific/Apia"}        | ${"2024-05-31T11:00:00Z"}
    ${"Pacific/Niue"}        | ${"2024-06-01T11:00:00Z"}
    ${"America/New_York"}    | ${"2024-06-01T04:00:00Z"}
    ${"America/Chicago"}     | ${"2024-06-01T05:00:00Z"}
    ${"America/Phoenix"}     | ${"2024-06-01T07:00:00Z"}
  `(
    "floors 2024-06-15T03:00:00Z to the local month in $timeZone as $expected",
    ({ timeZone, expected }) => {
      expect(floorToZone(sourceInstant, "month", timeZone)).toBe(expected);
    },
  );

  it("floors to the local day, not the UTC day, for the same instant", () => {
    expect(floorToZone(sourceInstant, "day", "America/New_York")).toBe(
      "2024-06-14T04:00:00Z",
    );
    expect(floorToZone(sourceInstant, "day", "UTC")).toBe(
      "2024-06-15T00:00:00Z",
    );
  });

  it.each`
    value                                      | expected                  | description
    ${"2024-06-15T03:00:00Z"}                  | ${"2024-06-14T04:00:00Z"} | ${"a UTC instant"}
    ${"2024-06-15T05:00:00+02:00"}             | ${"2024-06-14T04:00:00Z"} | ${"the same instant written with an offset"}
    ${"2024-06-15T12:00:00+09:00[Asia/Tokyo]"} | ${"2024-06-14T04:00:00Z"} | ${"the same instant in another bracketed zone, which the argument overrides"}
    ${"2024-06-15T03:00:00.123456789Z"}        | ${"2024-06-14T04:00:00Z"} | ${"sub-second precision, discarded by the floor"}
  `(
    "floors $value in America/New_York to $expected ($description)",
    ({ value, expected }) => {
      expect(floorToZone(value, "day", "America/New_York")).toBe(expected);
    },
  );

  it.each`
    value                     | unit      | expected                  | description
    ${"2024-03-10T12:00:00Z"} | ${"day"}  | ${"2024-03-10T05:00:00Z"} | ${"the 23-hour spring-forward day, which still starts at local midnight"}
    ${"2024-11-03T12:00:00Z"} | ${"day"}  | ${"2024-11-03T04:00:00Z"} | ${"the 25-hour fall-back day"}
    ${"2024-11-03T05:30:00Z"} | ${"hour"} | ${"2024-11-03T05:00:00Z"} | ${"an hour inside the fall-back overlap, first pass"}
    ${"2024-11-03T06:30:00Z"} | ${"hour"} | ${"2024-11-03T06:00:00Z"} | ${"the same wall hour, second pass, which is a separate bucket"}
  `(
    "floors $value to the $unit in America/New_York as $expected ($description)",
    ({ value, unit, expected }) => {
      expect(floorToZone(value, unit, "America/New_York")).toBe(expected);
    },
  );

  it.each`
    value                     | unit      | timeZone                 | expected                  | description
    ${"2024-09-08T10:00:00Z"} | ${"day"}  | ${"America/Santiago"}    | ${"2024-09-08T04:00:00Z"} | ${"a local day whose midnight is skipped, so it starts at 01:00"}
    ${"2011-12-31T05:00:00Z"} | ${"day"}  | ${"Pacific/Apia"}        | ${"2011-12-30T10:00:00Z"} | ${"the day after Samoa deleted 2011-12-30 crossing the date line"}
    ${"2024-04-06T15:00:00Z"} | ${"hour"} | ${"Australia/Lord_Howe"} | ${"2024-04-06T14:00:00Z"} | ${"a 30-minute fall-back, where local 01:00 labels 90 minutes"}
    ${"2024-10-05T15:45:00Z"} | ${"hour"} | ${"Australia/Lord_Howe"} | ${"2024-10-05T15:30:00Z"} | ${"a 30-minute spring-forward, where local 02:00 begins at 02:30"}
  `(
    "floors $value to the $unit in $timeZone as $expected ($description)",
    ({ value, unit, timeZone, expected }) => {
      expect(floorToZone(value, unit, timeZone)).toBe(expected);
    },
  );

  it.each`
    value                     | timeZone               | expected                  | description
    ${"2025-09-27T14:00:00Z"} | ${"Pacific/Chatham"}   | ${"2025-09-27T14:00:00Z"} | ${"a 02:45 -> 03:45 spring-forward: local 03:00 never happened, so the hour opens at the transition"}
    ${"2025-09-27T14:10:00Z"} | ${"Pacific/Chatham"}   | ${"2025-09-27T14:00:00Z"} | ${"a later instant in that same 15-minute-long hour floors to it too"}
    ${"2025-04-05T14:00:00Z"} | ${"Pacific/Chatham"}   | ${"2025-04-05T14:00:00Z"} | ${"a 03:45 -> 02:45 fall-back: the repeated 02:45 belongs to the pass that began at the transition"}
    ${"2025-04-05T13:00:00Z"} | ${"Pacific/Chatham"}   | ${"2025-04-05T12:15:00Z"} | ${"the first pass of the same wall hour, an hour and three quarters earlier"}
    ${"2025-04-05T14:15:00Z"} | ${"Pacific/Chatham"}   | ${"2025-04-05T14:15:00Z"} | ${"the hour after the fall-back, in the new offset"}
    ${"2020-10-03T16:01:00Z"} | ${"Antarctica/Casey"}  | ${"2020-10-03T16:01:00Z"} | ${"a three-hour jump, whose landing hour opens at the transition"}
    ${"1995-04-02T04:00:30Z"} | ${"America/Goose_Bay"} | ${"1995-04-02T04:00:00Z"} | ${"a DST change at 00:01 local, leaving a local hour only 60 seconds long"}
    ${"1995-04-02T04:01:00Z"} | ${"America/Goose_Bay"} | ${"1995-04-02T04:01:00Z"} | ${"the hour that opens the moment that one ends"}
  `(
    "floors $value to the hour in $timeZone as $expected ($description)",
    ({ value, timeZone, expected }) => {
      expect(floorToZone(value, "hour", timeZone)).toBe(expected);
    },
  );

  it.each`
    value                     | timeZone              | unit      | description
    ${"2025-09-27T14:00:00Z"} | ${"Pacific/Chatham"}  | ${"hour"} | ${"a sub-hour spring-forward"}
    ${"2025-09-27T14:10:00Z"} | ${"Pacific/Chatham"}  | ${"hour"} | ${"inside the hour it opens"}
    ${"2020-10-03T16:01:00Z"} | ${"Antarctica/Casey"} | ${"hour"} | ${"a three-hour jump"}
    ${"2025-04-05T14:00:00Z"} | ${"Pacific/Chatham"}  | ${"hour"} | ${"a sub-hour fall-back"}
  `(
    "never floors $value forward in $timeZone ($description)",
    ({ value, timeZone, unit }) => {
      expect(floorToZone(value, unit, timeZone) <= value).toBe(true);
    },
  );

  it.each(battleTestTimeZones.map((timeZone) => ({ timeZone })))(
    "is idempotent in $timeZone — flooring an already-floored instant changes nothing",
    ({ timeZone }) => {
      for (const unit of ["hour", "day", "week", "month"] as const) {
        const once = floorToZone(sourceInstant, unit, timeZone);
        expect(floorToZone(once, unit, timeZone)).toBe(once);
      }
    },
  );

  it.each(battleTestTimeZones.map((timeZone) => ({ timeZone })))(
    "never floors past the source instant in $timeZone",
    ({ timeZone }) => {
      for (const unit of ["hour", "day", "week", "month"] as const) {
        expect(
          floorToZone(sourceInstant, unit, timeZone) <= sourceInstant,
        ).toBe(true);
      }
    },
  );

  it.each`
    unit         | description
    ${"minute"}  | ${"a unit below hour, which needs no zone"}
    ${"second"}  | ${"the same"}
    ${"year"}    | ${"a unit above month, which getQuarter and getFiscalPeriod answer"}
    ${"quarter"} | ${"not a Temporal unit at all"}
    ${"days"}    | ${"a plural spelling"}
    ${"Day"}     | ${"a capitalised spelling"}
    ${""}        | ${"an empty string"}
    ${undefined} | ${"absent"}
    ${null}      | ${"null"}
    ${1}         | ${"a number"}
  `("returns an empty string when unit is $unit ($description)", ({ unit }) => {
    expect(floorToZone(sourceInstant, unit as "day", "America/New_York")).toBe(
      "",
    );
  });

  it.each`
    timeZone              | description
    ${"Invalid/Zone"}     | ${"an unknown identifier"}
    ${"America/New York"} | ${"a space where an underscore belongs"}
    ${""}                 | ${"an empty string"}
    ${undefined}          | ${"absent"}
    ${null}               | ${"null"}
    ${123}                | ${"a number"}
  `(
    "returns an empty string when timeZone is $timeZone ($description)",
    ({ timeZone }) => {
      expect(floorToZone(sourceInstant, "day", timeZone as string)).toBe("");
    },
  );

  it.each`
    value                                  | description
    ${"2024-06-15T03:00:00"}               | ${"a zoneless datetime, which names no instant"}
    ${"2024-06-15"}                        | ${"a date"}
    ${"invalid"}                           | ${"an unparseable string"}
    ${""}                                  | ${"an empty string"}
    ${"2016-12-31T23:59:60Z"}              | ${"a leap second"}
    ${"2024-02-30T00:00:00Z"}              | ${"a date that does not exist"}
    ${"2024-06-15T03:00:00Z[u-ca=hebrew]"} | ${"a calendar annotation"}
  `("returns an empty string when $value is $description", ({ value }) => {
    expect(floorToZone(value, "day", "America/New_York")).toBe("");
  });

  it.each`
    value
    ${null}
    ${undefined}
    ${123}
    ${true}
    ${[]}
    ${{}}
  `("returns an empty string when $value is non-string input", ({ value }) => {
    expect(
      floorToZone(value as unknown as string, "day", "America/New_York"),
    ).toBe("");
  });

  it.each`
    value                        | unit       | expected                     | description
    ${"+275760-09-13T00:00:00Z"} | ${"day"}   | ${"+275760-09-13T00:00:00Z"} | ${"the last instant of the range, which is itself a local midnight"}
    ${"+275760-09-13T00:00:00Z"} | ${"month"} | ${"+275760-09-01T00:00:00Z"} | ${"the month holding it, which began well inside the range"}
    ${"-271821-04-20T00:00:00Z"} | ${"day"}   | ${"-271821-04-20T00:00:00Z"} | ${"the first instant of the range, which is already a boundary"}
    ${"-271821-04-21T01:00:00Z"} | ${"day"}   | ${"-271821-04-21T00:00:00Z"} | ${"a day into it"}
    ${"-271821-04-20T00:00:00Z"} | ${"week"}  | ${""}                        | ${"the week holding the first instant began before the range does"}
    ${"-271821-04-20T00:00:00Z"} | ${"month"} | ${""}                        | ${"and so did the month"}
  `(
    "floors $value to the $unit in UTC as $expected ($description)",
    ({ value, unit, expected }) => {
      expect(floorToZone(value, unit, "UTC")).toBe(expected);
    },
  );

  it("returns an empty string when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();
    expect(floorToZone(sourceInstant, "day", "America/New_York")).toBe("");
  });
});
