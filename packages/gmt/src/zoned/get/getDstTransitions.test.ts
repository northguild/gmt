import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones } from "../../test";
import { getDstTransitions } from ".";

describe("getDstTransitions", () => {
  it.each`
    timeZone
    ${"Not/AZone"}
    ${""}
    ${null}
    ${undefined}
    ${123}
    ${true}
  `("returns [] for invalid timeZone $timeZone", ({ timeZone }) => {
    expect(getDstTransitions(timeZone as never, 2024)).toEqual([]);
  });

  it.each`
    year
    ${"2024"}
    ${NaN}
    ${1.5}
    ${null}
    ${undefined}
    ${Infinity}
  `("returns [] for invalid year $year", ({ year }) => {
    expect(getDstTransitions("America/New_York", year as never)).toEqual([]);
  });

  it("returns exact transitions for America/New_York in 2024", () => {
    expect(getDstTransitions("America/New_York", 2024)).toEqual([
      {
        instant: "2024-03-10T07:00:00Z",
        offsetBefore: "-05:00",
        offsetAfter: "-04:00",
      },
      {
        instant: "2024-11-03T06:00:00Z",
        offsetBefore: "-04:00",
        offsetAfter: "-05:00",
      },
    ]);
  });

  it("returns exact transitions for Australia/Sydney in 2024 (southern hemisphere)", () => {
    expect(getDstTransitions("Australia/Sydney", 2024)).toEqual([
      {
        instant: "2024-04-06T16:00:00Z",
        offsetBefore: "+11:00",
        offsetAfter: "+10:00",
      },
      {
        instant: "2024-10-05T16:00:00Z",
        offsetBefore: "+10:00",
        offsetAfter: "+11:00",
      },
    ]);
  });

  it("returns [] for a zone with no transitions in the given year", () => {
    expect(getDstTransitions("Asia/Tokyo", 2024)).toEqual([]);
    expect(getDstTransitions("UTC", 2024)).toEqual([]);
  });

  it("returns 3 transitions for Africa/Casablanca in 2018 (Ramadan DST pause, historical rule change)", () => {
    const result = getDstTransitions("Africa/Casablanca", 2018);
    expect(result).toHaveLength(3);
    expect(result[0].offsetBefore).toBe("+00:00");
    expect(result[0].offsetAfter).toBe("+01:00");
    expect(result[1].offsetBefore).toBe("+01:00");
    expect(result[1].offsetAfter).toBe("+00:00");
    expect(result[2].offsetBefore).toBe("+00:00");
    expect(result[2].offsetAfter).toBe("+01:00");
  });

  // Transition count per battle-test zone in 2024, verified against @js-temporal/polyfill.
  const expectedTransitionsIn2024 = {
    UTC: 0,
    GMT: 0,
    "Etc/GMT": 0,
    "America/Nome": 2,
    "Asia/Anadyr": 0,
    "Europe/Lisbon": 2,
    "Europe/Dublin": 2,
    "Europe/Berlin": 2,
    "Europe/Helsinki": 2,
    "Europe/Istanbul": 0,
    "Asia/Kolkata": 0,
    "Asia/Kathmandu": 0,
    "Asia/Shanghai": 0,
    "Australia/Lord_Howe": 2,
    "Pacific/Chatham": 2,
    "Pacific/Apia": 0,
    "Pacific/Niue": 0,
    "America/New_York": 2,
    "America/Chicago": 2,
    "America/Phoenix": 0,
  } satisfies Record<(typeof battleTestTimeZones)[number], number>;

  it.each(
    battleTestTimeZones.map((timeZone) => ({
      timeZone,
      expected: expectedTransitionsIn2024[timeZone],
    })),
  )(
    "returns $expected transitions for battle-test timeZone $timeZone in 2024",
    ({ timeZone, expected }) => {
      expect(getDstTransitions(timeZone, 2024)).toHaveLength(expected);
    },
  );

  // Offset changes landing exactly on local 1 January 00:00 belong to the new year.
  it.each`
    timeZone                | year    | expected
    ${"Asia/Singapore"}     | ${1981} | ${[]}
    ${"Asia/Singapore"}     | ${1982} | ${[{ instant: "1981-12-31T16:00:00Z", offsetBefore: "+07:30", offsetAfter: "+08:00" }]}
    ${"Pacific/Kiritimati"} | ${1994} | ${[]}
    ${"Pacific/Kiritimati"} | ${1995} | ${[{ instant: "1994-12-31T10:00:00Z", offsetBefore: "-10:00", offsetAfter: "+14:00" }]}
  `(
    "reports a transition at local January 1 00:00 in $timeZone for $year as $expected",
    ({ timeZone, year, expected }) => {
      expect(getDstTransitions(timeZone, year)).toEqual(expected);
    },
  );

  // The bound is 20 in-year transitions; the scan needs one more lookup to see it has left the
  // year, so a year with exactly 20 must still return all 20, not the exhaustion sentinel.
  it("returns all 20 transitions when a year has exactly the bound", () => {
    const firstInYear = Temporal.ZonedDateTime.from(
      "2024-01-01T12:00:00+00:00[UTC]",
    );
    const nextYear = Temporal.ZonedDateTime.from(
      "2025-01-01T12:00:00+00:00[UTC]",
    );
    let calls = 0;
    vi.spyOn(
      Temporal.ZonedDateTime.prototype,
      "getTimeZoneTransition",
    ).mockImplementation(() => {
      const index = calls++;
      return index < 20 ? firstInYear.add({ days: index }) : nextYear;
    });

    const expected = Array.from({ length: 20 }, (_, index) => ({
      instant: `2024-01-${String(index + 1).padStart(2, "0")}T12:00:00Z`,
      offsetBefore: "+00:00",
      offsetAfter: "+00:00",
    }));

    expect(getDstTransitions("UTC", 2024)).toEqual(expected);
  });

  it("returns [] when the transition scan exhausts its bound without leaving the year", () => {
    const midYear = Temporal.ZonedDateTime.from(
      "2024-06-15T12:00:00-04:00[America/New_York]",
    );
    vi.spyOn(
      Temporal.ZonedDateTime.prototype,
      "getTimeZoneTransition",
    ).mockReturnValue(midYear);

    expect(getDstTransitions("America/New_York", 2024)).toEqual([]);
  });

  it("returns transitions with correctly chained offsets for all battle-test timeZones", () => {
    for (const timeZone of battleTestTimeZones) {
      const result = getDstTransitions(timeZone, 2024);
      expect([0, 2]).toContain(result.length);
      if (result.length === 2) {
        expect(result[0].offsetBefore).not.toBe(result[0].offsetAfter);
        expect(result[1].offsetBefore).not.toBe(result[1].offsetAfter);
        expect(result[0].offsetAfter).toBe(result[1].offsetBefore);
        expect(result[0].offsetBefore).toBe(result[1].offsetAfter);
      }
    }
  });
});

describe("getDstTransitions in the last representable year", () => {
  // tzdata Chile rules: "Apr Sun>=2 3:00u" and "Sep Sun>=2 4:00u"; both are Sundays in 275760.
  it("lists both America/Santiago transitions of 275760, including the one six days before the maximum", () => {
    expect(getDstTransitions("America/Santiago", 275760)).toEqual([
      {
        instant: "+275760-04-06T03:00:00Z",
        offsetBefore: "-03:00",
        offsetAfter: "-04:00",
      },
      {
        instant: "+275760-09-07T04:00:00Z",
        offsetBefore: "-04:00",
        offsetAfter: "-03:00",
      },
    ]);
  });
});
