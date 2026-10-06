import { battleTestTimeZones, type MustTestDstTimeZones } from "../../test";
import { mockTemporalInstantFromEpochNanosecondsThrow } from "../../test/mocks";
import { hostileProxy, revokedProxy } from "../../test/noThrow";
import { bolTimestamp } from "./bolTimestamp";

/** A loading at 21:00 EDT on 15 June 2024: 01:00Z on the 16th, so the UTC date is a day late. */
const newYorkEvening = "2024-06-16T01:00:00Z";

/**
 * The local date of 12:00Z on 15 June 2024 in each battle-test zone. Derived from each zone's
 * June offset: a zone at +12:00 or more is already on the 16th (Anadyr exactly at its midnight,
 * Chatham at 00:45, Apia at 01:00); every other zone, Niue's 01:00 included, is still on the 15th.
 * Each checked against plain `Temporal.Instant#toZonedDateTimeISO`.
 */
const noonUtcDateByZone = {
  UTC: "2024-06-15",
  GMT: "2024-06-15",
  "Etc/GMT": "2024-06-15",
  "America/Nome": "2024-06-15",
  "Asia/Anadyr": "2024-06-16",
  "Europe/Lisbon": "2024-06-15",
  "Europe/Dublin": "2024-06-15",
  "Europe/Berlin": "2024-06-15",
  "Europe/Helsinki": "2024-06-15",
  "Europe/Istanbul": "2024-06-15",
  "Asia/Kolkata": "2024-06-15",
  "Asia/Kathmandu": "2024-06-15",
  "Asia/Shanghai": "2024-06-15",
  "Australia/Lord_Howe": "2024-06-15",
  "Pacific/Chatham": "2024-06-16",
  "Pacific/Apia": "2024-06-16",
  "Pacific/Niue": "2024-06-15",
  "America/New_York": "2024-06-15",
  "America/Chicago": "2024-06-15",
  "America/Phoenix": "2024-06-15",
} satisfies Record<keyof typeof MustTestDstTimeZones, string>;

describe("bolTimestamp", () => {
  it("dates a 21:00 local loading on the local date, not the UTC date", () => {
    expect(
      bolTimestamp(newYorkEvening, "shippedOnBoard", {
        timeZone: "America/New_York",
      }),
    ).toBe("2024-06-15");
  });

  // The UTC date is wrong in both directions: a day late west of Greenwich in the evening, a day
  // early east of it in the morning. 07:00 in Shanghai is 23:00Z the day before.
  it.each`
    value                     | timeZone              | expected        | utcDate         | reads
    ${"2024-06-16T01:00:00Z"} | ${"America/New_York"} | ${"2024-06-15"} | ${"2024-06-16"} | ${"21:00 EDT"}
    ${"2024-06-14T23:00:00Z"} | ${"Asia/Shanghai"}    | ${"2024-06-15"} | ${"2024-06-14"} | ${"07:00 CST"}
    ${"2024-06-15T13:00:00Z"} | ${"Asia/Shanghai"}    | ${"2024-06-15"} | ${"2024-06-15"} | ${"21:00 CST, the same date as UTC"}
  `(
    "dates $value in $timeZone ($reads) as $expected, where the UTC date is $utcDate",
    ({ value, timeZone, expected }) => {
      expect(bolTimestamp(value, "shippedOnBoard", { timeZone })).toBe(
        expected,
      );
    },
  );

  it.each(
    battleTestTimeZones.map((timeZone) => ({
      timeZone,
      expected: noonUtcDateByZone[timeZone],
    })),
  )(
    "dates 12:00Z on 15 June as $expected in $timeZone",
    ({ timeZone, expected }) => {
      expect(
        bolTimestamp("2024-06-15T12:00:00Z", "shippedOnBoard", { timeZone }),
      ).toBe(expected);
    },
  );

  it.each(battleTestTimeZones)(
    "returns a date with no time component in %s",
    (timeZone) => {
      expect(
        bolTimestamp("2024-06-15T12:00:00Z", "shippedOnBoard", { timeZone }),
      ).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    },
  );

  // DCSA eBL 3.0 types every B/L date as a local date, so the event names the record the date is
  // for and never changes the rendering.
  it.each`
    event
    ${"issue"}
    ${"received"}
    ${"shippedOnBoard"}
  `("dates the 21:00 EDT event as 2024-06-15 for event $event", ({ event }) => {
    expect(
      bolTimestamp(newYorkEvening, event, { timeZone: "America/New_York" }),
    ).toBe("2024-06-15");
  });

  // Only the instant is read: a bracketed zone in the value is not the zone the date is read in.
  it.each`
    value                                            | form
    ${"2024-06-16T01:00:00Z"}                        | ${"Z"}
    ${"2024-06-15T21:00:00-04:00"}                   | ${"an offset"}
    ${"2024-06-16T10:00:00+09:00"}                   | ${"another zone's offset"}
    ${"2024-06-15T21:00:00-04:00[America/New_York]"} | ${"a zoned string in the same zone"}
    ${"2024-06-16T09:00:00+08:00[Asia/Shanghai]"}    | ${"a zoned string in another zone"}
    ${"2024-06-16T01:00:00Z[u-ca=hebrew]"}           | ${"a calendar annotation: an instant has none"}
    ${"2024-06-16T01:00:00.000000000Z"}              | ${"nanosecond digits"}
  `(
    "reads $value ($form) as its instant and dates it in America/New_York",
    ({ value }) => {
      expect(
        bolTimestamp(value, "shippedOnBoard", { timeZone: "America/New_York" }),
      ).toBe("2024-06-15");
    },
  );

  // The date is the one the local clock shows, so it changes exactly at local midnight, and on the
  // days a zone skipped or re-entered a date it follows the clock.
  it.each`
    value                               | timeZone                 | expected        | reads
    ${"2024-06-15T03:59:59.999999999Z"} | ${"America/New_York"}    | ${"2024-06-14"} | ${"one nanosecond before local midnight"}
    ${"2024-06-15T04:00:00Z"}           | ${"America/New_York"}    | ${"2024-06-15"} | ${"exactly local midnight"}
    ${"2024-11-03T05:30:00Z"}           | ${"America/New_York"}    | ${"2024-11-03"} | ${"the first 01:30 of the fall-back"}
    ${"2024-11-03T06:30:00Z"}           | ${"America/New_York"}    | ${"2024-11-03"} | ${"the second 01:30 of the fall-back"}
    ${"2024-09-08T03:59:59.999999999Z"} | ${"America/Santiago"}    | ${"2024-09-07"} | ${"the last instant before Santiago skipped midnight"}
    ${"2024-09-08T04:00:00Z"}           | ${"America/Santiago"}    | ${"2024-09-08"} | ${"01:00, the first local time of 8 September"}
    ${"2011-12-30T09:59:59.999999999Z"} | ${"Pacific/Apia"}        | ${"2011-12-29"} | ${"the last instant before Samoa deleted 30 December"}
    ${"2011-12-30T10:00:00Z"}           | ${"Pacific/Apia"}        | ${"2011-12-31"} | ${"the next instant is 31 December"}
    ${"2010-11-07T03:00:59Z"}           | ${"America/Goose_Bay"}   | ${"2010-11-07"} | ${"00:00:59 on the 7th, before the fall-back"}
    ${"2010-11-07T03:01:00Z"}           | ${"America/Goose_Bay"}   | ${"2010-11-06"} | ${"23:01 on the 6th again, after it"}
    ${"2024-09-28T14:00:00Z"}           | ${"Pacific/Chatham"}     | ${"2024-09-29"} | ${"03:45, the first instant after Chatham's spring-forward"}
    ${"2020-10-03T15:59:59Z"}           | ${"Antarctica/Casey"}    | ${"2020-10-03"} | ${"23:59:59 on the 3rd"}
    ${"2020-10-03T16:01:00Z"}           | ${"Antarctica/Casey"}    | ${"2020-10-04"} | ${"03:01, after Casey's three-hour jump"}
    ${"2024-04-06T13:00:00Z"}           | ${"Australia/Lord_Howe"} | ${"2024-04-07"} | ${"00:00 Lord Howe time"}
  `(
    "dates $value in $timeZone as $expected ($reads)",
    ({ value, timeZone, expected }) => {
      expect(bolTimestamp(value, "received", { timeZone })).toBe(expected);
    },
  );

  it.each`
    timeZone    | expected        | reads
    ${"+08:00"} | ${"2024-06-16"} | ${"00:00 at +08:00"}
    ${"-04:00"} | ${"2024-06-15"} | ${"12:00 at -04:00"}
    ${"+00:00"} | ${"2024-06-15"} | ${"16:00 at +00:00"}
  `(
    "dates 16:00Z in the fixed offset $timeZone as $expected ($reads)",
    ({ timeZone, expected }) => {
      expect(bolTimestamp("2024-06-15T16:00:00Z", "issue", { timeZone })).toBe(
        expected,
      );
    },
  );

  // Temporal writes a date outside years 0000–9999 with a sign and six digits.
  it.each`
    value                        | timeZone              | expected
    ${"-271821-04-20T00:00:00Z"} | ${"UTC"}              | ${"-271821-04-20"}
    ${"-271821-04-20T00:00:00Z"} | ${"America/New_York"} | ${"-271821-04-19"}
    ${"+275760-09-13T00:00:00Z"} | ${"Asia/Tokyo"}       | ${"+275760-09-13"}
    ${"+275760-09-13T00:00:00Z"} | ${"Pacific/Niue"}     | ${"+275760-09-12"}
  `(
    "dates the range limit $value in $timeZone as $expected",
    ({ value, timeZone, expected }) => {
      expect(bolTimestamp(value, "received", { timeZone })).toBe(expected);
    },
  );

  it.each`
    options                    | reads
    ${undefined}               | ${"no options"}
    ${{}}                      | ${"an empty options object"}
    ${{ timeZone: undefined }} | ${"an explicit undefined timeZone"}
  `(
    "returns the sentinel without a timeZone ($reads): every B/L date is local",
    ({ options }) => {
      expect(bolTimestamp(newYorkEvening, "issue", options)).toBe("");
    },
  );

  // An offset that disagrees with its bracket is read as written, as every instant reader reads
  // it: 21:00-05:00 is 02:00Z on the 16th, 22:00 EDT on the 15th.
  it("reads an offset that disagrees with its bracketed zone as written", () => {
    expect(
      bolTimestamp("2024-06-15T21:00:00-05:00[America/New_York]", "issue", {
        timeZone: "America/New_York",
      }),
    ).toBe("2024-06-15");
  });

  it.each`
    value                                      | reads
    ${"2024-06-15T21:00:00"}                   | ${"a zoneless wall time: not a moment"}
    ${"2024-06-15"}                            | ${"a date: not a moment"}
    ${"2024-06-15T21:00:00[America/New_York]"} | ${"a bracket without an offset: not an instant"}
    ${"2024-02-30T12:00:00Z"}                  | ${"a day that does not exist"}
    ${"2024-06-15T21:00:00Z[!foo=bar]"}        | ${"a critical unknown annotation"}
    ${"2016-12-31T23:59:60Z"}                  | ${"a leap second, which Temporal does not represent"}
    ${"not a date"}                            | ${"garbage"}
    ${""}                                      | ${"an empty string"}
  `("returns the sentinel for $value ($reads)", ({ value }) => {
    expect(
      bolTimestamp(value, "shippedOnBoard", { timeZone: "America/New_York" }),
    ).toBe("");
  });

  it.each`
    event                    | reads
    ${"shipped"}             | ${"an unknown event"}
    ${"ShippedOnBoard"}      | ${"a different case"}
    ${"receivedForShipment"} | ${"a DCSA field name, not an event"}
    ${"onBoard"}             | ${"an on-board notation, which has no DCSA date field"}
    ${""}                    | ${"an empty string"}
    ${undefined}             | ${"undefined"}
    ${null}                  | ${"null"}
    ${1}                     | ${"a number"}
  `("returns the sentinel for event $event ($reads)", ({ event }) => {
    expect(
      bolTimestamp(newYorkEvening, event, { timeZone: "America/New_York" }),
    ).toBe("");
  });

  it.each`
    timeZone             | reads
    ${"America/Nowhere"} | ${"a zone that does not exist"}
    ${"EST5EDT "}        | ${"trailing space"}
    ${""}                | ${"an empty string"}
    ${"local"}           | ${"the system zone, which GMT does not read"}
    ${null}              | ${"null"}
    ${-4}                | ${"a number"}
  `("returns the sentinel for timeZone $timeZone ($reads)", ({ timeZone }) => {
    expect(bolTimestamp(newYorkEvening, "issue", { timeZone })).toBe("");
  });

  it.each`
    make                        | kind
    ${() => null}               | ${"null"}
    ${() => "America/New_York"} | ${"a string"}
    ${() => 0}                  | ${"a number"}
    ${() => hostileProxy()}     | ${"a Proxy that throws on any trap"}
    ${() => revokedProxy()}     | ${"a revoked Proxy"}
  `("returns the sentinel for options that are $kind", ({ make }) => {
    expect(bolTimestamp(newYorkEvening, "issue", make() as never)).toBe("");
  });

  // A non-string value collapses to one path; a number is the epoch-milliseconds a caller might
  // pass by mistake.
  it.each`
    value            | kind
    ${null}          | ${"null"}
    ${undefined}     | ${"undefined"}
    ${1718499600000} | ${"a number"}
    ${{}}            | ${"an object"}
  `("returns the sentinel for a value that is $kind", ({ value }) => {
    expect(
      bolTimestamp(value as never, "issue", { timeZone: "America/New_York" }),
    ).toBe("");
  });

  it("returns the sentinel when the instant cannot be built", () => {
    mockTemporalInstantFromEpochNanosecondsThrow();
    expect(
      bolTimestamp(newYorkEvening, "issue", { timeZone: "America/New_York" }),
    ).toBe("");
  });
});
