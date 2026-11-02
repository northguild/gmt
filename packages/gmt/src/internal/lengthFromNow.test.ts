import { Temporal } from "./temporal";
import { zoneFrame } from "./zoneFrame";
import { isValidDateTimeDurationUnit } from "../plain/validate/isValidDateTimeDurationUnit";
import {
  addLengthToStart,
  readLengthUnits,
  subtractLengthFromStart,
  totalLengthFromStart,
  utcLengthFrame,
  wholeMillisecondsUntil,
  wholeSecondsUntil,
} from "./lengthFromNow";

const frameOf = (zone: string) => {
  const frame = zoneFrame(zone);
  if (frame === null) throw new Error(`not a zone: ${zone}`);
  return frame;
};

// Expected seconds are worked out from the calendar, not from the code: a year from
// 2027-06-15 spans 29 Feb 2028 (366 days), a month from 31 Jan ends on 28 Feb (28 days), a day in
// Paris on 28 Mar 2026 spans the 02:00 spring-forward (23 hours), and so on.
describe("totalLengthFromStart and addLengthToStart", () => {
  it.each`
    start                         | units                               | zone                  | seconds
    ${"2026-06-15T12:00:00Z"}     | ${{ years: 1 }}                     | ${"UTC"}              | ${31536000}
    ${"2027-06-15T12:00:00Z"}     | ${{ years: 1 }}                     | ${"UTC"}              | ${31622400}
    ${"2027-06-15T12:00:00.750Z"} | ${{ years: 1 }}                     | ${"UTC"}              | ${31622400}
    ${"2028-02-29T12:00:00Z"}     | ${{ years: 1 }}                     | ${"UTC"}              | ${31536000}
    ${"2027-02-10T12:00:00Z"}     | ${{ months: 1 }}                    | ${"UTC"}              | ${2419200}
    ${"2027-03-10T12:00:00Z"}     | ${{ months: 1 }}                    | ${"UTC"}              | ${2678400}
    ${"2027-01-31T12:00:00Z"}     | ${{ months: 1 }}                    | ${"UTC"}              | ${2419200}
    ${"2027-06-15T12:00:00Z"}     | ${{ days: 90 }}                     | ${"UTC"}              | ${7776000}
    ${"2027-06-15T12:00:00Z"}     | ${{ weeks: 2 }}                     | ${"UTC"}              | ${1209600}
    ${"2027-06-15T12:00:00Z"}     | ${{ years: 1, months: 1, days: 1 }} | ${"UTC"}              | ${34300800}
    ${"2026-03-28T11:00:00Z"}     | ${{ days: 1 }}                      | ${"Europe/Paris"}     | ${82800}
    ${"2026-03-28T11:00:00Z"}     | ${{ days: 1 }}                      | ${"UTC"}              | ${86400}
    ${"2024-11-02T16:00:00Z"}     | ${{ days: 1 }}                      | ${"America/New_York"} | ${90000}
    ${"2024-03-09T07:30:00Z"}     | ${{ days: 1 }}                      | ${"America/New_York"} | ${86400}
    ${"2024-11-02T05:30:00Z"}     | ${{ days: 1 }}                      | ${"America/New_York"} | ${86400}
    ${"2027-06-15T12:00:00Z"}     | ${{ days: 0 }}                      | ${"UTC"}              | ${0}
    ${"2027-03-31T12:00:00Z"}     | ${{ months: -1 }}                   | ${"UTC"}              | ${-2678400}
    ${"2024-11-02T16:00:00Z"}     | ${{ hours: 24 }}                    | ${"America/New_York"} | ${86400}
  `(
    "$start + $units in $zone is $seconds seconds, by total and by sum",
    ({ start, units, zone, seconds }) => {
      const from = Temporal.Instant.from(start);
      const frame = frameOf(zone);
      expect(totalLengthFromStart(from, units, "seconds", frame)).toBe(seconds);
      const end = addLengthToStart(from, units, frame);
      expect(Number(end.epochNanoseconds - from.epochNanoseconds) / 1e9).toBe(
        seconds,
      );
    },
  );

  // A repeated hour read in days or larger. New York repeats 01:00-02:00 on 2024-11-03, so 06:30Z
  // is 01:30-05:00, the later pass, and 05:30Z is 01:30-04:00, the earlier one. TC39
  // ComputeNudgeWindow starts the window at the origin itself: from the later pass the next day is
  // 24 hours away and from the earlier pass 25. Worked out by hand and checked in Chromium 153:
  // 1 s of 86400, 1 h of 24, P1D of 7 × 24 h, P1M of 365 × 24 h (30 days); from the earlier pass
  // 30 min and 1 h of 25, P1D (25 h) of 169 h, P1M (721 h) of 8761 h. 30 minutes from 05:30Z ends in
  // the later pass at a lower wall clock on the same date, where the polyfill backs up a day.
  it.each`
    start                     | units                    | zone                  | unit         | total
    ${"2027-06-15T12:00:00Z"} | ${{ hours: 36 }}         | ${"UTC"}              | ${"days"}    | ${1.5}
    ${"2027-06-15T12:00:00Z"} | ${{ days: 1, hours: 1 }} | ${"UTC"}              | ${"minutes"} | ${1500}
    ${"2024-11-03T06:30:00Z"} | ${{ seconds: 0 }}        | ${"America/New_York"} | ${"days"}    | ${0}
    ${"2024-11-03T06:30:00Z"} | ${{ seconds: 1 }}        | ${"America/New_York"} | ${"days"}    | ${1 / 86400}
    ${"2024-11-03T06:30:00Z"} | ${{ hours: 1 }}          | ${"America/New_York"} | ${"days"}    | ${1 / 24}
    ${"2024-11-03T06:30:00Z"} | ${{ hours: -1 }}         | ${"America/New_York"} | ${"days"}    | ${-1 / 25}
    ${"2024-11-03T06:30:00Z"} | ${{ days: 1 }}           | ${"America/New_York"} | ${"days"}    | ${1}
    ${"2024-11-03T06:30:00Z"} | ${{ days: 1 }}           | ${"America/New_York"} | ${"weeks"}   | ${1 / 7}
    ${"2024-11-03T06:30:00Z"} | ${{ months: 1 }}         | ${"America/New_York"} | ${"years"}   | ${30 / 365}
    ${"2024-11-03T06:30:00Z"} | ${{ hours: 1 }}          | ${"America/New_York"} | ${"hours"}   | ${1}
    ${"2024-11-03T05:30:00Z"} | ${{ seconds: 0 }}        | ${"America/New_York"} | ${"days"}    | ${0}
    ${"2024-11-03T05:30:00Z"} | ${{ minutes: 30 }}       | ${"America/New_York"} | ${"days"}    | ${1 / 50}
    ${"2024-11-03T05:30:00Z"} | ${{ hours: 1 }}          | ${"America/New_York"} | ${"days"}    | ${1 / 25}
    ${"2024-11-03T05:30:00Z"} | ${{ days: 1 }}           | ${"America/New_York"} | ${"weeks"}   | ${25 / 169}
    ${"2024-11-03T05:30:00Z"} | ${{ months: 1 }}         | ${"America/New_York"} | ${"years"}   | ${721 / 8761}
    ${"2024-11-03T06:30:00Z"} | ${{ hours: 1 }}          | ${"UTC"}              | ${"days"}    | ${1 / 24}
  `(
    "totalLengthFromStart $start + $units in $zone in $unit is $total",
    ({ start, units, zone, unit, total }) => {
      expect(
        totalLengthFromStart(
          Temporal.Instant.from(start),
          units,
          unit,
          frameOf(zone),
        ),
      ).toBe(total);
    },
  );

  // A seconds offset moves the wall clock, so it moves the month the length lands in. At -00:44:30
  // 2027-03-01T00:44:10Z reads 02-28T23:59:40, one month on is 03-28T23:59:40, which is 03-29T00:44:10Z.
  // At -00:44 it reads 03-01T00:00:10, one month on is 04-01T00:00:10, which is 04-01T00:44:10Z.
  it.each`
    start                     | units            | zone           | end
    ${"2027-06-15T12:00:00Z"} | ${{ days: 90 }}  | ${"UTC"}       | ${"2027-09-13T12:00:00Z"}
    ${"2027-06-15T12:00:00Z"} | ${{ years: 1 }}  | ${"UTC"}       | ${"2028-06-15T12:00:00Z"}
    ${"2027-02-10T00:00:00Z"} | ${{ months: 1 }} | ${"UTC"}       | ${"2027-03-10T00:00:00Z"}
    ${"2027-03-01T00:44:10Z"} | ${{ months: 1 }} | ${"-00:44:30"} | ${"2027-03-29T00:44:10Z"}
    ${"2027-03-01T00:44:10Z"} | ${{ months: 1 }} | ${"-00:44"}    | ${"2027-04-01T00:44:10Z"}
  `(
    "addLengthToStart $start + $units in $zone is $end",
    ({ start, units, zone, end }) => {
      expect(
        addLengthToStart(
          Temporal.Instant.from(start),
          units,
          frameOf(zone),
        ).toString(),
      ).toBe(end);
    },
  );

  it("addLengthToStart throws for a length past Temporal's range", () => {
    expect(() =>
      addLengthToStart(
        Temporal.Instant.from("2027-06-15T12:00:00Z"),
        { years: 300000 },
        frameOf("UTC"),
      ),
    ).toThrow();
  });

  it("totalLengthFromStart throws for a length the specification has no value for", () => {
    // 24:30 from 2024-11-02T01:30-04:00 ends in New York's later pass, past the end of the day window
    // (tc39/proposal-temporal#3336). The public wrapper turns the throw into its sentinel.
    expect(() =>
      totalLengthFromStart(
        Temporal.Instant.from("2024-11-02T05:30:00Z"),
        { hours: 24, minutes: 30 },
        "days",
        frameOf("America/New_York"),
      ),
    ).toThrow();
  });

  it("totalLengthFromStart throws for a length past Temporal's range", () => {
    expect(() =>
      totalLengthFromStart(
        Temporal.Instant.from("2027-06-15T12:00:00Z"),
        { years: 300000 },
        "seconds",
        frameOf("UTC"),
      ),
    ).toThrow();
  });
});

describe("wholeSecondsUntil", () => {
  const now = Temporal.Instant.from("2027-06-15T12:00:00Z");
  const at = (ns: bigint) =>
    Temporal.Instant.fromEpochNanoseconds(now.epochNanoseconds + ns);

  it.each`
    label                   | offset              | seconds
    ${"now"}                | ${0n}               | ${0}
    ${"now + 60 s"}         | ${60_000_000_000n}  | ${60}
    ${"now - 60 s"}         | ${-60_000_000_000n} | ${-60}
    ${"now + 1 ns"}         | ${1n}               | ${1}
    ${"now - 1 ns"}         | ${-1n}              | ${0}
    ${"now - 999999999 ns"} | ${-999_999_999n}    | ${0}
    ${"now - 1 s"}          | ${-1_000_000_000n}  | ${-1}
    ${"now - 1 s - 1 ns"}   | ${-1_000_000_001n}  | ${-1}
    ${"now + 1 s"}          | ${1_000_000_000n}   | ${1}
    ${"now + 1 s + 1 ns"}   | ${1_000_000_001n}   | ${2}
  `("target $label is $seconds, never -0", ({ offset, seconds }) => {
    expect(wholeSecondsUntil(at(offset), now)).toBe(seconds);
  });
});

describe("readLengthUnits", () => {
  it.each`
    units                     | result
    ${{ days: 1 }}            | ${{ days: 1 }}
    ${{ days: 0 }}            | ${{ days: 0 }}
    ${{ days: -0 }}           | ${{ days: -0 }}
    ${{ days: -1 }}           | ${null}
    ${{ years: 1, days: -1 }} | ${null}
    ${{ days: 1.5 }}          | ${{ days: 1.5 }}
    ${{}}                     | ${null}
    ${"P1Y"}                  | ${null}
    ${{ fortnights: 1 }}      | ${null}
  `("units $units reads as $result", ({ units, result }) => {
    expect(readLengthUnits(units, isValidDateTimeDurationUnit)).toStrictEqual(
      result,
    );
  });
});

describe("subtractLengthFromStart", () => {
  // Worked by hand: 90 days before 15 Jun is 17 Mar (14+30+31+15... 15 Jun - 90 d); 31 Mar - 1 month
  // clamps to 28 Feb; Paris loses an hour on 29 Mar 2026, so a day before 10:00Z is 23 hours back.
  it.each`
    start                     | units                                | zone              | end
    ${"2027-06-15T12:00:00Z"} | ${{ days: 90 }}                      | ${"UTC"}          | ${"2027-03-17T12:00:00Z"}
    ${"2027-06-15T12:00:00Z"} | ${{ years: 1 }}                      | ${"UTC"}          | ${"2026-06-15T12:00:00Z"}
    ${"2027-03-31T00:00:00Z"} | ${{ months: 1 }}                     | ${"UTC"}          | ${"2027-02-28T00:00:00Z"}
    ${"2027-03-31T12:00:00Z"} | ${{ months: 1, days: 1, hours: 13 }} | ${"UTC"}          | ${"2027-02-26T23:00:00Z"}
    ${"2026-03-29T10:00:00Z"} | ${{ days: 1 }}                       | ${"Europe/Paris"} | ${"2026-03-28T11:00:00Z"}
  `(
    "subtractLengthFromStart $start - $units in $zone is $end",
    ({ start, units, zone, end }) => {
      expect(
        subtractLengthFromStart(
          Temporal.Instant.from(start),
          units,
          frameOf(zone),
        ).toString(),
      ).toBe(end);
    },
  );

  it("subtractLengthFromStart throws for a length past Temporal's range", () => {
    expect(() =>
      subtractLengthFromStart(
        Temporal.Instant.from("2027-06-15T12:00:00Z"),
        { years: 300000 },
        frameOf("UTC"),
      ),
    ).toThrow();
  });
});

describe("wholeMillisecondsUntil", () => {
  const now = Temporal.Instant.from("2027-06-15T12:00:00Z");
  const at = (ns: bigint) =>
    Temporal.Instant.fromEpochNanoseconds(now.epochNanoseconds + ns);

  it.each`
    label                  | offset            | milliseconds
    ${"now"}               | ${0n}             | ${0}
    ${"now + 1500 ms"}     | ${1_500_000_000n} | ${1500}
    ${"now + 1 ns"}        | ${1n}             | ${1}
    ${"now - 1 ns"}        | ${-1n}            | ${0}
    ${"now - 999999 ns"}   | ${-999_999n}      | ${0}
    ${"now + 1 ms"}        | ${1_000_000n}     | ${1}
    ${"now + 1 ms + 1 ns"} | ${1_000_001n}     | ${2}
    ${"now - 1 ms"}        | ${-1_000_000n}    | ${-1}
    ${"now - 1 ms - 1 ns"} | ${-1_000_001n}    | ${-1}
  `("target $label is $milliseconds, never -0", ({ offset, milliseconds }) => {
    expect(wholeMillisecondsUntil(at(offset), now)).toBe(milliseconds);
  });
});

describe("utcLengthFrame", () => {
  it("counts on UTC with no shift", () => {
    expect(utcLengthFrame()).toStrictEqual({
      timeZone: "UTC",
      shiftNanoseconds: 0n,
    });
  });
});
