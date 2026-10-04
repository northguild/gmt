import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones } from "../../test";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { hostileProxy, revokedProxy } from "../../test/noThrow";
import { scheduleDelivery } from "../../transport/calculate/scheduleDelivery";
import { multimodalETA } from "./multimodalETA";

/**
 * A truck → ship → rail move, Shanghai to Chicago. The truck leaves 08:00 Shanghai time
 * (00:00Z on 10 June); six hours to the port, two days at the terminal, 14 days 6 hours at sea,
 * 36 hours at Los Angeles, 52 hours on the train.
 *
 * Transit 6 + 342 + 52 = 400 h; dwell 48 + 36 = 84 h; elapsed 484 h, arriving
 * 2024-06-30T04:00:00Z, 23:00 CDT on the 29th (checked against plain `Temporal.Instant#add`).
 */
const shanghaiToChicago = [
  {
    departure: "2024-06-10T08:00:00+08:00[Asia/Shanghai]",
    duration: "PT6H",
    timeZone: "Asia/Shanghai",
    dwellAfter: "P2D",
    mode: "truck",
  },
  {
    duration: "P14DT6H",
    timeZone: "America/Los_Angeles",
    dwellAfter: "PT36H",
    mode: "ship",
  },
  { duration: "PT52H", timeZone: "America/Chicago", mode: "rail" },
];

/** Two legs chained at UTC: 00:00Z + 10 h, a 2-hour handoff, + 5 h to Tokyo; 17 h elapsed. */
const chained = [
  {
    departure: "2024-06-15T00:00:00Z",
    duration: "PT10H",
    timeZone: "UTC",
    dwellAfter: "PT2H",
  },
  { duration: "PT5H", timeZone: "Asia/Tokyo" },
];

/** Elapsed time from `from` to `to`, hours as the largest unit, computed by plain Temporal. */
function elapsed(from: string, to: string): Temporal.Duration {
  return Temporal.Instant.from(from).until(
    Temporal.ZonedDateTime.from(to).toInstant(),
    {
      largestUnit: "hours",
    },
  );
}

describe("multimodalETA", () => {
  it("returns the spec's empty result for an empty legs array", () => {
    expect(multimodalETA([])).toEqual({
      eta: "",
      totalLegs: 0,
      totalTransit: "PT0S",
      totalDwell: "PT0S",
    });
  });

  it("returns the empty result for an empty legs array with a valid startTimeZone", () => {
    expect(multimodalETA([], { startTimeZone: "Asia/Tokyo" })).toEqual({
      eta: "",
      totalLegs: 0,
      totalTransit: "PT0S",
      totalDwell: "PT0S",
    });
  });

  it("reports a truck, ship and rail move's transit and dwell apart", () => {
    expect(multimodalETA(shanghaiToChicago)).toEqual({
      eta: "2024-06-29T23:00:00-05:00[America/Chicago]",
      totalLegs: 3,
      totalTransit: "PT400H",
      totalDwell: "PT84H",
    });
  });

  it("totals the leg durations plus the supplied dwell when every leg chains", () => {
    expect(multimodalETA(chained)).toEqual({
      eta: "2024-06-16T02:00:00+09:00[Asia/Tokyo]",
      totalLegs: 2,
      totalTransit: "PT15H",
      totalDwell: "PT2H",
    });
  });

  // The invariant the spec names: transit plus dwell is the end-to-end elapsed time.
  it.each`
    legs                 | departure                 | reads
    ${shanghaiToChicago} | ${"2024-06-10T00:00:00Z"} | ${"truck, ship and rail"}
    ${chained}           | ${"2024-06-15T00:00:00Z"} | ${"two chained legs"}
  `(
    "sums transit and dwell to the elapsed time from $departure ($reads)",
    ({ legs, departure }) => {
      const result = multimodalETA(legs)!;
      const sum = Temporal.Duration.from(result.totalTransit)
        .add(result.totalDwell)
        .round({ largestUnit: "hours" });
      expect(sum.toString()).toBe(elapsed(departure, result.eta).toString());
    },
  );

  // Leg 1 lands 10:00Z and may leave from 12:00Z; the scheduled connection leaves 13:00Z. The
  // cargo sits at the handoff three hours, two of them the minimum connect time.
  it("counts the wait for a scheduled connection as dwell at the handoff", () => {
    const result = multimodalETA([
      chained[0],
      {
        departure: "2024-06-15T13:00:00Z",
        duration: "PT1H",
        timeZone: "UTC",
      },
    ]);
    expect(result).toEqual({
      eta: "2024-06-15T14:00:00+00:00[UTC]",
      totalLegs: 2,
      totalTransit: "PT11H",
      totalDwell: "PT3H",
    });
    expect(elapsed("2024-06-15T00:00:00Z", result!.eta).toString()).toBe(
      "PT14H",
    );
  });

  it("counts a scheduled connection with zero slack as exactly the supplied dwell", () => {
    expect(
      multimodalETA([
        chained[0],
        {
          departure: "2024-06-15T12:00:00Z",
          duration: "PT1H",
          timeZone: "UTC",
        },
      ]),
    ).toEqual({
      eta: "2024-06-15T13:00:00+00:00[UTC]",
      totalLegs: 2,
      totalTransit: "PT11H",
      totalDwell: "PT2H",
    });
  });

  // A final leg's dwellAfter has no handoff after it, so it moves nothing and is not dwell.
  it.each`
    dwellAfter   | reads
    ${"PT0S"}    | ${"zero"}
    ${"PT5H"}    | ${"five hours"}
    ${"P3D"}     | ${"three days"}
    ${undefined} | ${"omitted"}
  `(
    "leaves a single leg's dwell at PT0S when its final dwellAfter is $reads",
    ({ dwellAfter }) => {
      expect(
        multimodalETA([
          {
            departure: "2024-06-15T10:00:00Z",
            duration: "PT36H",
            timeZone: "Asia/Tokyo",
            dwellAfter,
          },
        ]),
      ).toEqual({
        eta: "2024-06-17T07:00:00+09:00[Asia/Tokyo]",
        totalLegs: 1,
        totalTransit: "PT36H",
        totalDwell: "PT0S",
      });
    },
  );

  it("keeps the final dwell out of the total on a three-leg move", () => {
    const withFinal = shanghaiToChicago.map((leg, index) =>
      index === 2 ? { ...leg, dwellAfter: "PT8H" } : leg,
    );
    expect(multimodalETA(withFinal)).toEqual(multimodalETA(shanghaiToChicago));
  });

  // Durations are exact time: a day is 24 hours and the result's largest unit is hours, as
  // crossingTime and dwellTime report theirs. Sums carry: 1h30m + 45m is 2h15m.
  it.each`
    first        | dwell       | second              | totalTransit        | totalDwell
    ${"P1D"}     | ${"P1D"}    | ${"PT0S"}           | ${"PT24H"}          | ${"PT24H"}
    ${"PT1H30M"} | ${"PT30M"}  | ${"PT45M"}          | ${"PT2H15M"}        | ${"PT30M"}
    ${"PT90M"}   | ${"PT1.5S"} | ${"PT0.5S"}         | ${"PT1H30M0.5S"}    | ${"PT1.5S"}
    ${"PT0S"}    | ${"PT0S"}   | ${"PT0S"}           | ${"PT0S"}           | ${"PT0S"}
    ${"-PT0S"}   | ${"-PT0S"}  | ${"PT0.000000001S"} | ${"PT0.000000001S"} | ${"PT0S"}
  `(
    "totals $first + $second as $totalTransit and a $dwell handoff as $totalDwell",
    ({ first, dwell, second, totalTransit, totalDwell }) => {
      const result = multimodalETA([
        {
          departure: "2024-06-15T00:00:00Z",
          duration: first,
          timeZone: "UTC",
          dwellAfter: dwell,
        },
        { duration: second, timeZone: "UTC" },
      ]);
      expect(result?.totalTransit).toBe(totalTransit);
      expect(result?.totalDwell).toBe(totalDwell);
    },
  );

  // Four elapsed hours from 23:00 EST land at 04:00 EDT: the wall clock shows five. Transit is
  // the elapsed time, never the wall-clock difference.
  it("reports elapsed transit across the spring-forward, not the wall-clock difference", () => {
    expect(
      multimodalETA([
        {
          departure: "2024-03-09T23:00:00-05:00[America/New_York]",
          duration: "PT4H",
          timeZone: "America/New_York",
        },
      ]),
    ).toEqual({
      eta: "2024-03-10T04:00:00-04:00[America/New_York]",
      totalLegs: 1,
      totalTransit: "PT4H",
      totalDwell: "PT0S",
    });
  });

  // Leg 1 lands 01:00 EDT (05:00Z); a two-hour handoff across the fall-back releases the cargo at
  // 07:00Z, which the New York clock shows as 02:00 EST: the clock moved one hour, two elapsed.
  it("reports elapsed dwell across the fall-back", () => {
    expect(
      multimodalETA([
        {
          departure: "2024-11-03T04:00:00Z",
          duration: "PT1H",
          timeZone: "America/New_York",
          dwellAfter: "PT2H",
        },
        { duration: "PT1H", timeZone: "America/New_York" },
      ]),
    ).toEqual({
      eta: "2024-11-03T03:00:00-05:00[America/New_York]",
      totalLegs: 2,
      totalTransit: "PT2H",
      totalDwell: "PT2H",
    });
  });

  // The totals are exact time, so they do not depend on the zones; only eta is rendered locally.
  it.each(battleTestTimeZones)(
    "reports the same totals whatever the destination zone, here %s",
    (timeZone) => {
      const result = multimodalETA([
        { ...chained[0], timeZone },
        { ...chained[1], timeZone },
      ]);
      expect(result).toEqual({
        eta: Temporal.Instant.from("2024-06-15T17:00:00Z")
          .toZonedDateTimeISO(timeZone)
          .toString(),
        totalLegs: 2,
        totalTransit: "PT15H",
        totalDwell: "PT2H",
      });
    },
  );

  it("matches scheduleDelivery's eta for the same legs", () => {
    expect(multimodalETA(shanghaiToChicago)?.eta).toBe(
      scheduleDelivery(shanghaiToChicago)?.eta,
    );
  });

  // A published 10:00 wall time in New York is 14:00Z; one hour later is 15:00Z.
  it("reads a zoneless first departure in startTimeZone", () => {
    expect(
      multimodalETA(
        [
          {
            departure: "2024-06-15T10:00:00",
            duration: "PT1H",
            timeZone: "UTC",
            dwellAfter: "PT30M",
          },
          { duration: "PT2H", timeZone: "UTC" },
        ],
        { startTimeZone: "America/New_York" },
      ),
    ).toEqual({
      eta: "2024-06-15T17:30:00+00:00[UTC]",
      totalLegs: 2,
      totalTransit: "PT3H",
      totalDwell: "PT30M",
    });
  });

  // Leg 1 lands 05:00Z (01:00 EDT) and may leave from 06:00Z (01:00 EST). Leg 2's printed 01:30
  // happened twice that night: 05:30Z, inside the dwell, and 06:30Z, the first pass the cargo can
  // catch. It leaves 06:30Z and lands 07:30Z, 02:30 EST: three hours moving, 90 minutes waiting.
  it("takes the catchable pass of a repeated hour at a hub and counts the wait as dwell", () => {
    expect(
      multimodalETA([
        {
          departure: "2024-11-03T03:00:00Z",
          duration: "PT2H",
          timeZone: "America/New_York",
          dwellAfter: "PT1H",
        },
        {
          departure: "2024-11-03T01:30:00",
          duration: "PT1H",
          timeZone: "America/New_York",
        },
      ]),
    ).toEqual({
      eta: "2024-11-03T02:30:00-05:00[America/New_York]",
      totalLegs: 2,
      totalTransit: "PT3H",
      totalDwell: "PT1H30M",
    });
  });

  it("treats an explicit undefined startTimeZone as omitted", () => {
    expect(multimodalETA(chained, { startTimeZone: undefined })).toEqual(
      multimodalETA(chained),
    );
  });

  // The instant range: a leg may land on the last instant Temporal supports, and one leg can span
  // the whole range (8.64e21 ns each side of the epoch: 4,800,000,000 hours).
  it.each`
    departure                    | duration           | eta                                    | totalTransit
    ${"+275760-09-12T00:00:00Z"} | ${"PT24H"}         | ${"+275760-09-13T00:00:00+00:00[UTC]"} | ${"PT24H"}
    ${"-271821-04-20T00:00:00Z"} | ${"PT4800000000H"} | ${"+275760-09-13T00:00:00+00:00[UTC]"} | ${"PT4800000000H"}
  `(
    "lands $duration from $departure at $eta, totalling $totalTransit",
    ({ departure, duration, eta, totalTransit }) => {
      expect(multimodalETA([{ departure, duration, timeZone: "UTC" }])).toEqual(
        { eta, totalLegs: 1, totalTransit, totalDwell: "PT0S" },
      );
    },
  );

  // Every leg field is read once, so a getter that changes its answer cannot make the totals
  // disagree with the eta.
  it("reads each leg's duration once", () => {
    let reads = 0;
    const leg = {
      departure: "2024-06-15T00:00:00Z",
      timeZone: "UTC",
      get duration(): string {
        reads += 1;
        return reads === 1 ? "PT1H" : "PT2H";
      },
    };
    expect(multimodalETA([leg])).toEqual({
      eta: "2024-06-15T01:00:00+00:00[UTC]",
      totalLegs: 1,
      totalTransit: "PT1H",
      totalDwell: "PT0S",
    });
    expect(reads).toBe(1);
  });

  // Invalid input is scheduleDelivery's: the legs either schedule or they do not.
  it.each`
    legs                                                                                                                                    | reads
    ${[{ ...chained[0] }, { departure: "2024-06-15T11:00:00Z", duration: "PT1H", timeZone: "UTC" }]}                                        | ${"a scheduled connection inside the handoff dwell"}
    ${[{ departure: "2024-06-15T10:00:00", duration: "PT1H", timeZone: "UTC" }]}                                                            | ${"a zoneless first departure without startTimeZone"}
    ${[{ duration: "PT1H", timeZone: "UTC" }]}                                                                                              | ${"a first leg without a departure"}
    ${[{ departure: "2024-06-15T10:00:00Z", duration: "-PT1H", timeZone: "UTC" }]}                                                          | ${"a negative leg"}
    ${[{ departure: "2024-06-15T10:00:00Z", duration: "P1M", timeZone: "UTC" }]}                                                            | ${"a calendar-unit leg"}
    ${[{ departure: "2024-06-15T10:00:00Z", duration: "PT1H", timeZone: "UTC", dwellAfter: "-PT1H" }]}                                      | ${"a negative final dwell"}
    ${[{ departure: "2024-06-15T10:00:00Z", duration: "PT1H", timeZone: "UTC", dwellAfter: "P1W" }, { duration: "PT1H", timeZone: "UTC" }]} | ${"a calendar-unit handoff dwell"}
    ${[{ departure: "2024-06-15T10:00:00Z", duration: "PT1H", timeZone: "Asia/Tokio" }]}                                                    | ${"an unknown zone"}
    ${[{ departure: "2024-06-15T10:00:00Z", duration: "PT1H", timeZone: "UTC", mode: 3 }]}                                                  | ${"a tag that is not a string"}
    ${[{ departure: "+275760-09-13T00:00:00Z", duration: "PT1S", timeZone: "UTC" }]}                                                        | ${"an arrival past the instant range"}
    ${[null]}                                                                                                                               | ${"a leg that is not an object"}
    ${["leg"]}                                                                                                                              | ${"a leg that is a string"}
  `("returns null for $reads", ({ legs }) => {
    expect(multimodalETA(legs)).toBeNull();
  });

  it.each`
    make                                    | kind
    ${() => "legs"}                         | ${"a string"}
    ${() => null}                           | ${"null"}
    ${() => undefined}                      | ${"undefined"}
    ${() => ({ length: 1, 0: chained[0] })} | ${"an array-like object"}
    ${() => hostileProxy()}                 | ${"a Proxy that throws on any trap"}
    ${() => revokedProxy()}                 | ${"a revoked Proxy"}
  `("returns null when legs is $kind", ({ make }) => {
    expect(multimodalETA(make() as never)).toBeNull();
  });

  it.each`
    make                                       | kind
    ${() => null}                              | ${"null"}
    ${() => "America/New_York"}                | ${"a string"}
    ${() => 0}                                 | ${"a number"}
    ${() => ({ startTimeZone: "Asia/Tokio" })} | ${"an invalid startTimeZone"}
    ${() => hostileProxy()}                    | ${"a Proxy that throws on any trap"}
    ${() => revokedProxy()}                    | ${"a revoked Proxy"}
  `("returns null when options is $kind", ({ make }) => {
    expect(multimodalETA(chained, make() as never)).toBeNull();
  });

  it("returns null when a leg is a Proxy that throws on any trap", () => {
    expect(multimodalETA([hostileProxy() as never])).toBeNull();
  });

  it("returns null when the instant parse throws", () => {
    mockTemporalInstantFromThrow();
    expect(multimodalETA(chained)).toBeNull();
  });
});
