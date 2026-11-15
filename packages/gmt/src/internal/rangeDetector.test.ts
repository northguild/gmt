import { Temporal } from "./temporal";
import { type RangeSource, rangeVerdict } from "./rangeDetector";

/*
 * CORE-112 slice 7, D29: the detector on synthetic formatters, so no engine's data decides the
 * answer. Each source prints a date as `weekday d/m/y` (or a part of it) and a range as its own
 * pattern; the rule is ECMA-402 PartitionDateTimeRangePattern and UTS #35 Part 4 (Interval
 * Formats): each date's part of a range holds every field its single prints.
 */

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const at = (t: number): Temporal.ZonedDateTime =>
  Temporal.Instant.fromEpochMilliseconds(t).toZonedDateTimeISO("UTC");
const day = (t: number): string => DAYS[at(t).dayOfWeek % 7] ?? "";
const date = (t: number): number => at(t).day;
const month = (t: number): string => MONTHS[at(t).month - 1] ?? "";
const year = (t: number): number => at(t).year;
const single = (t: number): string =>
  `${day(t)} ${date(t)} ${month(t)} ${year(t)}`;

/** A source whose range is the two singles (the fallback), or the pattern `range` gives. */
function source(range: (a: number, b: number) => string): RangeSource {
  return { format: single, formatRange: range };
}

const fallback = (a: number, b: number): string =>
  `${single(a)} – ${single(b)}`;

describe("rangeVerdict on synthetic formatters", () => {
  it.each`
    label                                     | range                                                                           | flagged
    ${"the fallback of two singles"}          | ${fallback}                                                                     | ${false}
    ${"an end that drops its weekday"}        | ${(a: number, b: number) => `${single(a)} – ${date(b)} ${month(b)} ${year(b)}`} | ${true}
    ${"an end that drops its year"}           | ${(a: number, b: number) => `${single(a)} – ${day(b)} ${date(b)} ${month(b)}`}  | ${true}
    ${"an end that prints its weekday twice"} | ${(a: number, b: number) => `${single(a)} – ${single(b)} ${day(b)}`}            | ${true}
    ${"a start that drops its month"}         | ${(a: number, b: number) => `${day(a)} ${date(a)} ${year(a)} – ${single(b)}`}   | ${true}
  `("$label: flagged is $flagged", ({ range, flagged }) => {
    expect(rangeVerdict(source(range), "gregory").flagged).toBe(flagged);
  });

  it("flags a range that puts the start's year after the joiner", () => {
    const text = (a: number, b: number): string =>
      `${day(a)} ${month(a)} – ${year(a)} ${day(b)} ${month(b)} ${year(b)}`;
    const verdict = rangeVerdict(
      {
        format: (t) => `${day(t)} ${month(t)} ${year(t)}`,
        formatRange: text,
      },
      "gregory",
    );
    expect(verdict).toMatchObject({ flagged: true, kind: "order" });
  });

  it("accepts a range that prints a year both dates share once, after the end (UTS #35 Part 4: a shared field may print once)", () => {
    const verdict = rangeVerdict(
      {
        format: (t) => `${day(t)} ${date(t)} ${month(t)} ${year(t)}`,
        formatRange: (a, b) =>
          year(a) === year(b)
            ? `${day(a)} ${date(a)} ${month(a)} – ${single(b)}`
            : fallback(a, b),
      },
      "gregory",
    );
    expect(verdict.flagged).toBe(false);
  });

  it("accepts the same fields in the same order with the start's year before the joiner", () => {
    const verdict = rangeVerdict(
      {
        format: (t) => `${day(t)} ${month(t)} ${year(t)}`,
        formatRange: (a, b) =>
          `${day(a)} ${month(a)} ${year(a)} – ${day(b)} ${month(b)} ${year(b)}`,
      },
      "gregory",
    );
    expect(verdict.flagged).toBe(false);
  });

  it("answers per formatter: a source whose single and range agree is not flagged for the japanese era pair either", () => {
    expect(rangeVerdict(source(fallback), "japanese").flagged).toBe(false);
  });

  it("accepts a time-only single whose range adds each end's date before its time", () => {
    const time = (t: number): string =>
      `${String(at(t).hour).padStart(2, "0")}:${String(at(t).minute).padStart(2, "0")}`;
    const withDate = (t: number): string =>
      `${date(t)}/${at(t).month}/${year(t)} ${time(t)}`;
    const verdict = rangeVerdict(
      {
        format: time,
        formatRange: (a, b) => `${withDate(a)} – ${withDate(b)}`,
      },
      "gregory",
    );
    expect(verdict.flagged).toBe(false);
  });
  describe("a twelve-hour time whose range prints a day period once", () => {
    const clock = (t: number): string => {
      const h = at(t).hour % 12 === 0 ? 12 : at(t).hour % 12;
      return `${h}:${String(at(t).minute).padStart(2, "0")}`;
    };
    const period = (t: number): string => (at(t).hour < 12 ? "AM" : "PM");
    // The single names the zone in full and the range writes `UTC`, as an engine's range pattern may.
    const zone = "Coordinated Universal Time";
    const timeOnly = (t: number): string => `${clock(t)} ${period(t)} ${zone}`;

    it("accepts a range that writes a period the two dates share once (UTS #35 Part 4: `1:25-4:40 PM`)", () => {
      const verdict = rangeVerdict(
        {
          format: timeOnly,
          formatRange: (a, b) =>
            period(a) === period(b)
              ? `${clock(a)}\u2013${clock(b)} ${period(b)} UTC`
              : `${clock(a)} ${period(a)} \u2013 ${clock(b)} ${period(b)} UTC`,
        },
        "gregory",
      );
      expect(verdict.flagged).toBe(false);
    });

    it("flags a range whose start loses its AM when the end is PM (`9:25 - 4:40 PM`)", () => {
      const verdict = rangeVerdict(
        {
          format: timeOnly,
          formatRange: (a, b) =>
            period(a) === period(b)
              ? `${clock(a)}\u2013${clock(b)} ${period(b)} UTC`
              : `${clock(a)} \u2013 ${clock(b)} ${period(b)} UTC`,
        },
        "gregory",
      );
      expect(verdict).toMatchObject({ flagged: true, kind: "absent" });
    });
  });
  it("accepts a range whose pattern repeats a literal the start's own era text holds (`antes de RDC` and `jul de 2012`)", () => {
    const era = (t: number): string =>
      year(t) < 1 ? `${1 - year(t)} antes de RDC` : `${year(t)} minguo`;
    const verdict = rangeVerdict(
      {
        format: (t) => `${month(t)} ${era(t)}`,
        formatRange: (a, b) =>
          `${month(a)} de ${era(a)} \u2013 ${month(b)} de ${era(b)}`,
      },
      "gregory",
    );
    expect(verdict.flagged).toBe(false);
  });
  it("accepts a range that writes a narrow month as a number (UTS #35 Part 4: an interval pattern may use another width)", () => {
    // A narrow weekday and a narrow month share letters (`M` is Mittwoch and Mai), the way a
    // German-family locale writes them.
    const weekday = (t: number): string =>
      ["S", "M", "D", "M", "D", "F", "S"][at(t).dayOfWeek % 7] ?? "";
    const narrow = (t: number): string => "JFMAMJJASOND"[at(t).month - 1] ?? "";
    const pad = (n: number): string => String(n).padStart(2, "0");
    const iso = (t: number): string =>
      `${year(t)}-${pad(at(t).month)}-${pad(date(t))}`;
    const verdict = rangeVerdict(
      {
        format: (t) => `${weekday(t)} ${date(t)}. ${narrow(t)}. ${year(t)}`,
        formatRange: (a, b) =>
          `${weekday(a)} ${iso(a)} \u2013 ${weekday(b)} ${iso(b)}`,
      },
      "gregory",
    );
    expect(verdict.flagged).toBe(false);
  });
  it("accepts a range whose joiner is a comma and whose dates hold a hyphen of their own (`Wed, 15-5, Thu 20-6`)", () => {
    const dated = (t: number): string => `${day(t)}, ${date(t)}-${at(t).month}`;
    const verdict = rangeVerdict(
      {
        format: dated,
        formatRange: (a, b) =>
          `${dated(a)}, ${day(b)} ${date(b)}-${at(b).month}`,
      },
      "gregory",
    );
    expect(verdict.flagged).toBe(false);
  });
  describe("a range that is the two singles joined", () => {
    it("is accepted with only the probe calls (no endpoint lost, so no move is tried)", () => {
      let calls = 0;
      const verdict = rangeVerdict(
        {
          format: (t) => {
            calls++;
            return single(t);
          },
          formatRange: (a, b) => {
            calls++;
            return fallback(a, b);
          },
        },
        "gregory",
      );
      expect(verdict.flagged).toBe(false);
      // 10 probe pairs, each one range and two singles.
      expect(calls).toBeLessThanOrEqual(30);
    });

    it("is still tried over a sexagenary cycle in the chinese calendar (a cyclic year may garble only there)", () => {
      // The single names a year of the 60-year cycle (the year modulo 60); a range that moved by a
      // whole cycle prints the related year, another value for the same field.
      const cycle = (t: number): number => (year(t) % 60) + 1;
      const text = (t: number): string =>
        `${cycle(t)}/${at(t).month}/${date(t)}`;
      const verdict = rangeVerdict(
        {
          format: text,
          formatRange: (a, b) =>
            year(a) < 1990
              ? `${year(a)}/${at(a).month}/${date(a)} \u2013 ${year(b)}/${at(b).month}/${date(b)}`
              : `${text(a)} \u2013 ${text(b)}`,
        },
        "chinese",
      );
      expect(verdict.flagged).toBe(true);
    });
  });
});

describe("rangeVerdict names the greatest differing fields whose range is wrong", () => {
  /** Right for every pair but one whose dates differ only by day: that range loses the end's weekday. */
  const dropsWeekdayOfDayRange = (a: number, b: number): string => {
    if (single(a) === single(b)) {
      return single(a);
    }
    return at(a).month === at(b).month && at(a).year === at(b).year
      ? `${single(a)} \u2013 ${date(b)} ${month(b)} ${year(b)}`
      : fallback(a, b);
  };

  it("reports only the day class when only a day-apart range is wrong", () => {
    expect(
      rangeVerdict(source(dropsWeekdayOfDayRange), "gregory").classes,
    ).toEqual(["d"]);
  });

  it("reports no class for a source whose ranges are all the fallback", () => {
    expect(rangeVerdict(source(fallback), "gregory").classes).toEqual([]);
  });
});

describe("rangeVerdict reports each class of the greatest differing field on its own", () => {
  // A single prints every field of an instant; a range is the two singles, except that a range
  // whose greatest differing field is `broken` drops that field from the end's text (UTS #35 Part 4:
  // each class has its own interval pattern, so a pattern may be wrong for one class only).
  const field = {
    y: (t: number) => `${year(t)}`,
    M: (t: number) => month(t),
    d: (t: number) => `${date(t)}d`,
    a: (t: number) => (at(t).hour < 12 ? "AM" : "PM"),
    h: (t: number) => `${at(t).hour % 12 === 0 ? 12 : at(t).hour % 12}h`,
    m: (t: number) => `${String(at(t).minute).padStart(2, "0")}m`,
  } as const;
  type Class = keyof typeof field;
  const order: readonly Class[] = ["y", "M", "d", "a", "h", "m"];

  const clock = (t: number, skip?: Class): string =>
    order
      .filter((key) => key !== skip)
      .map((key) => field[key](t))
      .join(" ");
  const greatest = (a: number, b: number): Class | undefined =>
    order.find((key) => field[key](a) !== field[key](b));

  // The era probe pair (a BC and an AD date) differs in the year too, so the year class also trips
  // the era class `G` here: this source has no era field to tell the two apart.
  it.each(
    order.map((broken) => ({
      broken,
      expected: broken === "y" ? ["y", "G"] : [broken],
    })),
  )(
    "a range that loses the end's field only when '$broken' is the greatest difference is flagged for $expected",
    ({ broken, expected }) => {
      const verdict = rangeVerdict(
        {
          format: (t) => clock(t),
          formatRange: (a, b) =>
            `${clock(a)} \u2013 ${clock(b, greatest(a, b) === broken ? broken : undefined)}`,
        },
        "gregory",
      );
      expect(verdict).toMatchObject({ flagged: true, classes: expected });
    },
  );

  it("reports no class for ranges that are the two singles in every class", () => {
    const verdict = rangeVerdict(
      {
        format: (t) => clock(t),
        formatRange: (a, b) => `${clock(a)} \u2013 ${clock(b)}`,
      },
      "gregory",
    );
    expect(verdict).toEqual({ flagged: false, classes: [] });
  });
});

describe("rangeVerdict separates the day-period class from the hour class", () => {
  // ECMA-402 Table 6 orders [[AmPm]], [[DayPeriod]], [[Hour]]. A source with a flexible day period
  // (night before 06:00, morning before 12:00, afternoon before 18:00, evening after) prints it in
  // every single; a range whose greatest differing field is `broken` drops the start's minutes.
  const periodOf = (t: number): string => {
    const hour = at(t).hour;
    if (hour < 6) {
      return "night";
    }
    if (hour < 12) {
      return "morning";
    }
    return hour < 18 ? "afternoon" : "evening";
  };
  const clock = (t: number, withMinutes = true): string =>
    `${at(t).hour % 12 === 0 ? 12 : at(t).hour % 12}${withMinutes ? `:${String(at(t).minute).padStart(2, "0")}` : ""} ${periodOf(t)}`;
  const greatest = (a: number, b: number): string => {
    if (Math.floor(a / 86_400_000) !== Math.floor(b / 86_400_000)) {
      return "d";
    }
    if (Math.floor(at(a).hour / 12) !== Math.floor(at(b).hour / 12)) {
      return "a";
    }
    if (periodOf(a) !== periodOf(b)) {
      return "B";
    }
    return at(a).hour === at(b).hour ? "m" : "h";
  };

  it.each`
    broken | expected
    ${"B"} | ${["B"]}
    ${"h"} | ${["h"]}
  `(
    "a range that drops the start's minutes only when '$broken' is the greatest difference is flagged for $expected",
    ({ broken, expected }) => {
      const verdict = rangeVerdict(
        {
          format: (t) => clock(t),
          dayPeriod: periodOf,
          formatRange: (a, b) =>
            `${clock(a, greatest(a, b) !== broken)} – ${clock(b)}`,
        },
        "gregory",
      );
      expect(verdict).toMatchObject({ flagged: true, classes: expected });
    },
  );

  it("does not flag a source whose ranges are the two singles in every class", () => {
    const verdict = rangeVerdict(
      {
        format: (t) => clock(t),
        dayPeriod: periodOf,
        formatRange: (a, b) => `${clock(a)} – ${clock(b)}`,
      },
      "gregory",
    );
    expect(verdict).toEqual({ flagged: false, classes: [] });
  });
});
