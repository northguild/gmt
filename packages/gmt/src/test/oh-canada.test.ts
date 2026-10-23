import { convertUtcToZoned } from "../utc/convert/convertUtcToZoned";
import { addZoned } from "../zoned/calculate/addZoned";
import { diffZoned } from "../zoned/calculate/diffZoned";
import { getHoursInZonedDay } from "../zoned/calculate/getHoursInZonedDay";
import { classifyStoredZoned } from "../zoned/classify/classifyStoredZoned";
import { isInDaylightSaving } from "../zoned/compare/isInDaylightSaving";
import { convertPlainDateTimeToZoned } from "../zoned/convert/convertPlainDateTimeToZoned";
import { convertZonedToUtc } from "../zoned/convert/convertZonedToUtc";
import { getDstTransitions } from "../zoned/get/getDstTransitions";
import { getTimeZoneOffset } from "../zoned/get/getTimeZoneOffset";
import { hasDaylightSaving } from "../zoned/validate/hasDaylightSaving";

/**
 * Oh Canada: the most-used zoned functions at the exact moments of the 2026 clock change.
 *
 * tzdb 2026b to 2026e record that British Columbia (`America/Vancouver`), Alberta
 * (`America/Edmonton`), the Northwest Territories (`America/Inuvik`, `America/Yellowknife`) and
 * Manitoba (`America/Winnipeg`) put their clocks forward at 02:00 local on 2026-03-08 and never
 * put them back. The first change that no longer happens was due at 02:00 local on 2026-11-01.
 * `America/Toronto` and `America/Cambridge_Bay` (Nunavut, on Mountain time like Edmonton) keep
 * changing, and are the contrast.
 *
 * Each zone arrived in its own release: Vancouver in 2026b, Edmonton and Yellowknife in 2026c,
 * Inuvik in 2026d and Winnipeg in 2026e. A runtime needs 2026e or later for every row to pass.
 *
 * gmt holds no zone data, so every row reads the runtime's. A failing row here means the runtime's
 * tz data predates the change: update Node or the browser, not the code. CI runs this file on the
 * newest release of every Node in `ci.yml`'s matrix.
 *
 * Expected values: worked out from the rule above (whole-hour offsets; standard time is
 * Pacific -08:00, Mountain -07:00, Central -06:00, Eastern -05:00, and summer time one hour more),
 * then checked against plain `@js-temporal/polyfill` calls on Node 26.12.1 (tz 2026e). The `old`
 * column, where there is one, is what a runtime gives whose tz data predates that zone's release.
 */

/** Names the runtime's tz data in a failure, so the cause is clear from the message alone. */
const runtime = (() => {
  const versions = (
    globalThis as { process?: { version?: string; versions?: { tz?: string } } }
  ).process;
  return versions?.versions?.tz
    ? `Node ${versions.version}, tz ${versions.versions.tz}`
    : "this runtime";
})();
const stale = `${runtime}: if this fails, the runtime's tz data is older than tzdb 2026e, the first release with all five zones. Update it.`;

/** Where each zone was due to put its clocks back on 2026-11-01: 02:00 local in summer time. */
describe("the offset either side of the change that no longer happens", () => {
  it.each`
    zone                       | justBefore                | dueAt                     | before      | after       | old
    ${"America/Vancouver"}     | ${"2026-11-01T08:59:59Z"} | ${"2026-11-01T09:00:00Z"} | ${"-07:00"} | ${"-07:00"} | ${"-08:00"}
    ${"America/Edmonton"}      | ${"2026-11-01T07:59:59Z"} | ${"2026-11-01T08:00:00Z"} | ${"-06:00"} | ${"-06:00"} | ${"-07:00"}
    ${"America/Inuvik"}        | ${"2026-11-01T07:59:59Z"} | ${"2026-11-01T08:00:00Z"} | ${"-06:00"} | ${"-06:00"} | ${"-07:00"}
    ${"America/Yellowknife"}   | ${"2026-11-01T07:59:59Z"} | ${"2026-11-01T08:00:00Z"} | ${"-06:00"} | ${"-06:00"} | ${"-07:00"}
    ${"America/Winnipeg"}      | ${"2026-11-01T06:59:59Z"} | ${"2026-11-01T07:00:00Z"} | ${"-05:00"} | ${"-05:00"} | ${"-06:00"}
    ${"America/Toronto"}       | ${"2026-11-01T05:59:59Z"} | ${"2026-11-01T06:00:00Z"} | ${"-04:00"} | ${"-05:00"} | ${"-05:00"}
    ${"America/Cambridge_Bay"} | ${"2026-11-01T07:59:59Z"} | ${"2026-11-01T08:00:00Z"} | ${"-06:00"} | ${"-07:00"} | ${"-07:00"}
  `(
    "$zone is $before at $justBefore and $after at $dueAt (old data: $old)",
    ({ zone, justBefore, dueAt, before, after }) => {
      expect(getTimeZoneOffset(zone, justBefore), stale).toBe(before);
      expect(getTimeZoneOffset(zone, dueAt), stale).toBe(after);
    },
  );

  it.each`
    zone                       | summer2027  | winter2027
    ${"America/Vancouver"}     | ${"-07:00"} | ${"-07:00"}
    ${"America/Edmonton"}      | ${"-06:00"} | ${"-06:00"}
    ${"America/Inuvik"}        | ${"-06:00"} | ${"-06:00"}
    ${"America/Yellowknife"}   | ${"-06:00"} | ${"-06:00"}
    ${"America/Winnipeg"}      | ${"-05:00"} | ${"-05:00"}
    ${"America/Toronto"}       | ${"-04:00"} | ${"-05:00"}
    ${"America/Cambridge_Bay"} | ${"-06:00"} | ${"-07:00"}
  `(
    "$zone is $summer2027 on 2027-07-01 and $winter2027 on 2027-12-01",
    ({ zone, summer2027, winter2027 }) => {
      expect(getTimeZoneOffset(zone, "2027-07-01T12:00:00Z"), stale).toBe(
        summer2027,
      );
      expect(getTimeZoneOffset(zone, "2027-12-01T12:00:00Z"), stale).toBe(
        winter2027,
      );
    },
  );
});

describe("getDstTransitions lists the last change and nothing after it", () => {
  it.each`
    zone                     | instant                   | offsetBefore | offsetAfter
    ${"America/Vancouver"}   | ${"2026-03-08T10:00:00Z"} | ${"-08:00"}  | ${"-07:00"}
    ${"America/Edmonton"}    | ${"2026-03-08T09:00:00Z"} | ${"-07:00"}  | ${"-06:00"}
    ${"America/Inuvik"}      | ${"2026-03-08T09:00:00Z"} | ${"-07:00"}  | ${"-06:00"}
    ${"America/Yellowknife"} | ${"2026-03-08T09:00:00Z"} | ${"-07:00"}  | ${"-06:00"}
    ${"America/Winnipeg"}    | ${"2026-03-08T08:00:00Z"} | ${"-06:00"}  | ${"-05:00"}
  `(
    "$zone: 2026 has only the change at $instant, 2027 has none (old data: two each year)",
    ({ zone, instant, offsetBefore, offsetAfter }) => {
      expect(getDstTransitions(zone, 2026), stale).toEqual([
        { instant, offsetBefore, offsetAfter },
      ]);
      expect(getDstTransitions(zone, 2027), stale).toEqual([]);
    },
  );

  it("America/Toronto still changes twice in 2026 and twice in 2027", () => {
    expect(getDstTransitions("America/Toronto", 2026), stale).toEqual([
      {
        instant: "2026-03-08T07:00:00Z",
        offsetBefore: "-05:00",
        offsetAfter: "-04:00",
      },
      {
        instant: "2026-11-01T06:00:00Z",
        offsetBefore: "-04:00",
        offsetAfter: "-05:00",
      },
    ]);
    expect(getDstTransitions("America/Toronto", 2027), stale).toEqual([
      {
        instant: "2027-03-14T07:00:00Z",
        offsetBefore: "-05:00",
        offsetAfter: "-04:00",
      },
      {
        instant: "2027-11-07T06:00:00Z",
        offsetBefore: "-04:00",
        offsetAfter: "-05:00",
      },
    ]);
  });
});

describe("local times on the days the clocks no longer change", () => {
  // 01:30 on 2026-11-01 happens once in Vancouver (no overlap), twice in Toronto.
  it.each`
    zone                   | disambiguation | expected
    ${"America/Vancouver"} | ${"earlier"}   | ${"2026-11-01T01:30:00.000-07:00[America/Vancouver]"}
    ${"America/Vancouver"} | ${"later"}     | ${"2026-11-01T01:30:00.000-07:00[America/Vancouver]"}
    ${"America/Vancouver"} | ${"reject"}    | ${"2026-11-01T01:30:00.000-07:00[America/Vancouver]"}
    ${"America/Toronto"}   | ${"earlier"}   | ${"2026-11-01T01:30:00.000-04:00[America/Toronto]"}
    ${"America/Toronto"}   | ${"later"}     | ${"2026-11-01T01:30:00.000-05:00[America/Toronto]"}
    ${"America/Toronto"}   | ${"reject"}    | ${""}
  `(
    "convertPlainDateTimeToZoned 2026-11-01T01:30 in $zone with $disambiguation is '$expected'",
    ({ zone, disambiguation, expected }) => {
      expect(
        convertPlainDateTimeToZoned("2026-11-01T01:30:00", zone, {
          disambiguation,
        }),
        stale,
      ).toBe(expected);
    },
  );

  // 02:30 on 2027-03-14 exists in Vancouver (no gap), and is skipped in Toronto.
  it.each`
    zone                   | expected
    ${"America/Vancouver"} | ${"2027-03-14T02:30:00.000-07:00[America/Vancouver]"}
    ${"America/Toronto"}   | ${""}
  `(
    "convertPlainDateTimeToZoned 2027-03-14T02:30 in $zone with reject is '$expected'",
    ({ zone, expected }) => {
      expect(
        convertPlainDateTimeToZoned("2027-03-14T02:30:00", zone, {
          disambiguation: "reject",
        }),
        stale,
      ).toBe(expected);
    },
  );

  it("convertUtcToZoned reads 2026-11-01T09:30Z as 02:30 in Vancouver (old data: 01:30 at -08:00)", () => {
    expect(
      convertUtcToZoned("2026-11-01T09:30:00Z", "America/Vancouver"),
      stale,
    ).toBe("2026-11-01T02:30:00-07:00[America/Vancouver]");
  });
});

describe("day lengths and arithmetic across 2026-11-01", () => {
  it.each`
    zone                   | date            | hours
    ${"America/Vancouver"} | ${"2026-03-08"} | ${23}
    ${"America/Vancouver"} | ${"2026-11-01"} | ${24}
    ${"America/Vancouver"} | ${"2027-03-14"} | ${24}
    ${"America/Vancouver"} | ${"2027-11-07"} | ${24}
    ${"America/Winnipeg"}  | ${"2026-11-01"} | ${24}
    ${"America/Toronto"}   | ${"2026-03-08"} | ${23}
    ${"America/Toronto"}   | ${"2026-11-01"} | ${25}
    ${"America/Toronto"}   | ${"2027-03-14"} | ${23}
    ${"America/Toronto"}   | ${"2027-11-07"} | ${25}
  `(
    "getHoursInZonedDay: $date in $zone has $hours hours",
    ({ zone, date, hours }) => {
      const noon = convertPlainDateTimeToZoned(`${date}T12:00:00`, zone);
      expect(getHoursInZonedDay(noon), stale).toBe(hours);
    },
  );

  it.each`
    zone                   | start                                             | plusOneDay                                        | plus24Hours                                       | hoursBetween
    ${"America/Vancouver"} | ${"2026-10-31T12:00:00-07:00[America/Vancouver]"} | ${"2026-11-01T12:00:00-07:00[America/Vancouver]"} | ${"2026-11-01T12:00:00-07:00[America/Vancouver]"} | ${24}
    ${"America/Winnipeg"}  | ${"2026-10-31T12:00:00-05:00[America/Winnipeg]"}  | ${"2026-11-01T12:00:00-05:00[America/Winnipeg]"}  | ${"2026-11-01T12:00:00-05:00[America/Winnipeg]"}  | ${24}
    ${"America/Toronto"}   | ${"2026-10-31T12:00:00-04:00[America/Toronto]"}   | ${"2026-11-01T12:00:00-05:00[America/Toronto]"}   | ${"2026-11-01T11:00:00-05:00[America/Toronto]"}   | ${25}
  `(
    "addZoned and diffZoned from noon on 2026-10-31 in $zone: a day is $hoursBetween hours",
    ({ start, plusOneDay, plus24Hours, hoursBetween }) => {
      expect(addZoned(start, { days: 1 }), stale).toBe(plusOneDay);
      expect(addZoned(start, { hours: 24 }), stale).toBe(plus24Hours);
      expect(diffZoned(start, plusOneDay, "hours"), stale).toBe(hoursBetween);
    },
  );
});

describe("daylight saving answers", () => {
  // GMT's rule: a forward change never undone is a change of standard time (as Europe/Istanbul
  // in 2016), so the summer of 2026 is not daylight time in the five zones; 2025's was.
  it.each`
    value                                             | expected
    ${"2025-07-01T12:00:00-07:00[America/Vancouver]"} | ${true}
    ${"2026-07-01T12:00:00-07:00[America/Vancouver]"} | ${false}
    ${"2026-12-01T12:00:00-07:00[America/Vancouver]"} | ${false}
    ${"2026-07-01T12:00:00-05:00[America/Winnipeg]"}  | ${false}
    ${"2026-07-01T12:00:00-04:00[America/Toronto]"}   | ${true}
  `("isInDaylightSaving('$value') is $expected", ({ value, expected }) => {
    expect(isInDaylightSaving(value), stale).toBe(expected);
  });

  // True when in daylight time at `at`, or a daylight period begins within 365 days.
  it.each`
    zone                   | at                        | expected
    ${"America/Vancouver"} | ${"2025-07-01T12:00:00Z"} | ${true}
    ${"America/Vancouver"} | ${"2025-12-01T12:00:00Z"} | ${false}
    ${"America/Vancouver"} | ${"2026-11-02T12:00:00Z"} | ${false}
    ${"America/Edmonton"}  | ${"2026-11-02T12:00:00Z"} | ${false}
    ${"America/Toronto"}   | ${"2026-11-02T12:00:00Z"} | ${true}
  `(
    "hasDaylightSaving($zone, at $at) is $expected",
    ({ zone, at, expected }) => {
      expect(hasDaylightSaving(zone, { at }), stale).toBe(expected);
    },
  );
});

describe("times saved before the runtime was updated", () => {
  // 09:00 on 2026-11-15, saved by a runtime with old data at -08:00 (17:00Z); it is -07:00 now.
  const SAVED_OLD = "2026-11-15T09:00:00-08:00[America/Vancouver]";

  it("the zoned functions refuse the old offset", () => {
    expect(convertZonedToUtc(SAVED_OLD), stale).toBe("");
    expect(addZoned(SAVED_OLD, { days: 1 }), stale).toBe("");
  });

  it("classifyStoredZoned says why and gives both readings", () => {
    expect(classifyStoredZoned(SAVED_OLD), stale).toEqual({
      kind: "offsetMismatch",
      storedOffset: "-08:00",
      zoneOffset: "-07:00",
      atStoredOffset: "2026-11-15T17:00:00Z", // keep the old moment: 10:00 local
      atZoneOffset: "2026-11-15T16:00:00Z", // keep 09:00 local
    });
  });

  it.each`
    value                                             | kind
    ${"2026-11-15T09:00:00-07:00[America/Vancouver]"} | ${"valid"}
    ${"2026-12-01T18:00:00-06:00[America/Winnipeg]"}  | ${"offsetMismatch"}
    ${"2026-11-01T01:30:00-07:00[America/Vancouver]"} | ${"valid"}
    ${"2026-11-01T01:30:00-04:00[America/Toronto]"}   | ${"validInOverlap"}
  `("classifyStoredZoned('$value') is $kind", ({ value, kind }) => {
    expect(classifyStoredZoned(value)?.kind, stale).toBe(kind);
  });

  it("the fix keeps 09:00 local: convert the local time and place again", () => {
    const fixed = convertPlainDateTimeToZoned(
      "2026-11-15T09:00:00",
      "America/Vancouver",
    );
    expect(fixed, stale).toBe(
      "2026-11-15T09:00:00.000-07:00[America/Vancouver]",
    );
    expect(convertZonedToUtc(fixed), stale).toBe("2026-11-15T16:00:00Z");
  });

  it("a UTC-only value reads without error but an hour late (17:00Z is 10:00 local now)", () => {
    expect(
      convertUtcToZoned("2026-11-15T17:00:00Z", "America/Vancouver"),
      stale,
    ).toBe("2026-11-15T10:00:00-07:00[America/Vancouver]");
  });
});
