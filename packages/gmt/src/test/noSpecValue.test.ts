import { describe, expect, it } from "vitest";
import { normalizeDuration, totalDuration } from "../duration";
import { Temporal } from "../internal/temporal";
import {
  diffUnix,
  diffUnixAsDuration,
  formatRelativeUnix,
  intervalLengthUnix,
} from "../unix";
import { diffUtc, formatRelativeUtc, intervalLengthUtc } from "../utc";
import {
  diffZoned,
  diffZonedAsDuration,
  formatRelativeZoned,
  intervalLengthZoned,
} from "../zoned";

/**
 * A length the specification has no value for, which GMT answers with its sentinel.
 *
 * TC39 `NudgeToCalendarUnit` builds a window from the start of the current unit to the start of the
 * next. When the target is outside it, it tries once more with a shifted window, then Asserts. The
 * shift only applies to a month or a year, so a day or a week that misses the first window misses the
 * second too, and no value exists. tc39/proposal-temporal#3336 asks what should happen. The Phoenix
 * rows reach two other Asserts, filed in #3311, and the Enderbury rows a third, filed in #3310. The
 * owner's decision for all of them: GMT returns `null` for a number and `""` for a string, and never
 * extrapolates.
 *
 * The window arithmetic for the first shape, in New York, which repeats 01:00-02:00 on 2024-11-03:
 * from `2024-11-02T01:30-04:00`, 24:30 later is `2024-11-03T01:00-05:00`, an exact time of 06:00Z. One
 * day on from the origin is `2024-11-03T01:30`, which `"compatible"` resolves to the earlier pass,
 * 05:30Z. The window is 05:30Z yesterday to 05:30Z today, and 06:00Z is past its end. The week window
 * ends a week later, and the month a month later, so both contain the target and keep their value.
 *
 * Every expected value is worked out from that rule and checked against `Temporal` in Chromium
 * 153.0.8010.12, native V8, never the polyfill and never GMT. Chromium's throw is the check; the
 * rule is the window. A row comment gives the reason where the inputs do not show it.
 */
const NEW_YORK = "America/New_York";
// 24:30 before the first instant of New York's later pass.
const ORIGIN = "2024-11-02T01:30:00-04:00[America/New_York]";
const END = "2024-11-03T01:00:00-05:00[America/New_York]";
const ORIGIN_MS = 1_730_525_400_000;
const END_MS = 1_730_613_600_000;
const ORIGIN_UTC = "2024-11-02T05:30:00Z";
const END_UTC = "2024-11-03T06:00:00Z";

// 1944-10-01 00:01 in Arizona went back to 23:01, so 15 minutes after 00:00:59 reads 23:15:59 on the
// date before. `DifferenceZonedDateTime` joins a negative date to a positive time: an Assert fails in
// `CombineDateAndTimeDuration`, in every unit.
const PHOENIX = "America/Phoenix";
const PHOENIX_ORIGIN = "1944-10-01T00:00:59-06:00[America/Phoenix]";
const PHOENIX_END = "1944-09-30T23:15:59-07:00[America/Phoenix]";
// The mirror: `DifferenceZonedDateTime` runs out of day corrections, another Assert.
const PHOENIX_LATER = "1944-10-01T00:00:59-07:00[America/Phoenix]";

// A negative window: New York skips 02:00-03:00 on 2024-03-10, so 02:30 that day resolves forward to
// 03:30, an end bound later than an instant at 03:10.
const GAP_ORIGIN = "2024-03-11T02:30:00-04:00[America/New_York]";

describe("totalDuration with no spec value", () => {
  it.each`
    relativeTo                                       | duration          | unit        | total
    ${ORIGIN}                                        | ${"PT24H30M"}     | ${"days"}   | ${null}
    ${ORIGIN}                                        | ${"PT24H30M"}     | ${"weeks"}  | ${0.14497041420118342}
    ${ORIGIN}                                        | ${"PT24H30M"}     | ${"months"} | ${0.03398058252427184}
    ${ORIGIN}                                        | ${"PT24H30M"}     | ${"years"}  | ${0.0027968036529680365}
    ${ORIGIN}                                        | ${"PT24H30M"}     | ${"hours"}  | ${24.5}
    ${"2024-10-27T01:30:00-04:00[America/New_York]"} | ${"PT168H30M"}    | ${"days"}   | ${null}
    ${"2024-10-27T01:30:00-04:00[America/New_York]"} | ${"PT168H30M"}    | ${"weeks"}  | ${null}
    ${"2024-10-27T01:30:00-04:00[America/New_York]"} | ${"PT168H30M"}    | ${"months"} | ${0.22617449664429531}
    ${"2024-10-27T01:30:00-04:00[America/New_York]"} | ${"PT168H30M"}    | ${"years"}  | ${0.019235159817351598}
    ${GAP_ORIGIN}                                    | ${"-PT23H20M"}    | ${"days"}   | ${null}
    ${GAP_ORIGIN}                                    | ${"-PT23H20M"}    | ${"weeks"}  | ${-0.13972055888223553}
    ${GAP_ORIGIN}                                    | ${"-PT23H20M"}    | ${"months"} | ${-0.03357314148681055}
    ${GAP_ORIGIN}                                    | ${"-PT23H20M"}    | ${"years"}  | ${-0.0026566473110934}
    ${"2024-03-17T02:30:00-04:00[America/New_York]"} | ${"-PT167H20M"}   | ${"days"}   | ${null}
    ${"2024-03-17T02:30:00-04:00[America/New_York]"} | ${"-PT167H20M"}   | ${"weeks"}  | ${null}
    ${"2024-03-17T02:30:00-04:00[America/New_York]"} | ${"-PT167H20M"}   | ${"months"} | ${-0.2407673860911271}
    ${"2024-03-17T02:30:00-04:00[America/New_York]"} | ${"-PT167H20M"}   | ${"years"}  | ${-0.019049787492410444}
    ${"2024-04-11T02:30:00-04:00[America/New_York]"} | ${"-P31DT23H20M"} | ${"days"}   | ${null}
    ${"2024-04-11T02:30:00-04:00[America/New_York]"} | ${"-P31DT23H20M"} | ${"weeks"}  | ${-4.570858283433134}
    ${"2024-04-11T02:30:00-04:00[America/New_York]"} | ${"-P31DT23H20M"} | ${"months"} | ${-1.0335731414868106}
    ${"2024-04-11T02:30:00-04:00[America/New_York]"} | ${"-P31DT23H20M"} | ${"years"}  | ${-0.08735579842137219}
    ${PHOENIX_ORIGIN}                                | ${"PT15M"}        | ${"days"}   | ${null}
    ${PHOENIX_ORIGIN}                                | ${"PT15M"}        | ${"weeks"}  | ${null}
    ${PHOENIX_ORIGIN}                                | ${"PT15M"}        | ${"months"} | ${null}
    ${PHOENIX_ORIGIN}                                | ${"PT15M"}        | ${"years"}  | ${null}
    ${PHOENIX_ORIGIN}                                | ${"PT15M"}        | ${"hours"}  | ${0.25}
    ${PHOENIX_LATER}                                 | ${"-PT15M"}       | ${"days"}   | ${null}
    ${PHOENIX_LATER}                                 | ${"-PT15M"}       | ${"months"} | ${null}
  `(
    "$duration from $relativeTo in $unit is $total",
    ({ relativeTo, duration, unit, total }) => {
      expect(totalDuration(duration, unit, { relativeTo })).toBe(total);
    },
  );
});

describe("normalizeDuration with no spec value", () => {
  it.each`
    relativeTo                                       | duration        | options                                          | text
    ${ORIGIN}                                        | ${"PT24H30M"}   | ${{ smallestUnit: "day" }}                       | ${""}
    ${ORIGIN}                                        | ${"PT24H30M"}   | ${{ largestUnit: "day" }}                        | ${"PT24H30M"}
    ${ORIGIN}                                        | ${"PT24H30M"}   | ${{ largestUnit: "week", smallestUnit: "week" }} | ${"PT0S"}
    ${"2024-10-27T01:30:00-04:00[America/New_York]"} | ${"PT168H30M"}  | ${{ smallestUnit: "day" }}                       | ${""}
    ${"2024-10-27T01:30:00-04:00[America/New_York]"} | ${"PT168H30M"}  | ${{ largestUnit: "week", smallestUnit: "week" }} | ${""}
    ${"2024-10-27T01:30:00-04:00[America/New_York]"} | ${"PT168H30M"}  | ${{ largestUnit: "day" }}                        | ${"P6DT24H30M"}
    ${GAP_ORIGIN}                                    | ${"-PT23H20M"}  | ${{ smallestUnit: "day" }}                       | ${""}
    ${GAP_ORIGIN}                                    | ${"-PT23H20M"}  | ${{ largestUnit: "day" }}                        | ${"-PT23H20M"}
    ${"2024-03-17T02:30:00-04:00[America/New_York]"} | ${"-PT167H20M"} | ${{ smallestUnit: "day" }}                       | ${""}
    ${"2024-03-17T02:30:00-04:00[America/New_York]"} | ${"-PT167H20M"} | ${{ largestUnit: "week", smallestUnit: "week" }} | ${""}
    ${"2024-03-17T02:30:00-04:00[America/New_York]"} | ${"-PT167H20M"} | ${{ largestUnit: "day" }}                        | ${"-P6DT23H20M"}
    ${PHOENIX_ORIGIN}                                | ${"PT15M"}      | ${{ smallestUnit: "day" }}                       | ${""}
    ${PHOENIX_ORIGIN}                                | ${"PT15M"}      | ${{ smallestUnit: "month" }}                     | ${""}
    ${PHOENIX_ORIGIN}                                | ${"PT15M"}      | ${{ largestUnit: "day" }}                        | ${""}
    ${PHOENIX_LATER}                                 | ${"-PT15M"}     | ${{ smallestUnit: "day" }}                       | ${""}
    ${PHOENIX_LATER}                                 | ${"-PT15M"}     | ${{ largestUnit: "day" }}                        | ${""}
  `(
    "$duration from $relativeTo with $options is '$text'",
    ({ relativeTo, duration, options, text }) => {
      expect(normalizeDuration(duration, { ...options, relativeTo })).toBe(
        text,
      );
    },
  );
});

describe("a difference measured from its first argument", () => {
  // `until` and `since` both measure from their receiver, and GMT passes the first argument as the
  // receiver. Only a smallestUnit builds a window, so without one the bare difference is the answer.
  it.each`
    from      | to        | units                | options                      | difference
    ${ORIGIN} | ${END}    | ${"days"}            | ${{ smallestUnit: "day" }}   | ${null}
    ${ORIGIN} | ${END}    | ${"weeks"}           | ${{ smallestUnit: "week" }}  | ${0}
    ${ORIGIN} | ${END}    | ${"months"}          | ${{ smallestUnit: "month" }} | ${0}
    ${ORIGIN} | ${END}    | ${"days"}            | ${undefined}                 | ${0}
    ${ORIGIN} | ${END}    | ${["days", "hours"]} | ${undefined}                 | ${{ days: 0, hours: 24 }}
    ${END}    | ${ORIGIN} | ${["days", "hours"]} | ${undefined}                 | ${{ days: 0, hours: -23 }}
  `(
    "diffZoned from $from to $to in $units with $options is $difference",
    ({ from, to, units, options, difference }) => {
      expect(diffZoned(from, to, units, options)).toEqual(difference);
    },
  );

  it("diffZoned from the later end back to the origin rounds inside its window", () => {
    // The window runs back from 06:00Z to 05:00Z the day before, and 05:30Z is inside it.
    expect(diffZoned(END, ORIGIN, "days", { smallestUnit: "day" })).toBe(0);
  });

  it.each`
    from      | to        | options                    | text
    ${ORIGIN} | ${END}    | ${{ smallestUnit: "day" }} | ${""}
    ${ORIGIN} | ${END}    | ${undefined}               | ${"PT24H30M"}
    ${END}    | ${ORIGIN} | ${{ smallestUnit: "day" }} | ${"PT0S"}
    ${END}    | ${ORIGIN} | ${undefined}               | ${"-PT23H30M"}
  `(
    "diffZonedAsDuration from $from to $to with $options is '$text'",
    ({ from, to, options, text }) => {
      expect(diffZonedAsDuration(from, to, "days", options)).toBe(text);
    },
  );

  it.each`
    start             | end            | unit        | length
    ${ORIGIN}         | ${END}         | ${"days"}   | ${null}
    ${ORIGIN}         | ${END}         | ${"weeks"}  | ${0.14497041420118342}
    ${ORIGIN}         | ${END}         | ${"months"} | ${0.03398058252427184}
    ${PHOENIX_ORIGIN} | ${PHOENIX_END} | ${"days"}   | ${null}
    ${PHOENIX_ORIGIN} | ${PHOENIX_END} | ${"months"} | ${null}
  `(
    "intervalLengthZoned from $start to $end in $unit is $length",
    ({ start, end, unit, length }) => {
      expect(intervalLengthZoned(start, end, unit)).toBe(length);
    },
  );

  it("diffUnix in a zone with a day smallestUnit is null one way and a value the other", () => {
    const options = {
      timeZone: NEW_YORK,
      epochUnit: "milliseconds",
      smallestUnit: "day",
    } as const;
    expect(diffUnix(ORIGIN_MS, END_MS, "days", options)).toBeNull();
    expect(diffUnix(END_MS, ORIGIN_MS, "days", options)).toBe(0);
  });

  it("diffUnix in a zone without a smallestUnit keeps the bare difference", () => {
    expect(
      diffUnix(ORIGIN_MS, END_MS, "days", {
        timeZone: NEW_YORK,
        epochUnit: "milliseconds",
      }),
    ).toBe(0);
  });

  it("diffUnixAsDuration in a zone with a day smallestUnit is '' one way and a value the other", () => {
    const options = {
      timeZone: NEW_YORK,
      epochUnit: "milliseconds",
      smallestUnit: "day",
    } as const;
    expect(diffUnixAsDuration(ORIGIN_MS, END_MS, "days", options)).toBe("");
    expect(diffUnixAsDuration(END_MS, ORIGIN_MS, "days", options)).toBe("PT0S");
  });

  it.each`
    start        | end       | unit       | length
    ${ORIGIN_MS} | ${END_MS} | ${"days"}  | ${null}
    ${ORIGIN_MS} | ${END_MS} | ${"weeks"} | ${0.14497041420118342}
  `(
    "intervalLengthUnix in a zone from $start to $end in $unit is $length",
    ({ start, end, unit, length }) => {
      expect(
        intervalLengthUnix(start, end, unit, {
          timeZone: NEW_YORK,
          epochUnit: "milliseconds",
        }),
      ).toBe(length);
    },
  );

  it("the UTC family has no transition, so a day is 24 hours and the window always holds", () => {
    expect(diffUtc(ORIGIN_UTC, END_UTC, "days", { smallestUnit: "day" })).toBe(
      1,
    );
    expect(intervalLengthUtc(ORIGIN_UTC, END_UTC, "days")).toBe(24.5 / 24);
  });
});

/**
 * One row per group of the zone scans in `context/domination/js-temporal-polyfill-bugs.md` § AC: an
 * origin instant, a zone and a length. The groups name where the end falls against the transition:
 *
 * - `dayBefore`: the origin is a day ahead of a repeated hour, and the end lands in its later pass.
 * - `before`: the origin precedes a 24-hour repeat (a zone moving across the date line).
 * - `earlier`: the origin is the earlier pass and the end falls on an earlier local date. The Assert in
 *   `CombineDateAndTimeDuration` fails.
 * - `later`: the origin is the later pass, running back past the transition. `DifferenceZonedDateTime`
 *   runs out of day corrections. Chromium keeps going and answers with the wrong sign (`PT45M` for
 *   `-PT15M`), which is an Assert failure all the same.
 */
describe("every public path returns its sentinel for each scan shape", () => {
  it.each`
    group          | instant                   | zone                    | seconds
    ${"dayBefore"} | ${"1980-10-30T00:30:00Z"} | ${"Africa/Algiers"}     | ${88200}
    ${"dayBefore"} | ${"1930-01-03T20:45:00Z"} | ${"Africa/Addis_Ababa"} | ${87300}
    ${"before"}    | ${"1892-07-03T11:22:47Z"} | ${"Pacific/Midway"}     | ${129600}
    ${"earlier"}   | ${"1944-10-01T06:00:59Z"} | ${"America/Creston"}    | ${900}
    ${"earlier"}   | ${"1944-10-01T06:00:59Z"} | ${PHOENIX}              | ${900}
    ${"earlier"}   | ${"1867-10-18T12:31:13Z"} | ${"America/Adak"}       | ${43200}
    ${"later"}     | ${"1867-10-19T00:31:13Z"} | ${"America/Adak"}       | ${-21600}
    ${"before"}    | ${"1867-10-18T00:31:12Z"} | ${"America/Adak"}       | ${129600}
    ${"dayBefore"} | ${"1867-10-17T12:31:13Z"} | ${"America/Adak"}       | ${129600}
    ${"later"}     | ${"1944-10-01T07:00:59Z"} | ${"America/Creston"}    | ${-900}
    ${"later"}     | ${"1867-10-19T12:31:13Z"} | ${"America/Adak"}       | ${-21600}
  `(
    "$group: $instant in $zone for $seconds seconds",
    ({ instant, zone, seconds }) => {
      const startMs = Temporal.Instant.from(instant).epochMilliseconds;
      const endMs = startMs + seconds * 1000;
      const start = zonedAt(startMs, zone);
      const end = zonedAt(endMs, zone);
      const duration = `${seconds < 0 ? "-" : ""}PT${Math.abs(seconds)}S`;
      const unixOptions = {
        timeZone: zone,
        epochUnit: "milliseconds",
        smallestUnit: "day",
      } as const;

      expect({
        total: totalDuration(duration, "days", { relativeTo: start }),
        normalize: normalizeDuration(duration, {
          smallestUnit: "day",
          relativeTo: start,
        }),
        diffZoned: diffZoned(start, end, "days", { smallestUnit: "day" }),
        diffZonedAsDuration: diffZonedAsDuration(start, end, "days", {
          smallestUnit: "day",
        }),
        intervalLengthZoned: intervalLengthZoned(start, end, "days"),
        diffUnix: diffUnix(startMs, endMs, "days", unixOptions),
        diffUnixAsDuration: diffUnixAsDuration(
          startMs,
          endMs,
          "days",
          unixOptions,
        ),
        intervalLengthUnix: intervalLengthUnix(startMs, endMs, "days", {
          timeZone: zone,
          epochUnit: "milliseconds",
        }),
      }).toEqual({
        total: null,
        normalize: "",
        diffZoned: null,
        diffZonedAsDuration: "",
        intervalLengthZoned: null,
        diffUnix: null,
        diffUnixAsDuration: "",
        intervalLengthUnix: null,
      });
    },
  );
});

describe("a skipped day leaves the day span empty", () => {
  // Enderbury skipped 1994-12-31. One day back from 1995-01-01T12:00 is in that gap and resolves to the
  // origin itself, so TC39 NudgeToZonedTime's Assert on the day span's sign fails.
  // Same-date difference without a smallestUnit: no span is built, and the bare difference stands.
  const SKIPPED = "1995-01-01T12:00:00+13:00[Pacific/Enderbury]";

  it.each`
    options                                           | text
    ${{ largestUnit: "day", smallestUnit: "minute" }} | ${""}
    ${{ largestUnit: "day" }}                         | ${"-PT11H59M59S"}
  `(
    "normalizeDuration of -PT43199S with $options is '$text'",
    ({ options, text }) => {
      expect(
        normalizeDuration("-PT43199S", { ...options, relativeTo: SKIPPED }),
      ).toBe(text);
    },
  );

  it("totalDuration of -PT43199S in days is null", () => {
    expect(
      totalDuration("-PT43199S", "days", { relativeTo: SKIPPED }),
    ).toBeNull();
  });
});

describe("formatRelative without a forced unit", () => {
  // 168:30 from 2024-10-27T01:30-04:00 picks weeks on its own. The week window ends at 2024-11-03T01:30-04:00,
  // and the target is 30 minutes past it, in the later pass. The polyfill read "next week".
  it("returns '' when the unit it picks has no value", () => {
    expect(
      formatRelativeZoned(
        "2024-11-03T01:00:00-05:00[America/New_York]",
        "en-US",
        {
          reference: "2024-10-27T01:30:00-04:00[America/New_York]",
        },
      ),
    ).toBe("");
  });

  it("keeps the value of a unit it picks inside the window", () => {
    expect(formatRelativeZoned(END, "en-US", { reference: ORIGIN })).toBe(
      "tomorrow",
    );
  });
});

describe("formatRelative with a forced unit", () => {
  // A forced day totals 24-hour days without a relativeTo, so it builds no window and keeps its value.
  // A forced week, month or year reads the anchor.
  const WEEK = { largestUnit: "week", numeric: "always" } as const;
  const MONTH = { largestUnit: "month", numeric: "always" } as const;
  const DAY = { largestUnit: "day", numeric: "always" } as const;

  // 167:20 back from 2024-03-17T02:30-04:00, which the week window cannot hold.
  const WEEK_REFERENCE = "2024-03-17T02:30:00-04:00[America/New_York]";
  const WEEK_REFERENCE_UTC = "2024-03-17T06:30:00Z";
  const WEEK_TARGET = "2024-03-10T03:10:00-04:00[America/New_York]";
  const WEEK_TARGET_UTC = "2024-03-10T07:10:00Z";
  const WEEK_TARGET_MS = 1_710_054_600_000;

  it.each`
    target         | reference         | options  | text
    ${WEEK_TARGET} | ${WEEK_REFERENCE} | ${WEEK}  | ${""}
    ${WEEK_TARGET} | ${WEEK_REFERENCE} | ${DAY}   | ${"7 days ago"}
    ${WEEK_TARGET} | ${WEEK_REFERENCE} | ${MONTH} | ${"0 months ago"}
    ${PHOENIX_END} | ${PHOENIX_ORIGIN} | ${MONTH} | ${""}
    ${PHOENIX_END} | ${PHOENIX_ORIGIN} | ${WEEK}  | ${""}
    ${END}         | ${ORIGIN}         | ${DAY}   | ${"in 1 day"}
  `(
    "formatRelativeZoned of $target from $reference with $options is '$text'",
    ({ target, reference, options, text }) => {
      expect(
        formatRelativeZoned(target, "en-US", { ...options, reference }),
      ).toBe(text);
    },
  );

  it.each`
    options  | text
    ${WEEK}  | ${""}
    ${DAY}   | ${"7 days ago"}
    ${MONTH} | ${"0 months ago"}
  `(
    "formatRelativeUtc in New York with $options is '$text'",
    ({ options, text }) => {
      expect(
        formatRelativeUtc(WEEK_TARGET_UTC, "en-US", {
          ...options,
          reference: WEEK_REFERENCE_UTC,
          timeZone: NEW_YORK,
        }),
      ).toBe(text);
    },
  );

  it.each`
    options  | text
    ${WEEK}  | ${""}
    ${DAY}   | ${"7 days ago"}
    ${MONTH} | ${"0 months ago"}
  `(
    "formatRelativeUnix in New York with $options is '$text'",
    ({ options, text }) => {
      expect(
        formatRelativeUnix(WEEK_TARGET_MS, "en-US", {
          ...options,
          reference: WEEK_REFERENCE_UTC,
          timeZone: NEW_YORK,
          epochUnit: "milliseconds",
        }),
      ).toBe(text);
    },
  );
});

/** The zoned string for an exact time, built with `Temporal`, not with a GMT function. */
function zonedAt(epochMs: number, zone: string): string {
  return Temporal.Instant.fromEpochMilliseconds(epochMs)
    .toZonedDateTimeISO(zone)
    .toString();
}
