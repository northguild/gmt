import { Temporal } from "@js-temporal/polyfill";
import type { TimestampEvent } from "../../types";
import { battleTestTimeZones } from "../../test";
import { hostileProxy, revokedProxy } from "../../test/noThrow";
import {
  mockTemporalDurationFromThrow,
  mockTemporalInstantFromThrow,
} from "../../test/mocks";
import { estimateDrift } from "./estimateDrift";

/** A timestamp record: its class, the arrival it names, and when that was recorded. */
const event = (
  classifier: string,
  at: string,
  recordedAt: string,
): TimestampEvent => ({ classifier, at, recordedAt }) as TimestampEvent;

/** Three EST revisions of a vessel's arrival on 20 June 2024, from `first` through 12:00 to `last`. */
const revisions = (first: string, last: string) => [
  event("EST", first, "2024-06-01T00:00:00Z"),
  event("EST", "2024-06-20T12:00:00Z", "2024-06-05T00:00:00Z"),
  event("EST", last, "2024-06-10T00:00:00Z"),
];

describe("estimateDrift", () => {
  // drift = last EST's at − first EST's at, hours as the largest unit, by recordedAt order.
  it("reports three revisions and the first-to-last difference, with exceedsTolerance null without a tolerance", () => {
    expect(
      estimateDrift(revisions("2024-06-20T08:00:00Z", "2024-06-20T17:00:00Z")),
    ).toEqual({
      first: "2024-06-20T08:00:00Z",
      last: "2024-06-20T17:00:00Z",
      drift: "PT9H",
      revisions: 3,
      exceedsTolerance: null,
    });
  });

  // |drift| > tolerance, strictly. 08:00 → 17:00 is 9 hours, 08:00 → 15:00 is 7 hours.
  it.each`
    first                     | last                                | tolerance | drift                 | exceedsTolerance | why
    ${"2024-06-20T08:00:00Z"} | ${"2024-06-20T17:00:00Z"}           | ${"PT8H"} | ${"PT9H"}             | ${true}          | ${"a nine-hour move later"}
    ${"2024-06-20T17:00:00Z"} | ${"2024-06-20T08:00:00Z"}           | ${"PT8H"} | ${"-PT9H"}            | ${true}          | ${"a nine-hour move earlier"}
    ${"2024-06-20T08:00:00Z"} | ${"2024-06-20T15:00:00Z"}           | ${"PT8H"} | ${"PT7H"}             | ${false}         | ${"a seven-hour move later"}
    ${"2024-06-20T15:00:00Z"} | ${"2024-06-20T08:00:00Z"}           | ${"PT8H"} | ${"-PT7H"}            | ${false}         | ${"a seven-hour move earlier"}
    ${"2024-06-20T08:00:00Z"} | ${"2024-06-20T16:00:00Z"}           | ${"PT8H"} | ${"PT8H"}             | ${false}         | ${"exactly the tolerance does not exceed it"}
    ${"2024-06-20T16:00:00Z"} | ${"2024-06-20T08:00:00Z"}           | ${"PT8H"} | ${"-PT8H"}            | ${false}         | ${"exactly the tolerance, earlier"}
    ${"2024-06-20T08:00:00Z"} | ${"2024-06-20T16:00:00.000000001Z"} | ${"PT8H"} | ${"PT8H0.000000001S"} | ${true}          | ${"one nanosecond past the tolerance exceeds it"}
    ${"2024-06-20T08:00:00Z"} | ${"2024-06-20T08:00:00Z"}           | ${"PT0S"} | ${"PT0S"}             | ${false}         | ${"no net move against a zero tolerance"}
    ${"2024-06-20T08:00:00Z"} | ${"2024-06-20T08:00:00.000000001Z"} | ${"PT0S"} | ${"PT0.000000001S"}   | ${true}          | ${"one nanosecond exceeds a zero tolerance"}
    ${"2024-06-20T08:00:00Z"} | ${"2024-06-21T09:00:00Z"}           | ${"P1D"}  | ${"PT25H"}            | ${true}          | ${"day-based: a day is 24 hours"}
    ${"2024-06-20T08:00:00Z"} | ${"2024-06-21T07:00:00Z"}           | ${"P1D"}  | ${"PT23H"}            | ${false}         | ${"day-based: 23 hours is inside"}
  `(
    "reports drift $drift and exceedsTolerance $exceedsTolerance under $tolerance for $why",
    ({ first, last, tolerance, drift, exceedsTolerance }) => {
      expect(estimateDrift(revisions(first, last), { tolerance })).toEqual({
        first,
        last,
        drift,
        revisions: 3,
        exceedsTolerance,
      });
    },
  );

  it.each`
    options                     | why
    ${{}}                       | ${"an empty options bag"}
    ${{ tolerance: undefined }} | ${"tolerance: undefined is absent"}
    ${[]}                       | ${"an array options bag, which has no tolerance"}
  `("reports exceedsTolerance null for $why", ({ options }) => {
    expect(
      estimateDrift(
        revisions("2024-06-20T08:00:00Z", "2024-06-20T17:00:00Z"),
        options,
      )?.exceedsTolerance,
    ).toBeNull();
  });

  it("reads only EST records, ordered by recordedAt, and ignores the others", () => {
    // Recorded 05-01 (PLN), 06-02 (EST 10:00), 06-03 (REQ), 06-04 (EST 13:30), 06-21 (ACT):
    // the ESTs are two revisions from 10:00 to 13:30, given here out of order.
    expect(
      estimateDrift([
        event("ACT", "2024-06-20T14:00:00Z", "2024-06-21T00:00:00Z"),
        event("EST", "2024-06-20T13:30:00Z", "2024-06-04T00:00:00Z"),
        event("PLN", "2024-06-20T08:00:00Z", "2024-05-01T00:00:00Z"),
        event("REQ", "2024-06-20T09:00:00Z", "2024-06-03T00:00:00Z"),
        event("EST", "2024-06-20T10:00:00Z", "2024-06-02T00:00:00Z"),
      ]),
    ).toEqual({
      first: "2024-06-20T10:00:00Z",
      last: "2024-06-20T13:30:00Z",
      drift: "PT3H30M",
      revisions: 2,
      exceedsTolerance: null,
    });
  });

  it("orders two ESTs recorded at the same instant by array index, the later last", () => {
    // 12:00+02:00 and 10:00Z are the same recording instant.
    expect(
      estimateDrift([
        event("EST", "2024-06-20T09:00:00Z", "2024-06-05T12:00:00+02:00"),
        event("EST", "2024-06-20T08:00:00Z", "2024-06-05T10:00:00Z"),
      ]),
    ).toMatchObject({
      first: "2024-06-20T09:00:00Z",
      last: "2024-06-20T08:00:00Z",
      drift: "-PT1H",
    });
  });

  it("echoes first and last as written, compared as instants", () => {
    // 10:00+02:00 is 08:00Z; 19:00 in Tokyo (+09:00) is 10:00Z: two hours of drift.
    expect(
      estimateDrift([
        event(
          "EST",
          "2024-06-20T10:00:00+02:00[Europe/Amsterdam]",
          "2024-06-01T00:00:00Z",
        ),
        event("EST", "2024-06-20T19:00:00+09:00", "2024-06-02T00:00:00Z"),
      ]),
    ).toEqual({
      first: "2024-06-20T10:00:00+02:00[Europe/Amsterdam]",
      last: "2024-06-20T19:00:00+09:00",
      drift: "PT2H",
      revisions: 2,
      exceedsTolerance: null,
    });
  });

  // New York fell back at 02:00 EDT on 3 November 2024 and sprang forward at 02:00 EST on
  // 10 March 2024. 01:30 EDT to 01:30 EST reads 0 on the wall clock and 01:30 EST to 03:30 EDT
  // reads 2 hours; both are one elapsed hour, so each tolerance gives the opposite answer to the
  // wall-clock reading.
  it.each`
    first                                            | last                                             | tolerance  | exceedsTolerance | transition
    ${"2024-11-03T01:30:00-04:00[America/New_York]"} | ${"2024-11-03T01:30:00-05:00[America/New_York]"} | ${"PT30M"} | ${true}          | ${"fall-back"}
    ${"2024-03-10T01:30:00-05:00[America/New_York]"} | ${"2024-03-10T03:30:00-04:00[America/New_York]"} | ${"PT90M"} | ${false}         | ${"spring-forward"}
  `(
    "measures drift across the $transition as exact elapsed time",
    ({ first, last, tolerance, exceedsTolerance }) => {
      expect(
        estimateDrift(
          [
            event("EST", first, "2024-10-01T00:00:00Z"),
            event("EST", last, "2024-10-02T00:00:00Z"),
          ],
          { tolerance },
        ),
      ).toEqual({
        first,
        last,
        drift: "PT1H",
        revisions: 2,
        exceedsTolerance,
      });
    },
  );

  it.each(battleTestTimeZones)(
    "measures the same drift whatever zone the estimates are written in (%s)",
    (timeZone) => {
      const local = (utc: string) =>
        Temporal.Instant.from(utc).toZonedDateTimeISO(timeZone).toString();
      expect(
        estimateDrift(
          revisions(
            local("2024-06-20T08:00:00Z"),
            local("2024-06-20T17:00:00Z"),
          ),
          { tolerance: "PT8H" },
        ),
      ).toMatchObject({ drift: "PT9H", revisions: 3, exceedsTolerance: true });
    },
  );

  // The whole instant range is 4,800,000,000 hours (Temporal.Instant#until confirms it).
  it.each`
    first                        | last                         | tolerance          | expected
    ${"-271821-04-20T00:00:00Z"} | ${"+275760-09-13T00:00:00Z"} | ${"PT4800000000H"} | ${{ drift: "PT4800000000H", exceedsTolerance: false }}
    ${"+275760-09-13T00:00:00Z"} | ${"-271821-04-20T00:00:00Z"} | ${"PT4799999999H"} | ${{ drift: "-PT4800000000H", exceedsTolerance: true }}
  `(
    "measures the range limits $first to $last",
    ({ first, last, tolerance, expected }) => {
      expect(
        estimateDrift(revisions(first, last), { tolerance }),
      ).toMatchObject(expected);
    },
  );

  it.each`
    events                                                                                                                          | why
    ${[]}                                                                                                                           | ${"an empty list"}
    ${[event("EST", "2024-06-20T08:00:00Z", "2024-06-01T00:00:00Z")]}                                                               | ${"a single EST: no drift from one sample"}
    ${[event("EST", "2024-06-20T08:00:00Z", "2024-06-01T00:00:00Z"), event("ACT", "2024-06-20T09:00:00Z", "2024-06-21T00:00:00Z")]} | ${"one EST beside another class"}
    ${[event("PLN", "2024-06-20T08:00:00Z", "2024-06-01T00:00:00Z"), event("PLN", "2024-06-20T09:00:00Z", "2024-06-02T00:00:00Z")]} | ${"no EST at all"}
    ${[...revisions("2024-06-20T08:00:00Z", "2024-06-20T17:00:00Z"), event("ACT", "2024-06-20T17:00:00", "2024-06-21T00:00:00Z")]}  | ${"an invalid event of another class"}
    ${[...revisions("2024-06-20T08:00:00Z", "2024-06-20T17:00:00Z"), event("ETA", "2024-06-20T17:00:00Z", "2024-06-21T00:00:00Z")]} | ${"an unknown classifier"}
    ${[...revisions("2024-06-20T08:00:00Z", "-271821-04-19T23:59:59.999999999Z")]}                                                  | ${"an at before the instant range"}
    ${[...revisions("2024-06-20T08:00:00Z", "2024-06-20T17:00:00Z"), null]}                                                         | ${"a null event"}
    ${"EST"}                                                                                                                        | ${"a string for the list"}
  `("returns null for $why", ({ events }) => {
    expect(estimateDrift(events, { tolerance: "PT8H" })).toBeNull();
  });

  it.each`
    options                     | why
    ${null}                     | ${"null options"}
    ${"PT8H"}                   | ${"a bare duration for options"}
    ${{ tolerance: "-PT8H" }}   | ${"a negative tolerance"}
    ${{ tolerance: "P1W" }}     | ${"weeks need a reference point"}
    ${{ tolerance: "P1M" }}     | ${"months need a reference point"}
    ${{ tolerance: "8 hours" }} | ${"not a duration"}
    ${{ tolerance: 28800 }}     | ${"a non-string tolerance"}
    ${{ tolerance: null }}      | ${"a null tolerance is not absent"}
  `("returns null for $why", ({ options }) => {
    expect(
      estimateDrift(
        revisions("2024-06-20T08:00:00Z", "2024-06-20T17:00:00Z"),
        options,
      ),
    ).toBeNull();
  });

  // Options are read property by property, as Temporal reads an options bag (GetOption is a
  // [[Get]]): a null-prototype bag and an inherited tolerance are read like a plain object.
  it.each`
    options                                                      | why
    ${Object.assign(Object.create(null), { tolerance: "PT8H" })} | ${"a null-prototype options bag"}
    ${Object.create({ tolerance: "PT8H" })}                      | ${"a tolerance inherited from the prototype"}
  `("reads $why like a plain object", ({ options }) => {
    expect(
      estimateDrift(
        revisions("2024-06-20T08:00:00Z", "2024-06-20T17:00:00Z"),
        options,
      )?.exceedsTolerance,
    ).toBe(true);
  });

  it.each`
    make                    | label
    ${() => hostileProxy()} | ${"a Proxy that throws on any trap"}
    ${() => revokedProxy()} | ${"a revoked Proxy"}
  `(
    "returns null for $label as the list, an event or the options",
    ({ make }) => {
      const valid = revisions("2024-06-20T08:00:00Z", "2024-06-20T17:00:00Z");
      expect(estimateDrift(make())).toBeNull();
      expect(estimateDrift([...valid, make()])).toBeNull();
      expect(estimateDrift(valid, make())).toBeNull();
    },
  );

  it("returns null when the duration parse throws", () => {
    mockTemporalDurationFromThrow();
    expect(
      estimateDrift(revisions("2024-06-20T08:00:00Z", "2024-06-20T17:00:00Z"), {
        tolerance: "PT8H",
      }),
    ).toBeNull();
  });

  it("returns null when the instant parse throws", () => {
    mockTemporalInstantFromThrow();
    expect(
      estimateDrift(revisions("2024-06-20T08:00:00Z", "2024-06-20T17:00:00Z")),
    ).toBeNull();
  });
});
