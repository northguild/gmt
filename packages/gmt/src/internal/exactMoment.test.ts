import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones } from "../test";
import {
  mockTemporalInstantFromEpochNanosecondsThrow,
  mockTemporalInstantFromThrow,
  mockTemporalZonedDateTimeFromThrow,
} from "../test/mocks";
import { readExactMoment, writeExactMoment } from "./exactMoment";

/** Epoch nanoseconds of a `Z` instant: the independent reading every row is checked against. */
const ns = (utc: string): bigint => Temporal.Instant.from(utc).epochNanoseconds;

describe("readExactMoment", () => {
  // The wall clock minus its offset is the UTC instant: 10:00 at -04:00 is 14:00Z, 10:00 at
  // +05:30:15 is 04:29:45Z.
  it.each`
    value                                               | utc                          | notation
    ${"2024-06-15T10:00:00-04:00[America/New_York]"}    | ${"2024-06-15T14:00:00Z"}    | ${{ kind: "zone", timeZone: "America/New_York" }}
    ${"2024-06-15T10:00:00Z[UTC]"}                      | ${"2024-06-15T10:00:00Z"}    | ${{ kind: "zone", timeZone: "UTC" }}
    ${"2024-06-15T10:00:00Z[!UTC]"}                     | ${"2024-06-15T10:00:00Z"}    | ${{ kind: "zone", timeZone: "UTC" }}
    ${"2024-06-15T10:00:00[America/New_York]"}          | ${"2024-06-15T14:00:00Z"}    | ${{ kind: "zone", timeZone: "America/New_York" }}
    ${"2024-06-15T10:00:00Z"}                           | ${"2024-06-15T10:00:00Z"}    | ${{ kind: "utc" }}
    ${"2024-06-15T10:00:00Z[foo=bar]"}                  | ${"2024-06-15T10:00:00Z"}    | ${{ kind: "utc" }}
    ${"2024-06-15T10:00:00+09:00"}                      | ${"2024-06-15T01:00:00Z"}    | ${{ kind: "offset", offset: "+09:00" }}
    ${"2024-06-15T10:00:00+05:30:15"}                   | ${"2024-06-15T04:29:45Z"}    | ${{ kind: "offset", offset: "+05:30:15" }}
    ${"2024-06-15T10:00:00+05:30:00,5"}                 | ${"2024-06-15T04:29:59.5Z"}  | ${{ kind: "offset", offset: "+05:30:00,5" }}
    ${"2024-06-15T10:00:00-00:00"}                      | ${"2024-06-15T10:00:00Z"}    | ${{ kind: "offset", offset: "-00:00" }}
    ${"2024-06-15T10:00:00+09:00[u-ca=gregory]"}        | ${"2024-06-15T01:00:00Z"}    | ${{ kind: "offset", offset: "+09:00" }}
    ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"} | ${"+275760-09-13T00:00:00Z"} | ${{ kind: "zone", timeZone: "Australia/Sydney" }}
    ${"-271821-04-19T19:00:00-05:00"}                   | ${"-271821-04-20T00:00:00Z"} | ${{ kind: "offset", offset: "-05:00" }}
    ${"2024-11-03T01:30:00[America/New_York]"}          | ${"2024-11-03T05:30:00Z"}    | ${{ kind: "zone", timeZone: "America/New_York" }}
    ${"1883-11-18T10:00:00-04:56:02[America/New_York]"} | ${"1883-11-18T14:56:02Z"}    | ${{ kind: "zone", timeZone: "America/New_York" }}
    ${"1883-11-18T10:00:00-04:56[America/New_York]"}    | ${"1883-11-18T14:56:02Z"}    | ${{ kind: "zone", timeZone: "America/New_York" }}
  `(
    "reads $value as $utc written $notation.kind",
    ({ value, utc, notation }) => {
      expect(readExactMoment(value)).toEqual({
        nanoseconds: ns(utc),
        notation,
      });
    },
  );

  it.each`
    value                                            | why
    ${"2024-06-15T10:00:00Z[Not/AZone]"}             | ${"a named zone that does not exist"}
    ${"2024-06-15T10:00:00-05:00[America/New_York]"} | ${"an offset that contradicts its zone (New York is -04:00 in June)"}
    ${"2024-06-15T10:00:00Z[UTC][u-ca=gregory]"}     | ${"a zoned string whose calendar is not ISO"}
    ${"2024-06-15T10:00:00"}                         | ${"no zone and no offset"}
    ${"2024-06-15T10:00:00Z[!foo=bar]"}              | ${"a critical unknown annotation"}
    ${"2016-12-31T23:59:60Z"}                        | ${"a leap second"}
    ${"2024-06-15 10:00:00Z"}                        | ${"a space separator"}
    ${"-271821-04-19T23:59:59.999999999Z"}           | ${"one nanosecond before the instant range"}
    ${""}                                            | ${"empty"}
  `("returns null for $value ($why)", ({ value }) => {
    expect(readExactMoment(value)).toBeNull();
  });

  it.each`
    value
    ${null}
    ${undefined}
    ${1718445600}
    ${{}}
    ${Symbol("x")}
  `("returns null for the non-string $value", ({ value }) => {
    expect(readExactMoment(value)).toBeNull();
  });

  it("returns null when the instant parse throws", () => {
    mockTemporalInstantFromThrow();
    expect(readExactMoment("2024-06-15T10:00:00Z")).toBeNull();
  });

  it("returns null when the zoned parse throws", () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(
      readExactMoment("2024-06-15T10:00:00-04:00[America/New_York]"),
    ).toBeNull();
  });
});

describe("writeExactMoment", () => {
  // 11:00Z is 07:00 in New York (EDT, -04:00), 20:00 at +09:00 and 16:30:15 at +05:30:15.
  it.each`
    utc                          | notation                                          | expected
    ${"2024-06-15T11:00:00Z"}    | ${{ kind: "zone", timeZone: "America/New_York" }} | ${"2024-06-15T07:00:00-04:00[America/New_York]"}
    ${"2024-06-15T11:00:00Z"}    | ${{ kind: "zone", timeZone: "UTC" }}              | ${"2024-06-15T11:00:00+00:00[UTC]"}
    ${"2024-06-15T11:00:00Z"}    | ${{ kind: "utc" }}                                | ${"2024-06-15T11:00:00Z"}
    ${"2024-06-15T11:00:00.5Z"}  | ${{ kind: "utc" }}                                | ${"2024-06-15T11:00:00.5Z"}
    ${"2024-06-15T11:00:00Z"}    | ${{ kind: "offset", offset: "+09:00" }}           | ${"2024-06-15T20:00:00+09:00"}
    ${"2024-06-15T11:00:00Z"}    | ${{ kind: "offset", offset: "+05:30:15" }}        | ${"2024-06-15T16:30:15+05:30:15"}
    ${"2024-06-15T11:00:00Z"}    | ${{ kind: "offset", offset: "+05:30:00,5" }}      | ${"2024-06-15T16:30:00.5+05:30:00,5"}
    ${"2024-06-15T11:00:00Z"}    | ${{ kind: "offset", offset: "-00:00" }}           | ${"2024-06-15T11:00:00-00:00"}
    ${"+275760-09-13T00:00:00Z"} | ${{ kind: "zone", timeZone: "Australia/Sydney" }} | ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"}
    ${"+275760-09-13T00:00:00Z"} | ${{ kind: "offset", offset: "+14:00" }}           | ${"+275760-09-13T14:00:00+14:00"}
    ${"-271821-04-20T00:00:00Z"} | ${{ kind: "offset", offset: "-05:00" }}           | ${"-271821-04-19T19:00:00-05:00"}
    ${"1883-11-18T14:56:02Z"}    | ${{ kind: "zone", timeZone: "America/New_York" }} | ${"1883-11-18T10:00:00-04:56[America/New_York]"}
  `(
    "writes $utc as $expected in $notation.kind notation",
    ({ utc, notation, expected }) => {
      expect(writeExactMoment(ns(utc), notation)).toBe(expected);
    },
  );

  it.each(battleTestTimeZones)(
    "writes a zone notation the way Temporal writes the zone (%s)",
    (timeZone) => {
      const instant = Temporal.Instant.from("2024-02-29T12:00:00Z");
      expect(
        writeExactMoment(instant.epochNanoseconds, { kind: "zone", timeZone }),
      ).toBe(instant.toZonedDateTimeISO(timeZone).toString());
    },
  );

  // The instant range is ±8.64e21 ns (TC39 Temporal nsMinInstant/nsMaxInstant).
  it.each`
    nanoseconds                        | notation
    ${8_640_000_000_000_000_000_001n}  | ${{ kind: "utc" }}
    ${-8_640_000_000_000_000_000_001n} | ${{ kind: "offset", offset: "+09:00" }}
    ${8_640_000_000_000_000_000_001n}  | ${{ kind: "zone", timeZone: "UTC" }}
  `(
    "returns an empty string for $nanoseconds ns, outside the instant range ($notation.kind)",
    ({ nanoseconds, notation }) => {
      expect(writeExactMoment(nanoseconds, notation)).toBe("");
    },
  );

  it("returns an empty string for a zone that does not exist", () => {
    expect(writeExactMoment(0n, { kind: "zone", timeZone: "Not/AZone" })).toBe(
      "",
    );
  });

  it("returns an empty string when the epoch-nanosecond constructor throws", () => {
    mockTemporalInstantFromEpochNanosecondsThrow();
    expect(writeExactMoment(0n, { kind: "utc" })).toBe("");
  });
});
