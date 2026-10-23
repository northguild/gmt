import { convertUtcToZoned } from "../utc/convert/convertUtcToZoned";
import { addZoned } from "../zoned/calculate/addZoned";
import { diffZoned } from "../zoned/calculate/diffZoned";
import { getHoursInZonedDay } from "../zoned/calculate/getHoursInZonedDay";
import { classifyStoredZoned } from "../zoned/classify/classifyStoredZoned";
import { isInDaylightSaving } from "../zoned/compare/isInDaylightSaving";
import { convertPlainDateTimeToZoned } from "../zoned/convert/convertPlainDateTimeToZoned";
import { getDstTransitions } from "../zoned/get/getDstTransitions";
import { getTimeZoneOffset } from "../zoned/get/getTimeZoneOffset";
import { hasDaylightSaving } from "../zoned/validate/hasDaylightSaving";

/**
 * Oh Morocco: the most-used zoned functions at the exact moments of the 2026 clock change.
 *
 * tzdb 2026c records that `Africa/Casablanca` and `Africa/El_Aaiun` (Western Sahara) move their
 * clocks back at 02:00 local on 2026-09-20, to `+00:00`, and do not change them again. tzdb 2026d
 * and 2026e leave this unchanged.
 *
 * tzdb 2026b and earlier record a change every year around Ramadan. The two such changes in 2027,
 * at 2027-02-07T02:00:00Z (`+01:00` to `+00:00`) and 2027-03-14T02:00:00Z (`+00:00` to `+01:00`),
 * no longer happen.
 *
 * Old data reads `+01:00` for most of the year and `+00:00` inside those weeks, so a check made
 * during Ramadan matches either way. A value that old and new data share appears below only beside
 * a value that differs, in the same row.
 *
 * gmt holds no zone data, so every row reads the runtime's. A failing row here means the runtime's
 * tz data predates tzdb 2026c: update Node or the browser, not the code.
 *
 * Expected values: worked out from the rule above, then checked against tzdb's `africa` file and
 * plain `@js-temporal/polyfill` and `Intl` calls on Node 26.12.1 (tz 2026e). The `old` column, where there is one, is what a
 * runtime with tz 2026b (Node 24.19.0) gives.
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
const stale = `${runtime}: if this fails, the runtime's tz data is older than tzdb 2026c. Update it.`;

describe("the offset around the change on 2026-09-20", () => {
  // The change is at 01:00Z (02:00 local, +01:00). Old data has no change, so both read +01:00.
  it.each`
    zone                   | justBefore                | at                        | before      | after       | old
    ${"Africa/Casablanca"} | ${"2026-09-20T00:59:59Z"} | ${"2026-09-20T01:00:00Z"} | ${"+01:00"} | ${"+00:00"} | ${"+01:00"}
    ${"Africa/El_Aaiun"}   | ${"2026-09-20T00:59:59Z"} | ${"2026-09-20T01:00:00Z"} | ${"+01:00"} | ${"+00:00"} | ${"+01:00"}
  `(
    "$zone is $before at $justBefore and $after at $at (old data: $old at both)",
    ({ zone, justBefore, at, before, after }) => {
      expect(getTimeZoneOffset(zone, justBefore), stale).toBe(before);
      expect(getTimeZoneOffset(zone, at), stale).toBe(after);
    },
  );

  it.each`
    zone                   | instant                   | offset      | old
    ${"Africa/Casablanca"} | ${"2026-11-02T12:00:00Z"} | ${"+00:00"} | ${"+01:00"}
    ${"Africa/El_Aaiun"}   | ${"2026-11-02T12:00:00Z"} | ${"+00:00"} | ${"+01:00"}
  `(
    "$zone is $offset at $instant (old data: $old)",
    ({ zone, instant, offset }) => {
      expect(getTimeZoneOffset(zone, instant), stale).toBe(offset);
    },
  );
});

describe("the offset around the Ramadan changes that no longer happen", () => {
  // Old data: +01:00 until 2027-02-07T02:00Z, +00:00 until 2027-03-14T02:00Z, then +01:00.
  it.each`
    zone                   | justBefore                | at                        | before      | after       | old
    ${"Africa/Casablanca"} | ${"2027-02-07T01:59:59Z"} | ${"2027-02-07T02:00:00Z"} | ${"+00:00"} | ${"+00:00"} | ${"+01:00 then +00:00"}
    ${"Africa/El_Aaiun"}   | ${"2027-02-07T01:59:59Z"} | ${"2027-02-07T02:00:00Z"} | ${"+00:00"} | ${"+00:00"} | ${"+01:00 then +00:00"}
    ${"Africa/Casablanca"} | ${"2027-03-14T01:59:59Z"} | ${"2027-03-14T02:00:00Z"} | ${"+00:00"} | ${"+00:00"} | ${"+00:00 then +01:00"}
    ${"Africa/El_Aaiun"}   | ${"2027-03-14T01:59:59Z"} | ${"2027-03-14T02:00:00Z"} | ${"+00:00"} | ${"+00:00"} | ${"+00:00 then +01:00"}
  `(
    "$zone is $before at $justBefore and $after at $at (old data: $old)",
    ({ zone, justBefore, at, before, after }) => {
      expect(getTimeZoneOffset(zone, justBefore), stale).toBe(before);
      expect(getTimeZoneOffset(zone, at), stale).toBe(after);
    },
  );

  // 2027-02-22 is inside the old Ramadan window, so old data agrees there; 2027-06-01 does not.
  it.each`
    zone                   | ramadan                   | summer                    | offset      | old
    ${"Africa/Casablanca"} | ${"2027-02-22T12:00:00Z"} | ${"2027-06-01T12:00:00Z"} | ${"+00:00"} | ${"+00:00 in Ramadan, +01:00 in June"}
    ${"Africa/El_Aaiun"}   | ${"2027-02-22T12:00:00Z"} | ${"2027-06-01T12:00:00Z"} | ${"+00:00"} | ${"+00:00 in Ramadan, +01:00 in June"}
  `(
    "$zone is $offset at $ramadan and at $summer (old data: $old)",
    ({ zone, ramadan, summer, offset }) => {
      expect(getTimeZoneOffset(zone, ramadan), stale).toBe(offset);
      expect(getTimeZoneOffset(zone, summer), stale).toBe(offset);
    },
  );
});

describe("getDstTransitions lists one change after Ramadan 2026 and none in 2027", () => {
  // 2026 keeps its two Ramadan changes and gains the new one; old data has only the first two.
  it.each`
    zone
    ${"Africa/Casablanca"}
    ${"Africa/El_Aaiun"}
  `(
    "$zone: 2026 ends with the change at 2026-09-20T01:00:00Z to +00:00 (old data: 2 changes)",
    ({ zone }) => {
      expect(getDstTransitions(zone, 2026), stale).toEqual([
        {
          instant: "2026-02-15T02:00:00Z",
          offsetBefore: "+01:00",
          offsetAfter: "+00:00",
        },
        {
          instant: "2026-03-22T02:00:00Z",
          offsetBefore: "+00:00",
          offsetAfter: "+01:00",
        },
        {
          instant: "2026-09-20T01:00:00Z",
          offsetBefore: "+01:00",
          offsetAfter: "+00:00",
        },
      ]);
    },
  );

  it.each`
    zone
    ${"Africa/Casablanca"}
    ${"Africa/El_Aaiun"}
  `("$zone: 2027 has no changes (old data: 2)", ({ zone }) => {
    expect(getDstTransitions(zone, 2027), stale).toEqual([]);
  });
});

describe("local times on the days of the changes", () => {
  // 01:30 on 2026-09-20 happens twice: at +01:00 before the change, at +00:00 after it. The
  // `earlier` reading is the same in old data, so it sits beside `later` and `reject`.
  it.each`
    zone
    ${"Africa/Casablanca"}
    ${"Africa/El_Aaiun"}
  `(
    "convertPlainDateTimeToZoned 2026-09-20T01:30 in $zone: earlier is +01:00, later is +00:00, reject is '' (old data: one reading)",
    ({ zone }) => {
      const plain = "2026-09-20T01:30:00";
      expect(
        convertPlainDateTimeToZoned(plain, zone, { disambiguation: "earlier" }),
        stale,
      ).toBe(`2026-09-20T01:30:00.000+01:00[${zone}]`);
      expect(
        convertPlainDateTimeToZoned(plain, zone, { disambiguation: "later" }),
        stale,
      ).toBe(`2026-09-20T01:30:00.000+00:00[${zone}]`);
      expect(
        convertPlainDateTimeToZoned(plain, zone, { disambiguation: "reject" }),
        stale,
      ).toBe("");
    },
  );

  // Old data: 02:30 on 2027-03-14 falls in the gap (02:00 to 03:00) and is rejected.
  it.each`
    zone                   | expected
    ${"Africa/Casablanca"} | ${"2027-03-14T02:30:00.000+00:00[Africa/Casablanca]"}
    ${"Africa/El_Aaiun"}   | ${"2027-03-14T02:30:00.000+00:00[Africa/El_Aaiun]"}
  `(
    "convertPlainDateTimeToZoned 2027-03-14T02:30 in $zone with reject is '$expected' (old data: '')",
    ({ zone, expected }) => {
      expect(
        convertPlainDateTimeToZoned("2027-03-14T02:30:00", zone, {
          disambiguation: "reject",
        }),
        stale,
      ).toBe(expected);
    },
  );

  // Old data: 02:30 on 2027-02-07 happens twice, and `earlier` picks +01:00.
  it.each`
    zone                   | expected
    ${"Africa/Casablanca"} | ${"2027-02-07T02:30:00.000+00:00[Africa/Casablanca]"}
    ${"Africa/El_Aaiun"}   | ${"2027-02-07T02:30:00.000+00:00[Africa/El_Aaiun]"}
  `(
    "convertPlainDateTimeToZoned 2027-02-07T02:30 in $zone with earlier is '$expected' (old data: +01:00)",
    ({ zone, expected }) => {
      expect(
        convertPlainDateTimeToZoned("2027-02-07T02:30:00", zone, {
          disambiguation: "earlier",
        }),
        stale,
      ).toBe(expected);
    },
  );

  it.each`
    zone
    ${"Africa/Casablanca"}
    ${"Africa/El_Aaiun"}
  `(
    "convertUtcToZoned reads 2027-06-01T12:00Z as 12:00 at +00:00 in $zone (old data: 13:00 at +01:00)",
    ({ zone }) => {
      expect(convertUtcToZoned("2027-06-01T12:00:00Z", zone), stale).toBe(
        `2027-06-01T12:00:00+00:00[${zone}]`,
      );
    },
  );
});

describe("day lengths and arithmetic on the days of the changes", () => {
  it.each`
    zone                   | date            | hours | old
    ${"Africa/Casablanca"} | ${"2026-09-20"} | ${25} | ${24}
    ${"Africa/Casablanca"} | ${"2027-02-07"} | ${24} | ${25}
    ${"Africa/Casablanca"} | ${"2027-03-14"} | ${24} | ${23}
    ${"Africa/El_Aaiun"}   | ${"2026-09-20"} | ${25} | ${24}
    ${"Africa/El_Aaiun"}   | ${"2027-02-07"} | ${24} | ${25}
    ${"Africa/El_Aaiun"}   | ${"2027-03-14"} | ${24} | ${23}
  `(
    "getHoursInZonedDay: $date in $zone has $hours hours (old data: $old)",
    ({ zone, date, hours }) => {
      const noon = convertPlainDateTimeToZoned(`${date}T12:00:00`, zone);
      expect(getHoursInZonedDay(noon), stale).toBe(hours);
    },
  );

  // From noon on 2026-09-19 (+01:00): a calendar day lands on noon at +00:00; 24 hours land at 11:00.
  it.each`
    zone                   | plusOneDay                                        | plus24Hours                                       | hoursBetween
    ${"Africa/Casablanca"} | ${"2026-09-20T12:00:00+00:00[Africa/Casablanca]"} | ${"2026-09-20T11:00:00+00:00[Africa/Casablanca]"} | ${25}
    ${"Africa/El_Aaiun"}   | ${"2026-09-20T12:00:00+00:00[Africa/El_Aaiun]"}   | ${"2026-09-20T11:00:00+00:00[Africa/El_Aaiun]"}   | ${25}
  `(
    "addZoned and diffZoned from noon on 2026-09-19 in $zone: a day is $hoursBetween hours (old data: 24)",
    ({ zone, plusOneDay, plus24Hours, hoursBetween }) => {
      const start = convertPlainDateTimeToZoned("2026-09-19T12:00:00", zone);
      expect(addZoned(start, { days: 1 }), stale).toBe(plusOneDay);
      expect(addZoned(start, { hours: 24 }), stale).toBe(plus24Hours);
      expect(
        diffZoned(start, addZoned(start, { days: 1 }), "hours"),
        stale,
      ).toBe(hoursBetween);
    },
  );
});

describe("daylight saving answers", () => {
  // GMT's rule: a forward change that is undone is daylight time, so the +01:00 months of 2026
  // count as daylight saving; from 2026-09-20 there is no forward change left to pair.
  it.each`
    zone                   | utc                       | expected
    ${"Africa/Casablanca"} | ${"2026-11-02T12:00:00Z"} | ${false}
    ${"Africa/El_Aaiun"}   | ${"2026-11-02T12:00:00Z"} | ${false}
  `(
    "isInDaylightSaving at $utc in $zone is $expected (old data: true)",
    ({ zone, utc, expected }) => {
      expect(isInDaylightSaving(convertUtcToZoned(utc, zone)), stale).toBe(
        expected,
      );
    },
  );

  // True when in daylight time at `at`, or a daylight period begins within 365 days.
  it.each`
    zone                   | at                        | expected
    ${"Africa/Casablanca"} | ${"2026-11-02T12:00:00Z"} | ${false}
    ${"Africa/El_Aaiun"}   | ${"2026-11-02T12:00:00Z"} | ${false}
  `(
    "hasDaylightSaving($zone, at $at) is $expected (old data: true)",
    ({ zone, at, expected }) => {
      expect(hasDaylightSaving(zone, { at }), stale).toBe(expected);
    },
  );
});

describe("times saved before the runtime was updated", () => {
  // 09:00 on 2026-11-16 saved at +01:00 by a runtime with old data; it is +00:00 now.
  it.each`
    zone
    ${"Africa/Casablanca"}
    ${"Africa/El_Aaiun"}
  `("classifyStoredZoned says why for 09:00+01:00 in $zone", ({ zone }) => {
    expect(
      classifyStoredZoned(`2026-11-16T09:00:00+01:00[${zone}]`),
      stale,
    ).toEqual({
      kind: "offsetMismatch",
      storedOffset: "+01:00",
      zoneOffset: "+00:00",
      atStoredOffset: "2026-11-16T08:00:00Z", // keep the old moment: 08:00 local
      atZoneOffset: "2026-11-16T09:00:00Z", // keep 09:00 local
    });
  });

  // Old data: 02:30 on 2027-03-14 is in the gap, so the stored value is not valid.
  it.each`
    zone
    ${"Africa/Casablanca"}
    ${"Africa/El_Aaiun"}
  `(
    "classifyStoredZoned('2027-03-14T02:30:00+00:00[$zone]') is valid (old data: not valid)",
    ({ zone }) => {
      expect(
        classifyStoredZoned(`2027-03-14T02:30:00+00:00[${zone}]`)?.kind,
        stale,
      ).toBe("valid");
    },
  );
});
