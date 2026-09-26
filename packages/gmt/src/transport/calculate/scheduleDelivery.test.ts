import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones } from "../../test";
import { TomorrowTimeZone, YesterdayTimeZone } from "../../test/timeZoneMatrix";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { etaAtZone } from "../convert/etaAtZone";
import { scheduleDelivery } from "./scheduleDelivery";
import { transitTime } from "./transitTime";

/** One valid leg: 10:00Z out, 36 elapsed hours, read in Tokyo. */
const validLeg = {
  departure: "2024-06-15T10:00:00Z",
  duration: "PT36H",
  timeZone: "Asia/Tokyo",
};

describe("scheduleDelivery", () => {
  it("returns the vacuous schedule for an empty legs array", () => {
    expect(scheduleDelivery([])).toEqual({ eta: "", legTimes: [] });
  });

  it("returns the vacuous schedule for an empty legs array with valid options", () => {
    expect(scheduleDelivery([], { startTimeZone: "Asia/Tokyo" })).toEqual({
      eta: "",
      legTimes: [],
    });
  });

  // 10:00Z + 36 elapsed hours = 2024-06-16T22:00:00Z, confirmed against plain
  // Temporal.Instant.add; each zone's local arrival is the polyfill's own rendering.
  it.each(battleTestTimeZones)(
    "lands the single 36-hour leg from 10:00Z in %s",
    (timeZone) => {
      const localArrival = Temporal.Instant.from("2024-06-16T22:00:00Z")
        .toZonedDateTimeISO(timeZone)
        .toString();
      expect(scheduleDelivery([{ ...validLeg, timeZone }])).toEqual({
        eta: localArrival,
        legTimes: [
          { arrival: "2024-06-16T22:00:00Z", localArrival, dwellAfter: "PT0S" },
        ],
      });
    },
  );

  // The issue's invariant: a single-leg schedule is transitTime composed with etaAtZone.
  it.each(battleTestTimeZones)(
    "matches transitTime composed with etaAtZone for the single leg in %s",
    (timeZone) => {
      expect(scheduleDelivery([{ ...validLeg, timeZone }])?.eta).toBe(
        etaAtZone(transitTime(validLeg.departure, validLeg.duration), timeZone),
      );
    },
  );

  // A zoned departure is exact through its bracket; four elapsed hours across the
  // spring-forward arrive at 04:00 local, not 03:00 (polyfill-confirmed).
  it("carries a zoned departure across the spring-forward as elapsed time", () => {
    expect(
      scheduleDelivery([
        {
          departure: "2024-03-09T23:00:00-05:00[America/New_York]",
          duration: "PT4H",
          timeZone: "America/New_York",
        },
      ]),
    ).toEqual({
      eta: "2024-03-10T04:00:00-04:00[America/New_York]",
      legTimes: [
        {
          arrival: "2024-03-10T08:00:00Z",
          localArrival: "2024-03-10T04:00:00-04:00[America/New_York]",
          dwellAfter: "PT0S",
        },
      ],
    });
  });

  // An arrival at 23:30 local stays on the 15th locally although the instant is on the 16th UTC.
  it("returns a 23:30 localArrival on the local date, not the UTC date", () => {
    expect(
      scheduleDelivery([
        {
          departure: "2024-06-15T20:00:00Z",
          duration: "PT7H30M",
          timeZone: "America/New_York",
        },
      ]),
    ).toEqual({
      eta: "2024-06-15T23:30:00-04:00[America/New_York]",
      legTimes: [
        {
          arrival: "2024-06-16T03:30:00Z",
          localArrival: "2024-06-15T23:30:00-04:00[America/New_York]",
          dwellAfter: "PT0S",
        },
      ],
    });
  });

  it.each`
    legs           | reason
    ${undefined}   | ${"legs omitted"}
    ${null}        | ${"legs is null"}
    ${"x"}         | ${"legs is a string"}
    ${1}           | ${"legs is a number"}
    ${{}}          | ${"legs is a plain object, not an array"}
    ${[null]}      | ${"a leg is null"}
    ${["x"]}       | ${"a leg is a string"}
    ${[undefined]} | ${"a leg is undefined"}
  `("returns the sentinel when $reason", ({ legs }) => {
    expect(scheduleDelivery(legs as never)).toBeNull();
  });

  it.each`
    leg                                                                                                | reason
    ${{ duration: "PT1H", timeZone: "UTC" }}                                                           | ${"the first leg has no departure"}
    ${{ departure: undefined, duration: "PT1H", timeZone: "UTC" }}                                     | ${"an explicit undefined departure is the same as omitting it"}
    ${{ departure: 123, duration: "PT1H", timeZone: "UTC" }}                                           | ${"the departure is not a string"}
    ${{ departure: "2024-06-15T10:00:00Z", timeZone: "UTC" }}                                          | ${"the duration is missing"}
    ${{ departure: "2024-06-15T10:00:00Z", duration: "2 hours", timeZone: "UTC" }}                     | ${"the duration is not an ISO 8601 duration"}
    ${{ departure: "2024-06-15T10:00:00Z", duration: "P1M", timeZone: "UTC" }}                         | ${"a calendar-unit duration needs a reference point"}
    ${{ departure: "2024-06-15T10:00:00Z", duration: "PT1H" }}                                         | ${"the timeZone is missing"}
    ${{ departure: "2024-06-15T10:00:00Z", duration: "PT1H", timeZone: "Asia/Tokio" }}                 | ${"the timeZone does not exist"}
    ${{ departure: "invalid", duration: "PT1H", timeZone: "UTC" }}                                     | ${"the departure is garbage"}
    ${{ departure: "2024-06-15T10:00:00Z[Not/AZone]", duration: "PT1H", timeZone: "UTC" }}             | ${"the departure's bracketed zone does not exist: departures read brackets"}
    ${{ departure: "2024-06-15T10:00:00-05:00[America/New_York]", duration: "PT1H", timeZone: "UTC" }} | ${"the departure's offset contradicts its bracketed zone"}
    ${{ departure: "2024-06-15T10:00:00Z", duration: "P1W", timeZone: "UTC" }}                         | ${"a week is a calendar unit, not 168 exact hours"}
    ${{ departure: "2016-12-31T23:59:60Z", duration: "PT1H", timeZone: "UTC" }}                        | ${"the departure is a leap second"}
  `("returns the sentinel when $reason", ({ leg }) => {
    expect(scheduleDelivery([leg as never])).toBeNull();
  });

  it("returns the sentinel when the instant parse throws", () => {
    mockTemporalInstantFromThrow();
    expect(scheduleDelivery([validLeg])).toBeNull();
  });

  it("echoes mode, origin and destination verbatim on each LegTime", () => {
    expect(
      scheduleDelivery([
        {
          ...validLeg,
          duration: "PT1H",
          mode: "ship",
          origin: "USNYC",
          destination: "JPTYO",
        },
        { duration: "PT1H", timeZone: "UTC", mode: "rail" },
      ])?.legTimes.map(({ mode, origin, destination }) => ({
        mode,
        origin,
        destination,
      })),
    ).toEqual([
      { mode: "ship", origin: "USNYC", destination: "JPTYO" },
      { mode: "rail", origin: undefined, destination: undefined },
    ]);
  });

  it("leaves unsupplied tag keys truly absent, not undefined", () => {
    const legTime = scheduleDelivery([{ ...validLeg, mode: "ship" }])
      ?.legTimes[0];
    expect(legTime !== undefined && "mode" in legTime).toBe(true);
    expect(legTime !== undefined && "origin" in legTime).toBe(false);
    expect(legTime !== undefined && "destination" in legTime).toBe(false);
  });

  it("treats an explicit undefined tag as omitted", () => {
    const legTime = scheduleDelivery([{ ...validLeg, origin: undefined }])
      ?.legTimes[0];
    expect(legTime !== undefined && "origin" in legTime).toBe(false);
  });

  it.each`
    tag                           | reason
    ${{ mode: 5 }}                | ${"a non-string mode"}
    ${{ origin: {} }}             | ${"a non-string origin"}
    ${{ destination: ["JPTYO"] }} | ${"a non-string destination"}
  `("returns the sentinel for $reason", ({ tag }) => {
    expect(scheduleDelivery([{ ...validLeg, ...tag }])).toBeNull();
  });

  // Total dwell, rebuilt from the schedule itself. With implicit departures each leg leaves at
  // its departure = arrival - duration, so the handoff interval i is
  // [arrival_i, arrival_{i+1} - duration_{i+1}). Their exact length is totalled with plain
  // Temporal.Instant.until and must equal the sum of the non-final dwellAfter values
  // (PT2H + PT90M = PT3H30M = 12,600 s). A dropped or double-counted hop moves arrival_{i+1},
  // so it fails here even when the echoed strings are right.
  it("echoes dwellAfter as written and the handoff intervals total the non-final dwells", () => {
    const legs = [
      { ...firstLeg, dwellAfter: "PT2H" },
      { duration: "PT1H", timeZone: "UTC", dwellAfter: "PT90M" },
      { duration: "PT1H", timeZone: "UTC", dwellAfter: "PT6H" },
    ];
    const result = scheduleDelivery(legs);
    expect(result?.legTimes.map(({ dwellAfter }) => dwellAfter)).toEqual([
      "PT2H",
      "PT90M",
      "PT6H",
    ]);
    const legTimes = result?.legTimes ?? [];
    expect(legTimes).toHaveLength(3);
    let handoffSeconds = 0;
    for (let i = 0; i + 1 < legTimes.length; i++) {
      const nextDeparture = Temporal.Instant.from(
        legTimes[i + 1].arrival,
      ).subtract(Temporal.Duration.from(legs[i + 1].duration));
      handoffSeconds += Temporal.Instant.from(legTimes[i].arrival)
        .until(nextDeparture)
        .total("seconds");
    }
    const nonFinalDwellSeconds = legs
      .slice(0, -1)
      .reduce(
        (sum, leg) =>
          sum + Temporal.Duration.from(leg.dwellAfter).total("seconds"),
        0,
      );
    expect(nonFinalDwellSeconds).toBe(12_600);
    expect(handoffSeconds).toBe(nonFinalDwellSeconds);
  });

  // The last leg's dwell is handling time after the journey: echoed, but the eta stays the last
  // leg's localArrival (10:00Z + 1h = 11:00Z in UTC), not the dwell's end.
  it("echoes a last-leg dwellAfter without moving the eta", () => {
    expect(
      scheduleDelivery([{ ...validLeg, duration: "PT1H", dwellAfter: "PT6H" }]),
    ).toEqual({
      eta: "2024-06-15T20:00:00+09:00[Asia/Tokyo]",
      legTimes: [
        {
          arrival: "2024-06-15T11:00:00Z",
          localArrival: "2024-06-15T20:00:00+09:00[Asia/Tokyo]",
          dwellAfter: "PT6H",
        },
      ],
    });
  });

  // Three legs, all values confirmed against plain Temporal.Instant arithmetic:
  // 00:00Z +10h = 10:00Z (Berlin 12:00+02:00), +PT2H dwell = 12:00Z, +5h = 17:00Z
  // (Tokyo 02:00+09:00 on the 16th), +PT1H30M dwell = 18:30Z, +3h30m = 22:00Z
  // (New York 18:00-04:00). Each implicit departure is the previous arrival plus its dwell.
  const truckShipRail = [
    {
      departure: "2024-06-15T00:00:00Z",
      duration: "PT10H",
      timeZone: "Europe/Berlin",
      dwellAfter: "PT2H",
    },
    {
      duration: "PT5H",
      timeZone: "Asia/Tokyo",
      dwellAfter: "PT1H30M",
    },
    {
      duration: "PT3H30M",
      timeZone: "America/New_York",
    },
  ];

  it("chains three legs, each implicit departure at the previous arrival plus its dwell", () => {
    expect(scheduleDelivery(truckShipRail)).toEqual({
      eta: "2024-06-15T18:00:00-04:00[America/New_York]",
      legTimes: [
        {
          arrival: "2024-06-15T10:00:00Z",
          localArrival: "2024-06-15T12:00:00+02:00[Europe/Berlin]",
          dwellAfter: "PT2H",
        },
        {
          arrival: "2024-06-15T17:00:00Z",
          localArrival: "2024-06-16T02:00:00+09:00[Asia/Tokyo]",
          dwellAfter: "PT1H30M",
        },
        {
          arrival: "2024-06-15T22:00:00Z",
          localArrival: "2024-06-15T18:00:00-04:00[America/New_York]",
          dwellAfter: "PT0S",
        },
      ],
    });
  });

  // Without a dwell the second leg leaves at the first arrival itself: 10:00Z + 5h = 15:00Z.
  it("moves the next implicit departure by exactly the dwell", () => {
    expect(
      scheduleDelivery([
        {
          departure: "2024-06-15T00:00:00Z",
          duration: "PT10H",
          timeZone: "UTC",
        },
        { duration: "PT5H", timeZone: "UTC" },
      ])?.legTimes[1]?.arrival,
    ).toBe("2024-06-15T15:00:00Z");
    expect(
      scheduleDelivery([
        {
          departure: "2024-06-15T00:00:00Z",
          duration: "PT10H",
          timeZone: "UTC",
          dwellAfter: "PT2H",
        },
        { duration: "PT5H", timeZone: "UTC" },
      ])?.legTimes[1]?.arrival,
    ).toBe("2024-06-15T17:00:00Z");
  });

  it.each`
    dwellAfter   | reason
    ${"-PT1H"}   | ${"a negative dwell is a data error, not time travel"}
    ${"P1M"}     | ${"a calendar-unit dwell needs a reference point"}
    ${"P1W"}     | ${"a week-long dwell is a calendar unit too"}
    ${"2 hours"} | ${"the dwell is not an ISO 8601 duration"}
    ${5}         | ${"the dwell is not a string"}
    ${""}        | ${"the dwell is an empty string"}
  `("returns the sentinel when $reason", ({ dwellAfter }) => {
    expect(
      scheduleDelivery([
        { ...validLeg, dwellAfter },
        { duration: "PT1H", timeZone: "UTC" },
      ]),
    ).toBeNull();
  });

  // Explicit departures: the first leg arrives 10:00Z and dwells PT2H, so the connection is
  // feasible from 12:00Z exactly (departure >= arrival + minimum connect time; equal passes).
  const firstLeg = {
    departure: "2024-06-15T00:00:00Z",
    duration: "PT10H",
    timeZone: "UTC",
    dwellAfter: "PT2H",
  };

  it.each`
    departure                                        | arrival                   | connection
    ${"2024-06-15T13:00:00Z"}                        | ${"2024-06-15T14:00:00Z"} | ${"an hour of slack after the dwell"}
    ${"2024-06-15T12:00:00Z"}                        | ${"2024-06-15T13:00:00Z"} | ${"zero slack: equal to arrival plus dwell passes"}
    ${"2024-06-15T09:00:00-04:00[America/New_York]"} | ${"2024-06-15T14:00:00Z"} | ${"a zoned scheduled departure (13:00Z through its bracket)"}
    ${"2024-06-15T09:00:00[America/New_York]"}       | ${"2024-06-15T14:00:00Z"} | ${"a bracket with no offset is still exact (13:00Z), not zoneless"}
    ${"2024-06-15T21:00:00+09:00"}                   | ${"2024-06-15T13:00:00Z"} | ${"an offset scheduled departure (12:00Z: zero slack)"}
  `(
    "waits for the scheduled $departure with $connection",
    ({ departure, arrival }) => {
      expect(
        scheduleDelivery([
          firstLeg,
          { departure, duration: "PT1H", timeZone: "UTC" },
        ])?.legTimes[1]?.arrival,
      ).toBe(arrival);
    },
  );

  it.each`
    departure                           | reason
    ${"2024-06-15T11:00:00Z"}           | ${"the scheduled departure falls inside the dwell (11:00Z < 10:00Z + PT2H)"}
    ${"2024-06-15T11:59:59.999999999Z"} | ${"the scheduled departure is one nanosecond inside the dwell"}
    ${"2024-06-15T09:00:00Z"}           | ${"the scheduled departure is before the previous arrival"}
    ${"invalid"}                        | ${"the scheduled departure is garbage"}
    ${123}                              | ${"the scheduled departure is not a string"}
  `(
    "returns the sentinel (missed connection) when $reason",
    ({ departure }) => {
      expect(
        scheduleDelivery([
          firstLeg,
          { departure, duration: "PT1H", timeZone: "UTC" },
        ]),
      ).toBeNull();
    },
  );

  it("treats an explicit undefined departure on a later leg as omitted", () => {
    expect(
      scheduleDelivery([
        firstLeg,
        { departure: undefined, duration: "PT1H", timeZone: "UTC" },
      ])?.legTimes[1]?.arrival,
    ).toBe("2024-06-15T13:00:00Z");
  });

  // startTimeZone: a zoneless first-leg departure is a published local wall time, read in the
  // option's zone with "compatible" disambiguation. Resolutions confirmed against plain
  // Temporal.ZonedDateTime.from(`${wall}[zone]`, { disambiguation: "compatible" }).
  it.each`
    wall                     | resolved                  | kind
    ${"2024-06-15T10:00:00"} | ${"2024-06-15T14:00:00Z"} | ${"an ordinary wall time (America/New_York is -04:00 in June)"}
    ${"2024-11-03T01:30:00"} | ${"2024-11-03T05:30:00Z"} | ${"a fall-back wall time that happens twice: compatible takes the earlier"}
    ${"2024-03-10T02:30:00"} | ${"2024-03-10T07:30:00Z"} | ${"a spring-forward wall time that never happens: compatible takes the later"}
  `(
    "resolves the zoneless first departure $wall in startTimeZone: $kind",
    ({ wall, resolved }) => {
      expect(
        scheduleDelivery(
          [{ departure: wall, duration: "PT0S", timeZone: "UTC" }],
          {
            startTimeZone: "America/New_York",
          },
        )?.legTimes[0]?.arrival,
      ).toBe(resolved);
    },
  );

  it("ignores startTimeZone when the first departure is already exact", () => {
    const legs = [{ ...validLeg }];
    expect(scheduleDelivery(legs, { startTimeZone: "Asia/Tokyo" })).toEqual(
      scheduleDelivery(legs),
    );
    expect(
      scheduleDelivery(legs, { startTimeZone: "Asia/Tokyo" }),
    ).not.toBeNull();
  });

  it("treats an explicit undefined startTimeZone as omitted", () => {
    expect(scheduleDelivery([validLeg], { startTimeZone: undefined })).toEqual(
      scheduleDelivery([validLeg]),
    );
    expect(
      scheduleDelivery(
        [
          {
            departure: "2024-06-15T10:00:00",
            duration: "PT1H",
            timeZone: "UTC",
          },
        ],
        { startTimeZone: undefined },
      ),
    ).toBeNull();
  });

  it.each`
    legs                                                                                   | options                           | reason
    ${[{ departure: "2024-06-15T10:00:00", duration: "PT1H", timeZone: "UTC" }]}           | ${undefined}                      | ${"a zoneless departure without startTimeZone is not a moment"}
    ${[validLeg]}                                                                          | ${{ startTimeZone: "Not/AZone" }} | ${"an invalid startTimeZone is invalid input even when unused"}
    ${[validLeg]}                                                                          | ${{ startTimeZone: 5 }}           | ${"a non-string startTimeZone"}
    ${[validLeg]}                                                                          | ${null}                           | ${"options is null (GetOptionsObject)"}
    ${[validLeg]}                                                                          | ${"x"}                            | ${"options is a string (GetOptionsObject)"}
    ${[validLeg]}                                                                          | ${1}                              | ${"options is a number (GetOptionsObject)"}
    ${[]}                                                                                  | ${null}                           | ${"options is checked before the empty-legs result"}
    ${[]}                                                                                  | ${{ startTimeZone: "Not/AZone" }} | ${"an invalid startTimeZone beats the empty-legs result"}
    ${[firstLeg, { departure: "2024-06-15T13:00:00", duration: "PT1H", timeZone: "UTC" }]} | ${{ startTimeZone: "UTC" }}       | ${"a zoneless departure on a later leg is never resolved"}
    ${[{ departure: "2024-06-15", duration: "PT1H", timeZone: "UTC" }]}                    | ${{ startTimeZone: "UTC" }}       | ${"a date-only departure is not a wall time"}
    ${[firstLeg, { duration: "PT1H", timeZone: "Asia/Tokio" }]}                            | ${undefined}                      | ${"a later leg is invalid: no partial schedule"}
  `("returns the sentinel when $reason", ({ legs, options }) => {
    expect(scheduleDelivery(legs as never, options as never)).toBeNull();
  });

  // Temporal's last instant is +275760-09-13T00:00:00Z (TC39 nsMaxInstant): a leg may arrive
  // exactly there (the zero dwell adds nothing), and one that would pass it is not a schedule.
  it("arrives exactly at the instant range maximum", () => {
    expect(
      scheduleDelivery([
        {
          departure: "+275760-09-12T00:00:00Z",
          duration: "PT24H",
          timeZone: "UTC",
        },
      ]),
    ).toEqual({
      eta: "+275760-09-13T00:00:00+00:00[UTC]",
      legTimes: [
        {
          arrival: "+275760-09-13T00:00:00Z",
          localArrival: "+275760-09-13T00:00:00+00:00[UTC]",
          dwellAfter: "PT0S",
        },
      ],
    });
  });

  // The last leg's dwell moves nothing, so it never turns a representable ETA into null: the
  // arrival sits exactly at nsMaxInstant and the PT1H dwell after it is only echoed.
  it("keeps a last-leg dwell that would pass the range maximum as an echo only", () => {
    expect(
      scheduleDelivery([
        {
          departure: "+275760-09-12T00:00:00Z",
          duration: "PT24H",
          timeZone: "UTC",
          dwellAfter: "PT1H",
        },
      ]),
    ).toEqual({
      eta: "+275760-09-13T00:00:00+00:00[UTC]",
      legTimes: [
        {
          arrival: "+275760-09-13T00:00:00Z",
          localArrival: "+275760-09-13T00:00:00+00:00[UTC]",
          dwellAfter: "PT1H",
        },
      ],
    });
  });

  // A non-final dwell hop that would pass nsMaxInstant is still out of range.
  it("returns the sentinel when a non-final dwell hop would pass the range maximum", () => {
    expect(
      scheduleDelivery([
        {
          departure: "+275760-09-12T00:00:00Z",
          duration: "PT24H",
          timeZone: "UTC",
          dwellAfter: "PT1H",
        },
        { duration: "PT0S", timeZone: "UTC" },
      ]),
    ).toBeNull();
  });

  // The last leg's dwell is still validated as a duration, without computing an instant.
  it.each`
    dwellAfter   | reason
    ${"P1W"}     | ${"a week is a calendar unit"}
    ${"P1M"}     | ${"a month is a calendar unit"}
    ${"P1Y"}     | ${"a year is a calendar unit"}
    ${"-PT1H"}   | ${"a negative dwell"}
    ${"2 hours"} | ${"not an ISO 8601 duration"}
    ${""}        | ${"an empty string"}
    ${5}         | ${"not a string"}
  `(
    "returns the sentinel when the last leg's dwellAfter is $reason ($dwellAfter)",
    ({ dwellAfter }) => {
      expect(
        scheduleDelivery([{ ...validLeg, duration: "PT1H", dwellAfter }]),
      ).toBeNull();
    },
  );

  it.each`
    dwellAfter | reason
    ${"-PT0S"} | ${"negative zero has sign 0, so it is not negative"}
    ${"P1D"}   | ${"a day is 24 exact hours"}
    ${"PT90M"} | ${"echoed as written"}
  `(
    "accepts and echoes the last leg's dwellAfter $dwellAfter: $reason",
    ({ dwellAfter }) => {
      expect(
        scheduleDelivery([{ ...validLeg, duration: "PT1H", dwellAfter }])
          ?.legTimes[0]?.dwellAfter,
      ).toBe(dwellAfter);
    },
  );

  // A leg cannot arrive before it departs: transitTime accepts a negative duration (to recover a
  // departure from an arrival), but a negative leg in a schedule is invalid input.
  it.each`
    legs                                                                                                                                                                                             | reason
    ${[{ departure: "2024-06-15T10:00:00Z", duration: "-PT1H", timeZone: "UTC" }]}                                                                                                                   | ${"a first leg of -PT1H would arrive at 09:00Z"}
    ${[firstLeg, { duration: "-PT1H", timeZone: "UTC" }]}                                                                                                                                            | ${"a later leg of -PT1H would arrive before its 12:00Z departure"}
    ${[{ departure: "2024-06-15T10:00:00Z", duration: "PT10H", timeZone: "UTC" }, { duration: "-PT8H", timeZone: "UTC" }, { departure: "2024-06-15T13:00:00Z", duration: "PT1H", timeZone: "UTC" }]} | ${"leg 2 of -PT8H lands 12:00Z, before its 20:00Z departure, so leg 3 at 13:00Z must not look feasible"}
  `("returns the sentinel when $reason", ({ legs }) => {
    expect(scheduleDelivery(legs)).toBeNull();
  });

  it("accepts a -PT0S leg: sign 0, arrival equals departure", () => {
    expect(
      scheduleDelivery([
        {
          departure: "2024-06-15T10:00:00Z",
          duration: "-PT0S",
          timeZone: "UTC",
        },
      ])?.legTimes[0]?.arrival,
    ).toBe("2024-06-15T10:00:00Z");
  });

  // Local-time resolution policy on a later leg's scheduled connection: a bracketed departure
  // with no offset resolves an ambiguous wall time to the earlier instant and a nonexistent one
  // to the later instant (plain Temporal.ZonedDateTime.from confirms 05:30Z and 07:30Z). The
  // first leg lands at the wall time's day 00:00Z, well before either.
  it.each`
    departure                                  | arrival                   | kind
    ${"2024-11-03T01:30:00[America/New_York]"} | ${"2024-11-03T06:30:00Z"} | ${"ambiguous (fall-back overlap): the earlier instant, 05:30Z"}
    ${"2024-03-10T02:30:00[America/New_York]"} | ${"2024-03-10T08:30:00Z"} | ${"nonexistent (spring-forward gap): the later instant, 07:30Z"}
  `(
    "resolves the offsetless scheduled connection $departure: $kind",
    ({ departure, arrival }) => {
      const day = departure.slice(0, 10);
      expect(
        scheduleDelivery([
          { departure: `${day}T00:00:00Z`, duration: "PT0S", timeZone: "UTC" },
          { departure, duration: "PT1H", timeZone: "UTC" },
        ])?.legTimes[1]?.arrival,
      ).toBe(arrival);
    },
  );

  // A fixed offset is a startTimeZone like any other: 10:00 at +05:30 is 04:30Z.
  it("reads a zoneless first departure in a fixed-offset startTimeZone", () => {
    expect(
      scheduleDelivery(
        [
          {
            departure: "2024-06-15T10:00:00",
            duration: "PT0S",
            timeZone: "UTC",
          },
        ],
        { startTimeZone: "+05:30" },
      )?.legTimes[0]?.arrival,
    ).toBe("2024-06-15T04:30:00Z");
  });

  it.each`
    duration   | dwellAfter   | reason
    ${"PT25H"} | ${undefined} | ${"the arrival would pass the last representable instant"}
  `("returns the sentinel when $reason", ({ duration, dwellAfter }) => {
    expect(
      scheduleDelivery([
        {
          departure: "+275760-09-12T00:00:00Z",
          duration,
          timeZone: "UTC",
          ...(dwellAfter === undefined ? {} : { dwellAfter }),
        },
      ]),
    ).toBeNull();
  });

  // A leg landing across the date line lands on the expected local date: 22:00Z on the 15th is
  // already the 16th in Apia (+13:00) and still the 15th in Niue (-11:00).
  it.each`
    timeZone             | localArrival
    ${TomorrowTimeZone}  | ${"2024-06-16T11:00:00+13:00[Pacific/Apia]"}
    ${YesterdayTimeZone} | ${"2024-06-15T11:00:00-11:00[Pacific/Niue]"}
  `(
    "lands the date-line leg on the expected local date in $timeZone",
    ({ timeZone, localArrival }) => {
      expect(
        scheduleDelivery([
          { departure: "2024-06-15T10:00:00Z", duration: "PT12H", timeZone },
        ]),
      ).toEqual({
        eta: localArrival,
        legTimes: [
          { arrival: "2024-06-15T22:00:00Z", localArrival, dwellAfter: "PT0S" },
        ],
      });
    },
  );

  // Every exact departure form names the same instant here, 10:00Z, so each arrives at 11:00Z:
  // 19:00+09:00 is 10:00Z; 06:00 in New York in June (-04:00) is 10:00Z, with or without the
  // offset written. The startTimeZone column shows the option is ignored for every exact form.
  it.each`
    departure                                        | startTimeZone
    ${"2024-06-15T10:00:00Z"}                        | ${undefined}
    ${"2024-06-15T19:00:00+09:00"}                   | ${undefined}
    ${"2024-06-15T06:00:00-04:00[America/New_York]"} | ${undefined}
    ${"2024-06-15T06:00:00[America/New_York]"}       | ${undefined}
    ${"2024-06-15T19:00:00+09:00"}                   | ${"Asia/Tokyo"}
    ${"2024-06-15T06:00:00-04:00[America/New_York]"} | ${"Asia/Tokyo"}
    ${"2024-06-15T06:00:00[America/New_York]"}       | ${"Asia/Tokyo"}
  `(
    "reads the exact first departure $departure as 10:00Z (startTimeZone $startTimeZone ignored)",
    ({ departure, startTimeZone }) => {
      expect(
        scheduleDelivery([{ departure, duration: "PT1H", timeZone: "UTC" }], {
          startTimeZone,
        }),
      ).toEqual({
        eta: "2024-06-15T11:00:00+00:00[UTC]",
        legTimes: [
          {
            arrival: "2024-06-15T11:00:00Z",
            localArrival: "2024-06-15T11:00:00+00:00[UTC]",
            dwellAfter: "PT0S",
          },
        ],
      });
    },
  );

  // No dwell: the minimum connect time is zero, so a scheduled departure at the arrival itself
  // (10:00Z) is feasible and the second leg lands at 11:00Z.
  it("passes a scheduled departure equal to the arrival when the previous leg has no dwell", () => {
    expect(
      scheduleDelivery([
        {
          departure: "2024-06-15T00:00:00Z",
          duration: "PT10H",
          timeZone: "UTC",
        },
        {
          departure: "2024-06-15T10:00:00Z",
          duration: "PT1H",
          timeZone: "UTC",
        },
      ])?.legTimes[1]?.arrival,
    ).toBe("2024-06-15T11:00:00Z");
  });

  // A scheduled connection in the middle resets the cursor: leg 2 waits for 15:00Z (after the
  // 12:00Z release), lands 16:00Z and dwells PT30M, so leg 3 leaves 16:30Z and lands 17:30Z.
  // A leg-3 departure of 16:15Z is inside leg 2's dwell — the cursor is leg 2's, not leg 1's.
  const scheduledMiddle = [
    firstLeg,
    {
      departure: "2024-06-15T15:00:00Z",
      duration: "PT1H",
      timeZone: "UTC",
      dwellAfter: "PT30M",
    },
  ];

  it("chains from the scheduled middle leg's own arrival plus its dwell", () => {
    expect(
      scheduleDelivery([
        ...scheduledMiddle,
        { duration: "PT1H", timeZone: "UTC" },
      ]),
    ).toEqual({
      eta: "2024-06-15T17:30:00+00:00[UTC]",
      legTimes: [
        {
          arrival: "2024-06-15T10:00:00Z",
          localArrival: "2024-06-15T10:00:00+00:00[UTC]",
          dwellAfter: "PT2H",
        },
        {
          arrival: "2024-06-15T16:00:00Z",
          localArrival: "2024-06-15T16:00:00+00:00[UTC]",
          dwellAfter: "PT30M",
        },
        {
          arrival: "2024-06-15T17:30:00Z",
          localArrival: "2024-06-15T17:30:00+00:00[UTC]",
          dwellAfter: "PT0S",
        },
      ],
    });
  });

  it("returns the sentinel when leg 3 misses the scheduled middle leg's dwell", () => {
    expect(
      scheduleDelivery([
        ...scheduledMiddle,
        {
          departure: "2024-06-15T16:15:00Z",
          duration: "PT1H",
          timeZone: "UTC",
        },
      ]),
    ).toBeNull();
  });

  // transitTime's grammar: a day is exactly 24 hours, for the leg and for the dwell. 12:00Z on
  // 9 March + 24h = 12:00Z on the 10th, which New York reads as 08:00-04:00 after the
  // spring-forward (a calendar day would have said 07:00); the P1D dwell releases 12:00Z on the
  // 11th. Confirmed with plain Temporal.Instant.add({ hours: 24 }).
  it("reads P1D as 24 exact hours for both the leg and the dwell, across the spring-forward", () => {
    expect(
      scheduleDelivery([
        {
          departure: "2024-03-09T12:00:00Z",
          duration: "P1D",
          timeZone: "America/New_York",
          dwellAfter: "P1D",
        },
        { duration: "PT0S", timeZone: "UTC" },
      ]),
    ).toEqual({
      eta: "2024-03-11T12:00:00+00:00[UTC]",
      legTimes: [
        {
          arrival: "2024-03-10T12:00:00Z",
          localArrival: "2024-03-10T08:00:00-04:00[America/New_York]",
          dwellAfter: "P1D",
        },
        {
          arrival: "2024-03-11T12:00:00Z",
          localArrival: "2024-03-11T12:00:00+00:00[UTC]",
          dwellAfter: "PT0S",
        },
      ],
    });
  });

  // A published 10:00 wall time read in each battle zone. 15 June 10:00 is in no zone's DST gap
  // or overlap, so the plain polyfill resolution is unambiguous.
  it.each(battleTestTimeZones)(
    "resolves the zoneless first departure 2024-06-15T10:00:00 in startTimeZone %s",
    (startTimeZone) => {
      expect(
        scheduleDelivery(
          [
            {
              departure: "2024-06-15T10:00:00",
              duration: "PT0S",
              timeZone: "UTC",
            },
          ],
          { startTimeZone },
        )?.legTimes[0]?.arrival,
      ).toBe(
        Temporal.ZonedDateTime.from(`2024-06-15T10:00:00[${startTimeZone}]`, {
          disambiguation: "compatible",
        })
          .toInstant()
          .toString(),
      );
    },
  );
});
