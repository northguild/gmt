import { parseBusinessCalendar, resolveParts } from "./businessCalendar";
import { easterEpochDay } from "./easter";
import { epochDayOf, MAX_EPOCH_DAY, MIN_EPOCH_DAY } from "./epochDay";
import {
  holidayEpochDays,
  parseHolidayRule,
  ruleNeedsCalendar,
  type ResolvedHolidayRule,
} from "./holidayRules";

function resolve(rule: unknown): ResolvedHolidayRule {
  const resolved = parseHolidayRule(rule);

  if (resolved === null) {
    throw new Error("expected a valid rule");
  }

  return resolved;
}

describe("parseHolidayRule", () => {
  it.each`
    rule                                                                                                                      | needsCalendar
    ${{ name: "x", kind: "fixed", month: 1, day: 1 }}                                                                         | ${false}
    ${{ name: "x", kind: "fixed", month: 1, day: 1, observed: { 6: { next: 1 } } }}                                           | ${false}
    ${{ name: "x", kind: "fixed", month: 1, day: 1, observed: { 6: "nextWorkingDay" } }}                                      | ${true}
    ${{ name: "x", kind: "calendarFixed", calendar: "hebrew", monthCode: "M07", day: 15, observed: { 4: "nextWorkingDay" } }} | ${true}
    ${{ name: "x", kind: "nthWeekday", month: 1, weekday: 1, n: 1 }}                                                          | ${false}
    ${{ name: "x", kind: "easterRelative", offsetDays: 1 }}                                                                   | ${false}
    ${{ name: "x", kind: "dates", dates: [] }}                                                                                | ${false}
  `(
    "rule $rule needs a calendar: $needsCalendar",
    ({ rule, needsCalendar }) => {
      expect(ruleNeedsCalendar(resolve(rule))).toBe(needsCalendar);
    },
  );

  it("rejects an object with a hostile prototype-free shape", () => {
    expect(parseHolidayRule(Object.create(null))).toBeNull();
  });
});

describe("holidayEpochDays easterRelative candidate search", () => {
  // Brute force: every Easter of years Y-12..Y+12 plus the offset (a Julian date drifts from ISO by up to
  // about 2,000 days at years +-270000, so the spec's Y-3..Y+3 would miss some), kept when it lies in year Y.
  // Each row reuses one Easter per computus year, so the brute force stays cheap across 801 offsets.
  function easterTable(
    years: [number, number],
    computus: "gregorian" | "julian",
  ): Map<number, number | null> {
    const table = new Map<number, number | null>();

    for (let c = years[0] - 12; c <= years[1] + 12; c++) {
      table.set(c, easterEpochDay(c, computus));
    }

    return table;
  }

  function brute(
    offsetDays: number,
    year: number,
    easters: Map<number, number | null>,
  ): number[] {
    const first = epochDayOf(year, 1, 1);
    const last = epochDayOf(year, 12, 31);
    const found: number[] = [];

    for (let c = year - 12; c <= year + 12; c++) {
      const easter = easters.get(c) ?? null;

      if (easter === null) {
        continue;
      }

      const day = easter + offsetDays;

      if (
        day >= first &&
        day <= last &&
        day >= MIN_EPOCH_DAY &&
        day <= MAX_EPOCH_DAY
      ) {
        found.push(day);
      }
    }

    return found.sort((a, b) => a - b);
  }

  it.each`
    computus       | years
    ${"gregorian"} | ${[1900, 2100]}
    ${"julian"}    | ${[1900, 2100]}
    ${"gregorian"} | ${[270000, 270030]}
    ${"julian"}    | ${[270000, 270030]}
    ${"gregorian"} | ${[-270030, -270000]}
    ${"julian"}    | ${[-270030, -270000]}
  `(
    "finds exactly the brute-force dates for $computus, years $years, offsets -400..400",
    ({ computus, years }) => {
      const easters = easterTable(years, computus);
      const mismatches: string[] = [];

      for (let year = years[0]; year <= years[1]; year++) {
        for (let offsetDays = -400; offsetDays <= 400; offsetDays++) {
          const rule = resolve({
            name: "x",
            kind: "easterRelative",
            offsetDays,
            computus,
          });
          const got = holidayEpochDays(rule, year, null);
          const want = brute(offsetDays, year, easters);

          if (JSON.stringify(got) !== JSON.stringify(want)) {
            mismatches.push(
              `year ${year}, offset ${offsetDays}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`,
            );
          }
        }
      }

      expect(mismatches).toEqual([]);
    },
  );
});

describe("holidayEpochDays easterRelative at very large offsets", () => {
  // Brute force over a wide window centred on the computus year the offset implies. A Julian Easter
  // drifts from ISO by a day per century, so at these offsets the right computus year is far from the
  // naive estimate; a window of +-60 years is far wider than the drift can move it.
  function bruteWide(
    offsetDays: number,
    year: number,
    computus: "gregorian" | "julian",
  ): number[] {
    const first = epochDayOf(year, 1, 1);
    const last = epochDayOf(year, 12, 31);
    const centre = year - Math.round(offsetDays / 365.2425);
    const found: number[] = [];

    for (let c = centre - 60; c <= centre + 60; c++) {
      const easter = easterEpochDay(c, computus);

      if (easter === null) {
        continue;
      }

      const day = easter + offsetDays;

      if (
        day >= first &&
        day <= last &&
        day >= MIN_EPOCH_DAY &&
        day <= MAX_EPOCH_DAY
      ) {
        found.push(day);
      }
    }

    return found.sort((a, b) => a - b);
  }

  it("finds the Julian Easter 50,000,000 days before 2026 (epoch day 20743, 2026-10-17)", () => {
    const rule = resolve({
      name: "x",
      kind: "easterRelative",
      offsetDays: -50_000_000,
      computus: "julian",
    });

    expect(holidayEpochDays(rule, 2026, null)).toEqual([20_743]);
  });

  it("finds the Julian Easter when the estimate alternates between computus years 28899 and 28900", () => {
    // Expected value from a brute-force scan of Meeus Julian Easters around the implied year.
    const rule = resolve({
      name: "x",
      kind: "easterRelative",
      offsetDays: -10_555_458,
      computus: "julian",
    });

    expect(holidayEpochDays(rule, 0, null)).toEqual([epochDayOf(0, 12, 20)]);
  });

  it.each`
    computus       | offsetDays
    ${"julian"}    | ${-150_000_000}
    ${"julian"}    | ${-100_000_000}
    ${"julian"}    | ${-50_000_000}
    ${"julian"}    | ${-49_999_999}
    ${"julian"}    | ${50_000_000}
    ${"julian"}    | ${100_000_000}
    ${"julian"}    | ${150_000_000}
    ${"gregorian"} | ${-150_000_000}
    ${"gregorian"} | ${-50_000_000}
    ${"gregorian"} | ${50_000_000}
    ${"gregorian"} | ${150_000_000}
  `(
    "matches the wide brute force for $computus at offset $offsetDays",
    ({ computus, offsetDays }) => {
      for (let year = 2020; year <= 2060; year++) {
        const rule = resolve({
          name: "x",
          kind: "easterRelative",
          offsetDays,
          computus,
        });

        expect(holidayEpochDays(rule, year, null)).toEqual(
          bruteWide(offsetDays, year, computus),
        );
      }
    },
  );
});

describe("holidayEpochDays shifts", () => {
  const calendar = parseBusinessCalendar({
    weekend: [6, 7],
    holidays: [],
    timeZone: "UTC",
  });

  it.each`
    maxShiftDays | expected
    ${Infinity}  | ${[epochDayOf(2026, 12, 28)]}
    ${3}         | ${[epochDayOf(2026, 12, 28)]}
    ${2}         | ${null}
  `(
    "Friday 2026-12-25 to the next working day with maxShiftDays $maxShiftDays gives $expected",
    ({ maxShiftDays, expected }) => {
      const rule = resolve({
        name: "x",
        kind: "fixed",
        month: 12,
        day: 25,
        observed: { 5: "nextWorkingDay" },
      });

      expect(holidayEpochDays(rule, 2026, calendar, maxShiftDays)).toEqual(
        expected,
      );
    },
  );

  it("returns null for a nextWorkingDay shift without a calendar", () => {
    const rule = resolve({
      name: "x",
      kind: "fixed",
      month: 12,
      day: 25,
      observed: { 5: "nextWorkingDay" },
    });

    expect(holidayEpochDays(rule, 2026, null)).toBeNull();
  });

  // skipOutOfRange drops only days past Temporal's range; a walk that fails inside it stays a failure.
  it.each`
    calendar                                                          | why
    ${resolveParts(new Set([1, 2, 3, 4, 5, 6, 7]), new Int32Array())} | ${"a walk that never finds a working day"}
    ${null}                                                           | ${"no calendar"}
  `("returns null with skipOutOfRange for $why", ({ calendar }) => {
    const rule = resolve({
      name: "x",
      kind: "fixed",
      month: 12,
      day: 25,
      observed: { 5: "nextWorkingDay" },
    });

    expect(holidayEpochDays(rule, 2026, calendar, Infinity, true)).toBeNull();
  });

  it("drops a { next } shift past the maximum with skipOutOfRange", () => {
    // +275760-09-13 is a Saturday; the next Monday is past the limit.
    const rule = resolve({
      name: "x",
      kind: "fixed",
      month: 9,
      day: 13,
      observed: { 6: { next: 1 } },
    });

    expect(holidayEpochDays(rule, 275_760, null, Infinity, true)).toEqual([]);
    expect(holidayEpochDays(rule, 275_760, null)).toBeNull();
  });

  it("emits the observed date of two occurrences sorted without repeats", () => {
    // Islamic 1420 and 1421 both start Shawwal in 2000; Saturday 2000-01-08 and Thursday
    // 2000-12-28 move to Monday and the next Monday.
    const rule = resolve({
      name: "x",
      kind: "calendarFixed",
      calendar: "islamic-civil",
      monthCode: "M10",
      day: 1,
      observed: { 6: { next: 1 }, 4: { next: 1 } },
    });

    expect(holidayEpochDays(rule, 2000, null)).toEqual([
      epochDayOf(2000, 1, 10),
      epochDayOf(2001, 1, 1),
    ]);
  });
});

describe("holidayEpochDays at calendar year edges", () => {
  // Exact Hebrew dates at the Temporal limits, from Dershowitz and Reingold, Calendrical Calculations,
  // `hebrew-new-year` (Tishri 1) and the month lengths that follow it. M01 is Tishri, M06 Elul, M07 Nisan.
  it.each`
    year       | monthCode | day   | expected
    ${-271821} | ${"M01"}  | ${1}  | ${[epochDayOf(-271821, 6, 14)]}
    ${-271821} | ${"M06"}  | ${1}  | ${[epochDayOf(-271821, 12, 8)]}
    ${-271821} | ${"M07"}  | ${15} | ${[]}
    ${275760}  | ${"M07"}  | ${15} | ${[epochDayOf(275760, 7, 20)]}
    ${275760}  | ${"M07"}  | ${1}  | ${[epochDayOf(275760, 7, 6)]}
    ${275760}  | ${"M06"}  | ${1}  | ${[epochDayOf(275760, 6, 7)]}
    ${275760}  | ${"M01"}  | ${1}  | ${[]}
  `(
    "hebrew $monthCode $day in ISO year $year is $expected",
    ({ year, monthCode, day, expected }) => {
      const rule = resolve({
        name: "x",
        kind: "calendarFixed",
        calendar: "hebrew",
        monthCode,
        day,
      });

      expect(holidayEpochDays(rule, year, null)).toEqual(expected);
    },
  );
});

describe("parseHolidayRule calendar resolution", () => {
  it.each`
    calendar                 | calendarId
    ${"islamicc"}            | ${"islamic-civil"}
    ${"Islamic-Civil"}       | ${"islamic-civil"}
    ${"ethiopic-amete-alem"} | ${"ethioaa"}
    ${"ethiopic"}            | ${"ethioaa"}
    ${"coptic"}              | ${"ethioaa"}
    ${"hebrew"}              | ${"hebrew"}
    ${"gregory"}             | ${"gregory"}
  `(
    "calendarFixed $calendar is computed in $calendarId",
    ({ calendar, calendarId }) => {
      expect(
        resolve({
          name: "x",
          kind: "calendarFixed",
          calendar,
          monthCode: "M01",
          day: 1,
        }),
      ).toMatchObject({ kind: "calendarFixed", calendarId });
    },
  );

  it("resolves an omitted computus to gregorian", () => {
    expect(
      resolve({ name: "x", kind: "easterRelative", offsetDays: 3 }),
    ).toEqual({ kind: "easterRelative", offsetDays: 3, computus: "gregorian" });
  });
});

describe("holidayEpochDays at the end of the range", () => {
  it.each`
    calendar
    ${"hebrew"}
    ${"islamic-civil"}
    ${"persian"}
  `(
    "calendarFixed $calendar in 275760 stays in that year and never throws",
    ({ calendar }) => {
      const rule = resolve({
        name: "x",
        kind: "calendarFixed",
        calendar,
        monthCode: "M01",
        day: 1,
      });
      const days = holidayEpochDays(rule, 275760, null);

      expect(days).not.toBeNull();
      for (const day of days ?? []) {
        expect(day).toBeGreaterThanOrEqual(epochDayOf(275760, 1, 1));
        expect(day).toBeLessThanOrEqual(MAX_EPOCH_DAY);
      }
    },
  );
});
