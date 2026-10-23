import { convertUtcToZoned } from "../utc/convert/convertUtcToZoned";
import { addZoned } from "../zoned/calculate/addZoned";
import { diffZoned } from "../zoned/calculate/diffZoned";
import { getHoursInZonedDay } from "../zoned/calculate/getHoursInZonedDay";
import { classifyStoredZoned } from "../zoned/classify/classifyStoredZoned";
import { convertPlainDateTimeToZoned } from "../zoned/convert/convertPlainDateTimeToZoned";
import { convertZonedToUtc } from "../zoned/convert/convertZonedToUtc";
import { getDstTransitions } from "../zoned/get/getDstTransitions";
import { getTimeZoneOffset } from "../zoned/get/getTimeZoneOffset";
import { hasDaylightSaving } from "../zoned/validate/hasDaylightSaving";

/**
 * Morocco 2026: the most-used zoned functions at the exact moments of the 2026 clock change.
 *
 * tzdb 2026c (2026-07-08) records that Morocco (`Africa/Casablanca`) and Western Sahara
 * (`Africa/El_Aaiun`) are on +01:00, apart from the 2026 Ramadan change to +00:00 (from
 * 2026-02-15T02:00Z to 2026-03-22T02:00Z), until 2026-09-20T01:00:00Z (02:00 local). From then
 * both zones are on +00:00, with no later change. Data older than 2026c keeps +01:00 after that
 * moment and adds Ramadan changes, such as 2027-02-07T02:00:00Z (+01:00 to +00:00) and
 * 2027-03-14T02:00:00Z (+00:00 to +01:00), that no longer happen.
 *
 * tzdb 2026d and 2026e leave both zones unchanged, so a runtime needs 2026c or later for every
 * row to pass.
 *
 * gmt holds no zone data, so every row reads the runtime's. A failing row here means the runtime's
 * tz data predates the change: update Node or the browser, not the code.
 *
 * Expected values: worked out from the rule above, then checked against plain
 * `@js-temporal/polyfill` calls on Node 26.12.1 (tz 2026e). The `old` column, where there is one,
 * is what a runtime gives whose tz data predates 2026c; `null` means the +00:00 string does not
 * resolve there.
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
const stale = `${runtime}: if this fails, the runtime's tz data is older than tzdb 2026c, the first release with this change. Update it.`;

describe.each`
  zone
  ${"Africa/Casablanca"}
  ${"Africa/El_Aaiun"}
`("$zone", ({ zone }) => {
  describe("the offset either side of the change", () => {
    it("is +01:00 at 2026-09-20T00:59:59Z and +00:00 at 2026-09-20T01:00:00Z (old data: +01:00)", () => {
      expect(getTimeZoneOffset(zone, "2026-09-20T00:59:59Z"), stale).toBe(
        "+01:00",
      );
      expect(getTimeZoneOffset(zone, "2026-09-20T01:00:00Z"), stale).toBe(
        "+00:00",
      );
    });

    it.each`
      at
      ${"2026-10-22T12:00:00Z"}
      ${"2026-11-02T12:00:00Z"}
      ${"2027-06-01T12:00:00Z"}
      ${"2027-12-01T12:00:00Z"}
    `("is +00:00 at $at (old data: +01:00)", ({ at }) => {
      expect(getTimeZoneOffset(zone, at), stale).toBe("+00:00");
    });

    it("stays +00:00 through Ramadan 2027, which no longer moves the clocks (old data: +01:00 either side)", () => {
      expect(getTimeZoneOffset(zone, "2027-02-07T01:59:59Z"), stale).toBe(
        "+00:00",
      );
      expect(getTimeZoneOffset(zone, "2027-02-20T12:00:00Z"), stale).toBe(
        "+00:00",
      );
      expect(getTimeZoneOffset(zone, "2027-03-14T02:00:00Z"), stale).toBe(
        "+00:00",
      );
    });
  });

  describe("getDstTransitions", () => {
    it("lists three changes in 2026 (old data: the first two) and none in 2027 (old data: two)", () => {
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
      expect(getDstTransitions(zone, 2027), stale).toEqual([]);
    });
  });

  describe("local times around the change", () => {
    // 01:30 on 2026-09-20 happens twice: +01:00 first, then +00:00 after the clocks go back.
    it("reads 2026-09-20T01:30 twice: earlier at +01:00, later at +00:00, reject gives ''", () => {
      const read = (disambiguation: "earlier" | "later" | "reject") =>
        convertPlainDateTimeToZoned("2026-09-20T01:30:00", zone, {
          disambiguation,
        });
      expect(read("earlier"), stale).toBe(
        `2026-09-20T01:30:00.000+01:00[${zone}]`,
      );
      expect(read("later"), stale).toBe(
        `2026-09-20T01:30:00.000+00:00[${zone}]`,
      );
      expect(read("reject"), stale).toBe("");
    });

    it.each`
      local
      ${"2027-03-14T02:30:00"}
      ${"2027-02-07T02:30:00"}
    `(
      "convertPlainDateTimeToZoned $local with reject is at +00:00 (old data: '' for a repeated or skipped hour)",
      ({ local }) => {
        expect(
          convertPlainDateTimeToZoned(local, zone, {
            disambiguation: "reject",
          }),
          stale,
        ).toBe(`${local}.000+00:00[${zone}]`);
      },
    );
  });

  describe("day lengths and arithmetic", () => {
    it.each`
      date            | hours | old
      ${"2026-09-20"} | ${25} | ${null}
      ${"2027-02-07"} | ${24} | ${25}
      ${"2027-03-14"} | ${24} | ${null}
    `(
      "getHoursInZonedDay: $date has $hours hours (old data: $old)",
      ({ date, hours }) => {
        // Noon at the 2026c offset, +00:00 on all three days.
        const noon = `${date}T12:00:00+00:00[${zone}]`;
        expect(getHoursInZonedDay(noon), stale).toBe(hours);
      },
    );

    it("addZoned and diffZoned from noon on 2026-09-19: the day is 25 hours (old data: 24)", () => {
      const start = `2026-09-19T12:00:00+01:00[${zone}]`;
      const plusOneDay = `2026-09-20T12:00:00+00:00[${zone}]`;
      expect(addZoned(start, { days: 1 }), stale).toBe(plusOneDay);
      expect(addZoned(start, { hours: 24 }), stale).toBe(
        `2026-09-20T11:00:00+00:00[${zone}]`,
      );
      expect(diffZoned(start, plusOneDay, "hours"), stale).toBe(25);
    });
  });

  describe("daylight saving answers", () => {
    // True when in daylight time at `at`, or a daylight period begins within 365 days.
    it.each`
      at
      ${"2026-10-22T12:00:00Z"}
      ${"2027-06-01T12:00:00Z"}
    `("hasDaylightSaving at $at is false (old data: true)", ({ at }) => {
      expect(hasDaylightSaving(zone, { at }), stale).toBe(false);
    });
  });

  describe("times saved before the runtime was updated", () => {
    // 09:00 on 2027-06-01 saved at +01:00 (08:00Z) by a runtime with old data; it is +00:00 now.
    const SAVED_OLD = `2027-06-01T09:00:00+01:00[${zone}]`;

    it("the zoned functions refuse the old offset", () => {
      expect(convertZonedToUtc(SAVED_OLD), stale).toBe("");
      expect(addZoned(SAVED_OLD, { days: 1 }), stale).toBe("");
    });

    it("classifyStoredZoned says why and gives both readings", () => {
      expect(classifyStoredZoned(SAVED_OLD), stale).toEqual({
        kind: "offsetMismatch",
        storedOffset: "+01:00",
        zoneOffset: "+00:00",
        atStoredOffset: "2027-06-01T08:00:00Z", // keep the old moment: 08:00 local
        atZoneOffset: "2027-06-01T09:00:00Z", // keep 09:00 local
      });
    });

    it.each`
      value                                | kind                | old
      ${"2027-06-01T09:00:00+00:00[ZONE]"} | ${"valid"}          | ${"offsetMismatch"}
      ${"2026-11-15T09:00:00+01:00[ZONE]"} | ${"offsetMismatch"} | ${"valid"}
      ${"2026-09-20T01:30:00+00:00[ZONE]"} | ${"validInOverlap"} | ${"offsetMismatch"}
      ${"2027-03-14T02:30:00+00:00[ZONE]"} | ${"valid"}          | ${"nonexistent"}
    `(
      "classifyStoredZoned($value) is $kind (old data: $old)",
      ({ value, kind }) => {
        expect(
          classifyStoredZoned(value.replace("ZONE", zone))?.kind,
          stale,
        ).toBe(kind);
      },
    );

    it("the fix keeps 09:00 local: convert the local time and place again", () => {
      const fixed = convertPlainDateTimeToZoned("2027-06-01T09:00:00", zone);
      expect(fixed, stale).toBe(`2027-06-01T09:00:00.000+00:00[${zone}]`);
      expect(convertZonedToUtc(fixed), stale).toBe("2027-06-01T09:00:00Z");
    });

    it("a UTC-only value reads without error but an hour early (08:00Z is 08:00 local now)", () => {
      expect(convertUtcToZoned("2027-06-01T08:00:00Z", zone), stale).toBe(
        `2027-06-01T08:00:00+00:00[${zone}]`,
      );
    });
  });
});
