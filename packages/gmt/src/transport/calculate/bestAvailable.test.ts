import { Temporal } from "@js-temporal/polyfill";
import type { TimestampEvent } from "../../types";
import { battleTestTimeZones } from "../../test";
import { hostileProxy, revokedProxy } from "../../test/noThrow";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { bestAvailable } from "./bestAvailable";

/** An event on 15 June 2024: its class, the arrival it names, and when that was recorded. */
const event = (
  classifier: string,
  at: string,
  recordedAt: string,
): TimestampEvent => ({ classifier, at, recordedAt }) as TimestampEvent;

const planned = event("PLN", "2024-06-15T12:00:00Z", "2024-06-01T00:00:00Z");
const replanned = event("PLN", "2024-06-15T13:00:00Z", "2024-06-10T00:00:00Z");
const requested = event("REQ", "2024-06-15T12:30:00Z", "2024-06-12T00:00:00Z");
const estimated = event("EST", "2024-06-15T12:40:00Z", "2024-06-14T00:00:00Z");
const actual = event("ACT", "2024-06-15T12:52:00Z", "2024-06-15T12:53:00Z");
/** An estimate recorded after the actual: a late feed, still not an observation. */
const lateEstimate = event(
  "EST",
  "2024-06-15T13:05:00Z",
  "2024-06-15T14:00:00Z",
);

describe("bestAvailable", () => {
  // ACT if any; otherwise the newest PLN, then REQ, then EST. Newest means latest recordedAt.
  it.each`
    events                                          | expected                                             | why
    ${[planned, requested, estimated, actual]}      | ${{ at: "2024-06-15T12:52:00Z", classifier: "ACT" }} | ${"the ACT when present"}
    ${[actual, lateEstimate, planned]}              | ${{ at: "2024-06-15T12:52:00Z", classifier: "ACT" }} | ${"the ACT even when an EST was recorded after it"}
    ${[lateEstimate, estimated, actual, replanned]} | ${{ at: "2024-06-15T12:52:00Z", classifier: "ACT" }} | ${"the ACT regardless of input order"}
    ${[planned, replanned, requested, estimated]}   | ${{ at: "2024-06-15T13:00:00Z", classifier: "PLN" }} | ${"the newest PLN when there is no ACT"}
    ${[replanned, planned, estimated]}              | ${{ at: "2024-06-15T13:00:00Z", classifier: "PLN" }} | ${"the newest PLN by recordedAt, not by input order"}
    ${[estimated, requested, lateEstimate]}         | ${{ at: "2024-06-15T12:30:00Z", classifier: "REQ" }} | ${"never an EST when a REQ exists"}
    ${[estimated, lateEstimate]}                    | ${{ at: "2024-06-15T13:05:00Z", classifier: "EST" }} | ${"the newest EST when it is all there is"}
    ${[lateEstimate, estimated]}                    | ${{ at: "2024-06-15T13:05:00Z", classifier: "EST" }} | ${"the newest EST whatever its index"}
    ${[estimated]}                                  | ${{ at: "2024-06-15T12:40:00Z", classifier: "EST" }} | ${"a single event"}
  `(
    "returns $expected.classifier $expected.at: $why",
    ({ events, expected }) => {
      expect(bestAvailable(events)).toEqual(expected);
    },
  );

  it.each`
    events                                                                                                                               | expected                                         | why
    ${[event("ACT", "2024-06-15T12:52:00Z", "2024-06-15T13:00:00Z"), event("ACT", "2024-06-15T12:51:00Z", "2024-06-15T13:00:00Z")]}      | ${"2024-06-15T12:51:00Z"}                        | ${"a recordedAt tie goes to the later index"}
    ${[event("PLN", "2024-06-15T12:00:00Z", "2024-06-15T15:00:00+02:00"), event("PLN", "2024-06-15T13:00:00Z", "2024-06-15T13:00:00Z")]} | ${"2024-06-15T13:00:00Z"}                        | ${"a tie written in two zones is still a tie"}
    ${[event("ACT", "2024-06-15T12:51:00Z", "2024-06-15T13:00:00Z"), event("ACT", "2024-06-15T12:52:00Z", "2024-06-15T13:30:00Z")]}      | ${"2024-06-15T12:52:00Z"}                        | ${"the newest-recorded of two ACTs, a corrected actual"}
    ${[event("ACT", "2024-06-15T14:52:00+02:00[Europe/Amsterdam]", "2024-06-15T13:00:00Z")]}                                             | ${"2024-06-15T14:52:00+02:00[Europe/Amsterdam]"} | ${"at is echoed as written"}
    ${[event("ACT", "2024-06-15T12:52:00Z[Not/AZone]", "2024-06-15T13:00:00Z")]}                                                         | ${"2024-06-15T12:52:00Z[Not/AZone]"}             | ${"a bracket is never read"}
  `("returns $expected: $why", ({ events, expected }) => {
    expect(bestAvailable(events)?.at).toBe(expected);
  });

  // New York fell back at 02:00 EDT on 3 November 2024. 01:45 EDT is 05:45Z and 01:15 EST is
  // 06:15Z: the second pass is newer although its wall clock reads earlier.
  it("orders records across the fall-back by instant, not by wall clock", () => {
    expect(
      bestAvailable([
        event(
          "PLN",
          "2024-11-04T08:00:00Z",
          "2024-11-03T01:15:00-05:00[America/New_York]",
        ),
        event(
          "PLN",
          "2024-11-04T09:00:00Z",
          "2024-11-03T01:45:00-04:00[America/New_York]",
        ),
      ]),
    ).toEqual({ at: "2024-11-04T08:00:00Z", classifier: "PLN" });
  });

  it.each(battleTestTimeZones)(
    "orders records by instant whatever zone recordedAt is written in (%s)",
    (timeZone) => {
      const local = (utc: string) =>
        Temporal.Instant.from(utc).toZonedDateTimeISO(timeZone).toString();
      expect(
        bestAvailable([
          event("EST", "2024-06-15T13:00:00Z", local("2024-06-14T23:00:00Z")),
          event("EST", "2024-06-15T12:00:00Z", local("2024-06-14T22:00:00Z")),
        ]),
      ).toEqual({ at: "2024-06-15T13:00:00Z", classifier: "EST" });
    },
  );

  it.each`
    events                                                                                                                                      | expected
    ${[event("PLN", "-271821-04-20T00:00:00Z", "-271821-04-20T00:00:00Z"), event("PLN", "+275760-09-13T00:00:00Z", "+275760-09-13T00:00:00Z")]} | ${{ at: "+275760-09-13T00:00:00Z", classifier: "PLN" }}
    ${[event("PLN", "-271821-04-19T23:59:59.999999999Z", "2024-06-15T00:00:00Z")]}                                                              | ${null}
    ${[event("PLN", "2024-06-15T00:00:00Z", "+275760-09-13T00:00:00.000000001Z")]}                                                              | ${null}
  `(
    "reads the instant range limits: $events.0.at recorded $events.0.recordedAt",
    ({ events, expected }) => {
      expect(bestAvailable(events)).toEqual(expected);
    },
  );

  it.each`
    events                                                                    | why
    ${[]}                                                                     | ${"an empty list"}
    ${[actual, event("ETA", "2024-06-15T12:00:00Z", "2024-06-15T12:00:00Z")]} | ${"an unknown classifier, even beside an ACT"}
    ${[actual, event("act", "2024-06-15T12:00:00Z", "2024-06-15T12:00:00Z")]} | ${"a lower-case classifier"}
    ${[actual, event("EST", "2024-06-15T12:00:00", "2024-06-15T12:00:00Z")]}  | ${"a zoneless at"}
    ${[actual, event("EST", "2024-06-15T12:00:00Z", "yesterday")]}            | ${"a malformed recordedAt"}
    ${[actual, null]}                                                         | ${"a null event"}
    ${Object.assign([], { 1: actual })}                                       | ${"a sparse list: a hole is not an event"}
    ${"ACT"}                                                                  | ${"a string for the list"}
    ${null}                                                                   | ${"null for the list"}
  `("returns null for $why", ({ events }) => {
    expect(bestAvailable(events)).toBeNull();
  });

  it.each`
    make                    | label
    ${() => hostileProxy()} | ${"a Proxy that throws on any trap"}
    ${() => revokedProxy()} | ${"a revoked Proxy"}
  `("returns null for $label as the list or an event", ({ make }) => {
    expect(bestAvailable(make())).toBeNull();
    expect(bestAvailable([actual, make()])).toBeNull();
  });

  it("returns null when the instant parse throws", () => {
    mockTemporalInstantFromThrow();
    expect(bestAvailable([actual])).toBeNull();
  });
});
