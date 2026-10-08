import { Temporal } from "@js-temporal/polyfill";
import { vi } from "vitest";
import { fromOffsetInstant } from "../../instant/convert/fromOffsetInstant";
import { EDIFACT_DTM_FORMATS } from "../../internal";
import { type MustTestDstTimeZones, sameInstantBattleCases } from "../../test";
import {
  mockTemporalInstantFromThrow,
  mockTemporalNowInstantThrow,
  mockTemporalPlainDateFromThrow,
  mockTemporalPlainDateTimeFromThrow,
  mockTemporalPlainTimeFromThrow,
} from "../../test/mocks";
import { hostileProxy, revokedProxy } from "../../test/noThrow";
import type { EdiDateTime, EdifactDtmFormat } from "../../types/edi";
import { parseEdifactDtm } from "../parse/parseEdifactDtm";
import { formatEdifactDtm } from "./formatEdifactDtm";

/**
 * Every expected value below is written from the UNTDID 2379 mask by hand: the fixture is
 * 15 June 2024 at 14:30 (and 45 seconds where the mask has `SS`), so `CCYYMMDDHHMM` is
 * `2024 06 15 14 30` run together. A value with an offset is written on its own wall clock, the
 * digits before the offset, never on the UTC clock.
 */
const WINDOW_2000 = { yearWindow: 2000 };
const WINDOW_1950 = { yearWindow: 1950 };

/** The clock for every `"rolling"` row: the window is 1976–2075 (2026 − 50 to 2026 + 49). */
const NOW_2026 = "2026-10-07T12:00:00Z";

function setNow(instant: string): void {
  vi.spyOn(Temporal.Now, "instant").mockReturnValue(
    Temporal.Instant.from(instant),
  );
}

/**
 * Values that are not strings, each named for the failure message. Built per use: a Proxy that
 * throws on every trap reaches the catch path, where the others stop at the `typeof` guard.
 */
const NON_STRINGS: [string, () => unknown][] = [
  ["null", () => null],
  ["undefined", () => undefined],
  ["a number", () => 20240615],
  ["a boolean", () => true],
  ["an array holding a string", () => ["2024-06-15"]],
  ["an object", () => ({})],
  ["a Proxy that throws on any trap", hostileProxy],
  ["a revoked Proxy", revokedProxy],
];

/** A getter that throws, for an options bag that cannot be read. */
function throwing(): never {
  throw new Error("hostile getter");
}

/**
 * 2024-02-29T00:00:00Z, the instant of `sameInstantBattleCases`, on each battle-test zone's own
 * clock, written by hand under `CCYYMMDDHHMMZHHMM` (205) and `CCYYMMDDHHMMZZZ` (303). Keyed by
 * zone, so a zone with no row fails typecheck. The wall clock is midnight UTC plus the zone's
 * offset on that day: late February is standard time in the north (New York −05:00) and daylight
 * time in the south (Lord Howe +11:00, Chatham +13:45). `ZZZ` holds whole hours only, so the
 * half-hour and 45-minute zones have no 303 value. `local` is that wall clock as
 * `parseEdifactDtm` returns it. Each offset and wall clock is checked against plain
 * `Temporal.ZonedDateTime` in the test.
 */
const BATTLE_WIRES = {
  UTC: {
    offset: "+00:00",
    local: "2024-02-29T00:00:00",
    dtm205: "202402290000+0000",
    dtm303: "202402290000+00",
  },
  GMT: {
    offset: "+00:00",
    local: "2024-02-29T00:00:00",
    dtm205: "202402290000+0000",
    dtm303: "202402290000+00",
  },
  "Etc/GMT": {
    offset: "+00:00",
    local: "2024-02-29T00:00:00",
    dtm205: "202402290000+0000",
    dtm303: "202402290000+00",
  },
  "America/Nome": {
    offset: "-09:00",
    local: "2024-02-28T15:00:00",
    dtm205: "202402281500-0900",
    dtm303: "202402281500-09",
  },
  "Asia/Anadyr": {
    offset: "+12:00",
    local: "2024-02-29T12:00:00",
    dtm205: "202402291200+1200",
    dtm303: "202402291200+12",
  },
  "Europe/Lisbon": {
    offset: "+00:00",
    local: "2024-02-29T00:00:00",
    dtm205: "202402290000+0000",
    dtm303: "202402290000+00",
  },
  "Europe/Dublin": {
    offset: "+00:00",
    local: "2024-02-29T00:00:00",
    dtm205: "202402290000+0000",
    dtm303: "202402290000+00",
  },
  "Europe/Berlin": {
    offset: "+01:00",
    local: "2024-02-29T01:00:00",
    dtm205: "202402290100+0100",
    dtm303: "202402290100+01",
  },
  "Europe/Helsinki": {
    offset: "+02:00",
    local: "2024-02-29T02:00:00",
    dtm205: "202402290200+0200",
    dtm303: "202402290200+02",
  },
  "Europe/Istanbul": {
    offset: "+03:00",
    local: "2024-02-29T03:00:00",
    dtm205: "202402290300+0300",
    dtm303: "202402290300+03",
  },
  "Asia/Kolkata": {
    offset: "+05:30",
    local: "2024-02-29T05:30:00",
    dtm205: "202402290530+0530",
    dtm303: "",
  },
  "Asia/Kathmandu": {
    offset: "+05:45",
    local: "2024-02-29T05:45:00",
    dtm205: "202402290545+0545",
    dtm303: "",
  },
  "Asia/Shanghai": {
    offset: "+08:00",
    local: "2024-02-29T08:00:00",
    dtm205: "202402290800+0800",
    dtm303: "202402290800+08",
  },
  "Australia/Lord_Howe": {
    offset: "+11:00",
    local: "2024-02-29T11:00:00",
    dtm205: "202402291100+1100",
    dtm303: "202402291100+11",
  },
  "Pacific/Chatham": {
    offset: "+13:45",
    local: "2024-02-29T13:45:00",
    dtm205: "202402291345+1345",
    dtm303: "",
  },
  "Pacific/Apia": {
    offset: "+13:00",
    local: "2024-02-29T13:00:00",
    dtm205: "202402291300+1300",
    dtm303: "202402291300+13",
  },
  "Pacific/Niue": {
    offset: "-11:00",
    local: "2024-02-28T13:00:00",
    dtm205: "202402281300-1100",
    dtm303: "202402281300-11",
  },
  "America/New_York": {
    offset: "-05:00",
    local: "2024-02-28T19:00:00",
    dtm205: "202402281900-0500",
    dtm303: "202402281900-05",
  },
  "America/Chicago": {
    offset: "-06:00",
    local: "2024-02-28T18:00:00",
    dtm205: "202402281800-0600",
    dtm303: "202402281800-06",
  },
  "America/Phoenix": {
    offset: "-07:00",
    local: "2024-02-28T17:00:00",
    dtm205: "202402281700-0700",
    dtm303: "202402281700-07",
  },
} satisfies Record<
  keyof typeof MustTestDstTimeZones,
  { offset: string; local: string; dtm205: string; dtm303: string }
>;

describe("formatEdifactDtm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("102 CCYYMMDD: a calendar date", () => {
    it.each`
      value                         | expected      | reads
      ${"2024-06-15"}               | ${"20240615"} | ${"the fixture"}
      ${"2024-02-29"}               | ${"20240229"} | ${"leap day 2024"}
      ${"2024-01-01"}               | ${"20240101"} | ${"single-digit month and day are zero-padded"}
      ${"0000-01-01"}               | ${"00000101"} | ${"the first four-digit year"}
      ${"0033-04-03"}               | ${"00330403"} | ${"a two-digit year is zero-padded to CCYY"}
      ${"9999-12-31"}               | ${"99991231"} | ${"the last four-digit year"}
      ${"+002024-06-15"}            | ${"20240615"} | ${"a six-digit ISO year that is a four-digit year"}
      ${"2024-06-15[u-ca=iso8601]"} | ${"20240615"} | ${"an ISO calendar annotation, read as isValidDate reads it"}
    `("writes $value as $expected ($reads)", ({ value, expected }) => {
      expect(formatEdifactDtm(value, "102")).toBe(expected);
    });

    it.each`
      value                        | reads
      ${"2024-06-15T14:30:00"}     | ${"a date-time given to a date code"}
      ${"2024-06-15T00:00:00"}     | ${"a date-time at midnight is still not a date"}
      ${"2024-06-15T14:30:00Z"}    | ${"an instant given to a date code"}
      ${"20240615"}                | ${"the wire form, not ISO 8601"}
      ${"2024-06"}                 | ${"a year and month"}
      ${"2023-02-29"}              | ${"29 February 2023"}
      ${"2024-06-31"}              | ${"31 June"}
      ${"+010000-01-01"}           | ${"year 10000: CCYY holds four digits"}
      ${"-000001-12-31"}           | ${"year −1: CCYY holds no sign"}
      ${"2024-06-15[u-ca=hebrew]"} | ${"a non-ISO calendar"}
      ${"2024-06-15/2024-06-20"}   | ${"a period given to a single-date code"}
      ${""}                        | ${"an empty string"}
      ${"not a date"}              | ${"garbage"}
    `("returns the sentinel for $value ($reads)", ({ value }) => {
      expect(formatEdifactDtm(value, "102")).toBe("");
    });
  });

  describe("203 CCYYMMDDHHMM and 204 CCYYMMDDHHMMSS: a date and time with no offset", () => {
    it.each`
      code     | value                                   | expected            | reads
      ${"203"} | ${"2024-06-15T14:30:00"}                | ${"202406151430"}   | ${"seconds :00 are dropped: the mask has none and nothing is lost"}
      ${"203"} | ${"2024-06-15T14:30"}                   | ${"202406151430"}   | ${"no seconds in the value"}
      ${"203"} | ${"2024-06-15T00:00:00"}                | ${"202406150000"}   | ${"midnight"}
      ${"203"} | ${"2024-06-15T23:59:00"}                | ${"202406152359"}   | ${"the last minute"}
      ${"203"} | ${"2024-06-15T14:30:00.000"}            | ${"202406151430"}   | ${"a zero fraction is no fraction"}
      ${"203"} | ${"2024-06-15T14:30:00[Europe/Berlin]"} | ${"202406151430"}   | ${"a zone annotation, ignored as isValidDateTime ignores it"}
      ${"204"} | ${"2024-06-15T14:30:45"}                | ${"20240615143045"} | ${"seconds"}
      ${"204"} | ${"2024-06-15T14:30:00"}                | ${"20240615143000"} | ${"zero seconds are written where the mask has SS"}
      ${"204"} | ${"2024-06-15T14:30"}                   | ${"20240615143000"} | ${"no seconds in the value: written as 00"}
      ${"204"} | ${"2024-02-29T23:59:59"}                | ${"20240229235959"} | ${"the last second of leap day"}
    `(
      "writes $value under $code as $expected ($reads)",
      ({ code, value, expected }) => {
        expect(formatEdifactDtm(value, code)).toBe(expected);
      },
    );

    // The mask must hold the value exactly: a formatter that rounded or truncated would write a
    // different time from the one it was given.
    it.each`
      code     | value                              | reads
      ${"203"} | ${"2024-06-15T14:30:45"}           | ${"non-zero seconds under a minute code"}
      ${"203"} | ${"2024-06-15T14:30:00.5"}         | ${"a fraction of a second"}
      ${"203"} | ${"2024-06-15T14:30:00.000000001"} | ${"one nanosecond"}
      ${"204"} | ${"2024-06-15T14:30:45.5"}         | ${"a fraction under a second code"}
      ${"204"} | ${"2024-06-15T14:30:45,123"}       | ${"a fraction after a comma"}
      ${"203"} | ${"2024-06-15"}                    | ${"a date given to a date-time code"}
      ${"203"} | ${"14:30:00"}                      | ${"a time given to a date-time code"}
      ${"203"} | ${"2024-06-15T14:30:00+02:00"}     | ${"an offset given to an offsetless code"}
      ${"203"} | ${"2024-06-15T14:30:00Z"}          | ${"a Z given to an offsetless code"}
      ${"204"} | ${"2024-06-15T14:30:45+02:00"}     | ${"an offset given to an offsetless code"}
      ${"203"} | ${"2024-06-15T24:00:00"}           | ${"hour 24"}
      ${"204"} | ${"2024-06-15T23:59:60"}           | ${"a leap second"}
      ${"203"} | ${"2023-02-29T14:30:00"}           | ${"29 February 2023"}
      ${"203"} | ${"+010000-01-01T00:00:00"}        | ${"year 10000"}
      ${"203"} | ${"2024-06-15 14:30:00"}           | ${"a space for the T"}
      ${"203"} | ${"202406151430"}                  | ${"the wire form, not ISO 8601"}
    `(
      "returns the sentinel for $value under $code ($reads)",
      ({ code, value }) => {
        expect(formatEdifactDtm(value, code)).toBe("");
      },
    );
  });

  describe("401 HHMM and 402 HHMMSS: a time", () => {
    it.each`
      code     | value             | expected    | reads
      ${"401"} | ${"14:30"}        | ${"1430"}   | ${"no seconds in the value"}
      ${"401"} | ${"14:30:00"}     | ${"1430"}   | ${"seconds :00 are dropped"}
      ${"401"} | ${"00:00:00"}     | ${"0000"}   | ${"midnight"}
      ${"401"} | ${"23:59:00"}     | ${"2359"}   | ${"the last minute"}
      ${"401"} | ${"09:05"}        | ${"0905"}   | ${"single digits are zero-padded"}
      ${"402"} | ${"14:30:45"}     | ${"143045"} | ${"seconds"}
      ${"402"} | ${"14:30"}        | ${"143000"} | ${"no seconds in the value: written as 00"}
      ${"402"} | ${"23:59:59"}     | ${"235959"} | ${"the last second"}
      ${"402"} | ${"14:30:45.000"} | ${"143045"} | ${"a zero fraction is no fraction"}
    `(
      "writes $value under $code as $expected ($reads)",
      ({ code, value, expected }) => {
        expect(formatEdifactDtm(value, code)).toBe(expected);
      },
    );

    it.each`
      code     | value                    | reads
      ${"401"} | ${"14:30:45"}            | ${"non-zero seconds under a minute code"}
      ${"401"} | ${"14:30:00.5"}          | ${"a fraction of a second"}
      ${"402"} | ${"14:30:45.5"}          | ${"a fraction under a second code"}
      ${"401"} | ${"14:30:00+02:00"}      | ${"an offset given to an offsetless code"}
      ${"402"} | ${"14:30:45Z"}           | ${"a Z given to an offsetless code"}
      ${"401"} | ${"2024-06-15T14:30:00"} | ${"a date-time given to a time code"}
      ${"401"} | ${"24:00"}               | ${"hour 24"}
      ${"401"} | ${"14:60"}               | ${"minute 60"}
      ${"402"} | ${"23:59:60"}            | ${"a leap second"}
      ${"401"} | ${"1430"}                | ${"the wire form, not ISO 8601"}
      ${"401"} | ${"14"}                  | ${"an hour alone"}
    `(
      "returns the sentinel for $value under $code ($reads)",
      ({ code, value }) => {
        expect(formatEdifactDtm(value, code)).toBe("");
      },
    );
  });

  describe("205 CCYYMMDDHHMMZHHMM: a date and time with a signed HHMM offset", () => {
    // The digits are the wall clock at the value's own offset; `Z` is the offset +00:00.
    it.each`
      value                                            | expected               | reads
      ${"2024-06-15T14:30:00+02:00"}                   | ${"202406151430+0200"} | ${"what fromOffsetInstant returns"}
      ${"2024-06-15T14:30:00-05:00"}                   | ${"202406151430-0500"} | ${"a negative offset"}
      ${"2024-06-15T14:30:00+05:30"}                   | ${"202406151430+0530"} | ${"offset minutes fit ZHHMM"}
      ${"2024-06-15T14:30:00+05:45"}                   | ${"202406151430+0545"} | ${"a 45-minute offset"}
      ${"2024-06-15T14:30:00+12:45"}                   | ${"202406151430+1245"} | ${"a 45-minute offset past twelve hours"}
      ${"2024-06-15T14:30:00-03:30"}                   | ${"202406151430-0330"} | ${"a half hour west"}
      ${"2024-06-15T14:30:00-12:00"}                   | ${"202406151430-1200"} | ${"the most negative offset in use"}
      ${"2024-06-15T14:30:00+13:00"}                   | ${"202406151430+1300"} | ${"thirteen hours east"}
      ${"2024-06-15T14:30:00+14:00"}                   | ${"202406151430+1400"} | ${"the largest offset in use"}
      ${"2024-06-15T14:30:00+23:59"}                   | ${"202406151430+2359"} | ${"the largest offset the mask holds"}
      ${"2024-12-31T23:30:00-12:00"}                   | ${"202412312330-1200"} | ${"the local year, though the instant is in 2025"}
      ${"0000-01-01T00:30:00+02:00"}                   | ${"000001010030+0200"} | ${"local year 0000, though the instant's UTC year is before it"}
      ${"9999-12-31T23:30:00-02:00"}                   | ${"999912312330-0200"} | ${"local year 9999, though the instant's UTC year is after it"}
      ${"2024-11-03T01:30:00-04:00[America/New_York]"} | ${"202411030130-0400"} | ${"the first 01:30 of New York's fall-back day"}
      ${"2024-11-03T01:30:00-05:00[America/New_York]"} | ${"202411030130-0500"} | ${"the second 01:30 of that day: the offset tells them apart"}
      ${"2024-03-10T07:30:00Z[America/New_York]"}      | ${"202403100330-0400"} | ${"07:30Z on New York's spring-forward day is 03:30 at −04:00"}
      ${"2024-06-15T12:30:00Z"}                        | ${"202406151230+0000"} | ${"Z is +0000"}
      ${"2024-06-15T12:30:00+00:00"}                   | ${"202406151230+0000"} | ${"+00:00"}
      ${"2024-06-15T12:30:00-00:00"}                   | ${"202406151230+0000"} | ${"-00:00 is +0000"}
      ${"2024-06-15T14:30+02:00"}                      | ${"202406151430+0200"} | ${"no seconds in the value"}
      ${"2024-01-01T00:30:00+02:00"}                   | ${"202401010030+0200"} | ${"the local year, though the instant is in 2023"}
      ${"2024-06-15T14:30:00+02:00[Europe/Berlin]"}    | ${"202406151430+0200"} | ${"a bracketed zone that agrees with the offset"}
      ${"2024-06-15T12:30:00Z[Europe/Berlin]"}         | ${"202406151430+0200"} | ${"Z with a bracketed zone: the zone's wall clock and offset"}
    `("writes $value as $expected ($reads)", ({ value, expected }) => {
      expect(formatEdifactDtm(value, "205")).toBe(expected);
    });

    it.each`
      value                                            | reads
      ${"2024-06-15T14:30:45+02:00"}                   | ${"non-zero seconds under a minute code"}
      ${"2024-06-15T14:30:00.5+02:00"}                 | ${"a fraction of a second"}
      ${"2024-06-15T14:30:00+02:00:30"}                | ${"offset seconds: ZHHMM holds hours and minutes"}
      ${"2024-06-15T14:30:00"}                         | ${"a local date-time: no offset to write"}
      ${"2024-06-15"}                                  | ${"a date"}
      ${"2024-06-15T14:30:00+0200"}                    | ${"a basic-format offset"}
      ${"2024-06-15T14:30:00+03:00[Europe/Berlin]"}    | ${"an offset that contradicts its bracketed zone"}
      ${"2024-06-15T14:30:00+02:00[Not/AZone]"}        | ${"a bracketed zone that does not exist"}
      ${"+010000-01-01T00:30:00+01:00"}                | ${"local year 10000, though the instant is in 9999"}
      ${"-000001-12-31T23:30:00-01:00"}                | ${"local year −1, though the instant is in 0000"}
      ${"2024-03-10T02:30:00-05:00[America/New_York]"} | ${"02:30 does not exist on New York's spring-forward day: the offset contradicts the zone"}
      ${"2023-02-29T14:30:00+02:00"}                   | ${"29 February 2023"}
    `("returns the sentinel for $value ($reads)", ({ value }) => {
      expect(formatEdifactDtm(value, "205")).toBe("");
    });

    // The battle-test zones, each holding the same instant on its own clock. `ZHHMM` holds every
    // zone's offset; `ZZZ` holds whole hours, so 303 refuses the half-hour and 45-minute zones.
    // What 205 writes reads back as the zone's own wall clock, its offset, and the one instant.
    it.each(
      sameInstantBattleCases.map(({ timeZone, value, utc }) => ({
        timeZone,
        value,
        utc,
        ...BATTLE_WIRES[timeZone],
      })),
    )(
      "writes $value as $dtm205 under 205 and '$dtm303' under 303, and reads 205 back as $local at $offset, the instant $utc",
      ({ value, utc, offset, local, dtm205, dtm303 }) => {
        const zoned = Temporal.ZonedDateTime.from(value);
        expect(zoned.offset).toBe(offset);
        expect(zoned.toPlainDateTime().toString()).toBe(local);
        expect(formatEdifactDtm(value, "205")).toBe(dtm205);
        expect(formatEdifactDtm(value, "303")).toBe(dtm303);
        expect(parseEdifactDtm(dtm205, "205")).toEqual({
          local,
          offset,
          instant: utc,
        });
      },
    );
  });

  describe("206 YYMMDDHHMMZHHMM, 207 YYMMDDHHMMSSZHHMM, 208 CCYYMMDDHHMMSSZHHMM, 209 HHMMSSZHHMM: a signed HHMM offset (D.12A on)", () => {
    // UNTDID 2379, codes 206–209: "Z = leading plus/minus sign, HHMM = difference to UTC in
    // Hours and Minutes." The digits are the wall clock at the value's own offset, read off the
    // ISO string by hand; 206 and 207 write the last two digits of the local year.
    it.each`
      code     | value                                    | options        | expected                 | reads
      ${"206"} | ${"2024-06-15T14:30:00+02:00"}           | ${WINDOW_2000} | ${"2406151430+0200"}     | ${"two-digit year, minutes"}
      ${"206"} | ${"2024-06-15T14:30:00+05:45"}           | ${WINDOW_2000} | ${"2406151430+0545"}     | ${"a 45-minute offset fits ZHHMM"}
      ${"206"} | ${"2024-06-15T12:30:00Z"}                | ${WINDOW_2000} | ${"2406151230+0000"}     | ${"Z is +0000"}
      ${"207"} | ${"2024-06-15T14:30:45-05:00"}           | ${WINDOW_2000} | ${"240615143045-0500"}   | ${"two-digit year, seconds, a negative offset"}
      ${"207"} | ${"2024-06-15T14:30+02:00"}              | ${WINDOW_2000} | ${"240615143000+0200"}   | ${"no seconds in the value: written as 00"}
      ${"208"} | ${"2024-06-15T14:30:45+02:00"}           | ${undefined}   | ${"20240615143045+0200"} | ${"four-digit year, seconds"}
      ${"208"} | ${"2024-06-15T14:30:45-00:00"}           | ${undefined}   | ${"20240615143045+0000"} | ${"-00:00 is +0000"}
      ${"208"} | ${"2024-12-31T23:30:45-12:00"}           | ${undefined}   | ${"20241231233045-1200"} | ${"the local year, though the instant is in 2025"}
      ${"208"} | ${"2024-06-15T12:30:45Z[Europe/Berlin]"} | ${undefined}   | ${"20240615143045+0200"} | ${"Z with a bracketed zone: the zone's wall clock and offset"}
      ${"208"} | ${"9999-12-31T23:30:45-02:00"}           | ${undefined}   | ${"99991231233045-0200"} | ${"local year 9999, though the instant's UTC year is after it"}
      ${"209"} | ${"14:30:45+02:00"}                      | ${undefined}   | ${"143045+0200"}         | ${"the parser's time and offset joined"}
      ${"209"} | ${"14:30:45-05:30"}                      | ${undefined}   | ${"143045-0530"}         | ${"offset minutes fit ZHHMM, unlike 404's ZZZ"}
      ${"209"} | ${"14:30:45Z"}                           | ${undefined}   | ${"143045+0000"}         | ${"Z is +0000"}
      ${"209"} | ${"14:30+02:00"}                         | ${undefined}   | ${"143000+0200"}         | ${"no seconds in the value: written as 00"}
      ${"209"} | ${"00:00:00+14:00"}                      | ${undefined}   | ${"000000+1400"}         | ${"midnight is written as itself, not as the UTC time"}
    `(
      "$code writes $value as $expected ($reads)",
      ({ code, value, options, expected }) => {
        expect(formatEdifactDtm(value, code, options)).toBe(expected);
      },
    );

    it.each`
      code     | value                              | options        | reads
      ${"206"} | ${"2024-06-15T14:30:45+02:00"}     | ${WINDOW_2000} | ${"non-zero seconds under a minute code"}
      ${"206"} | ${"2024-06-15T14:30:00+02:00"}     | ${undefined}   | ${"a two-digit year with no window"}
      ${"206"} | ${"2124-06-15T14:30:00+02:00"}     | ${WINDOW_2000} | ${"a year outside 2000–2099"}
      ${"207"} | ${"2024-06-15T14:30:45.5+02:00"}   | ${WINDOW_2000} | ${"a fraction of a second"}
      ${"207"} | ${"2024-06-15T14:30:45"}           | ${WINDOW_2000} | ${"a local date-time: no offset to write"}
      ${"208"} | ${"2024-06-15T14:30:45+02:00:30"}  | ${undefined}   | ${"offset seconds: ZHHMM holds hours and minutes"}
      ${"208"} | ${"2024-06-15"}                    | ${undefined}   | ${"a date"}
      ${"208"} | ${"+010000-01-01T00:30:45+01:00"}  | ${undefined}   | ${"local year 10000, though the instant is in 9999"}
      ${"209"} | ${"14:30:45"}                      | ${undefined}   | ${"a time with no offset"}
      ${"209"} | ${"14:30:45.5+02:00"}              | ${undefined}   | ${"a fraction of a second"}
      ${"209"} | ${"14:30:45+02:00:30"}             | ${undefined}   | ${"offset seconds"}
      ${"209"} | ${"2024-06-15T14:30:45+02:00"}     | ${undefined}   | ${"a date-time given to a time code"}
      ${"209"} | ${"14:30:45+01:00[Europe/Berlin]"} | ${undefined}   | ${"a bracketed zone: a time has no date to check it against"}
      ${"209"} | ${"+02:00"}                        | ${undefined}   | ${"an offset alone"}
    `(
      "$code returns the sentinel for $value ($reads)",
      ({ code, value, options }) => {
        expect(formatEdifactDtm(value, code, options)).toBe("");
      },
    );
  });

  describe("303 CCYYMMDDHHMMZZZ and 304 CCYYMMDDHHMMSSZZZ: a date and time with a ±HH zone", () => {
    // GMT rule, one spelling: the zone is always the UN/ECE Recommendation 7 ¶12 signed hour.
    // The formatter never writes `UTC` or an abbreviation.
    it.each`
      code     | value                          | expected               | reads
      ${"303"} | ${"2024-06-15T14:30:00+02:00"} | ${"202406151430+02"}   | ${"what fromOffsetInstant returns"}
      ${"303"} | ${"2024-06-15T14:30:00-05:00"} | ${"202406151430-05"}   | ${"a negative offset keeps its sign"}
      ${"303"} | ${"2024-06-15T14:30:00Z"}      | ${"202406151430+00"}   | ${"Z is +00, never UTC"}
      ${"303"} | ${"2024-06-15T14:30:00+00:00"} | ${"202406151430+00"}   | ${"+00:00 is +00"}
      ${"303"} | ${"2024-06-15T14:30:00-00:00"} | ${"202406151430+00"}   | ${"-00:00 is +00"}
      ${"303"} | ${"2024-06-15T14:30:00+14:00"} | ${"202406151430+14"}   | ${"the largest offset in use"}
      ${"303"} | ${"2024-06-15T14:30:00-12:00"} | ${"202406151430-12"}   | ${"the most negative offset in use"}
      ${"303"} | ${"2024-06-15T14:30:00+13:00"} | ${"202406151430+13"}   | ${"thirteen hours east"}
      ${"303"} | ${"2024-06-15T14:30:00+23:00"} | ${"202406151430+23"}   | ${"the largest hour the mask reads back as an offset"}
      ${"303"} | ${"2024-01-01T00:30:00+02:00"} | ${"202401010030+02"}   | ${"the local year, though the instant is in 2023"}
      ${"303"} | ${"9999-12-31T23:30:00-02:00"} | ${"999912312330-02"}   | ${"local year 9999, though the instant's UTC year is after it"}
      ${"304"} | ${"2024-06-15T14:30:45+02:00"} | ${"20240615143045+02"} | ${"seconds"}
      ${"304"} | ${"2024-06-15T14:30:00Z"}      | ${"20240615143000+00"} | ${"zero seconds are written where the mask has SS"}
      ${"304"} | ${"2024-06-15T14:30:45.000Z"}  | ${"20240615143045+00"} | ${"a zero fraction is no fraction"}
    `(
      "writes $value under $code as $expected ($reads)",
      ({ code, value, expected }) => {
        expect(formatEdifactDtm(value, code)).toBe(expected);
      },
    );

    it.each`
      code     | value                             | reads
      ${"303"} | ${"2024-06-15T14:30:00+05:30"}    | ${"offset minutes: ZZZ holds a signed hour"}
      ${"303"} | ${"2024-06-15T14:30:00+05:45"}    | ${"offset minutes"}
      ${"303"} | ${"2024-06-15T14:30:00+12:45"}    | ${"a 45-minute offset past twelve hours"}
      ${"304"} | ${"2024-06-15T14:30:45-03:30"}    | ${"offset minutes under a second code"}
      ${"303"} | ${"2024-06-15T14:30:00+02:00:30"} | ${"offset seconds"}
      ${"303"} | ${"2024-06-15T14:30:45+02:00"}    | ${"non-zero seconds under a minute code"}
      ${"304"} | ${"2024-06-15T14:30:45.5+02:00"}  | ${"a fraction under a second code"}
      ${"303"} | ${"2024-06-15T14:30:00"}          | ${"a local date-time: no offset to write"}
      ${"303"} | ${"2024-06-15T14:30:00CET"}       | ${"an abbreviation is not an ISO 8601 offset"}
      ${"303"} | ${"2024-06-15T14:30:00UTC"}       | ${"the literal UTC is not an ISO 8601 designator"}
    `(
      "returns the sentinel for $value under $code ($reads)",
      ({ code, value }) => {
        expect(formatEdifactDtm(value, code)).toBe("");
      },
    );

    // 1969-12-31T23:15:30-00:45[Africa/Monrovia] is the epoch in a zone then at −00:44:30
    // (toOffsetInstant's own JSDoc example): the real offset has seconds, so no code can hold it.
    it.each`
      code
      ${"205"}
      ${"303"}
      ${"304"}
    `(
      "returns the sentinel under $code for a zone whose offset has seconds",
      ({ code }) => {
        expect(
          formatEdifactDtm("1969-12-31T23:15:30-00:45[Africa/Monrovia]", code),
        ).toBe("");
      },
    );
  });

  describe("404 HHMMSSZZZ: a time with a ±HH zone", () => {
    it.each`
      value               | expected       | reads
      ${"14:30:45+02:00"} | ${"143045+02"} | ${"the parser's time and offset joined"}
      ${"14:30:45-05:00"} | ${"143045-05"} | ${"a negative offset keeps its sign"}
      ${"14:30:45Z"}      | ${"143045+00"} | ${"Z is +00"}
      ${"14:30:45+00:00"} | ${"143045+00"} | ${"+00:00 is +00"}
      ${"14:30+02:00"}    | ${"143000+02"} | ${"no seconds in the value: written as 00"}
      ${"00:00:00+02:00"} | ${"000000+02"} | ${"midnight is written as itself, not as the UTC time"}
      ${"23:59:59-12:00"} | ${"235959-12"} | ${"the last second"}
    `("writes $value as $expected ($reads)", ({ value, expected }) => {
      expect(formatEdifactDtm(value, "404")).toBe(expected);
    });

    it.each`
      value                              | reads
      ${"14:30:45"}                      | ${"a time with no offset"}
      ${"14:30:45+05:30"}                | ${"offset minutes: ZZZ holds a signed hour"}
      ${"14:30:45.5+02:00"}              | ${"a fraction of a second"}
      ${"14:30:45+02:00:30"}             | ${"offset seconds"}
      ${"2024-06-15T14:30:45+02:00"}     | ${"a date-time given to a time code"}
      ${"T14:30:45+02:00"}               | ${"a leading T"}
      ${"14:30:45+0200"}                 | ${"a basic-format offset"}
      ${"14:30:45+02"}                   | ${"an hour-only offset"}
      ${"24:00:00+02:00"}                | ${"hour 24"}
      ${"23:59:60+02:00"}                | ${"a leap second"}
      ${"14:30:45+01:00[Europe/Berlin]"} | ${"a bracketed zone: a time has no date to check it against"}
      ${"14:30:45+02:00[foo=bar]"}       | ${"an annotation"}
      ${"+02:00"}                        | ${"an offset alone"}
    `("returns the sentinel for $value ($reads)", ({ value }) => {
      expect(formatEdifactDtm(value, "404")).toBe("");
    });
  });

  describe("406 ZHHMM: an offset from UTC alone", () => {
    it.each`
      value          | expected   | reads
      ${"+02:00"}    | ${"+0200"} | ${"the parser's offset"}
      ${"-05:30"}    | ${"-0530"} | ${"a negative half-hour offset"}
      ${"+05:45"}    | ${"+0545"} | ${"a quarter-hour offset"}
      ${"+00:00"}    | ${"+0000"} | ${"zero"}
      ${"-00:00"}    | ${"+0000"} | ${"-00:00 is +0000"}
      ${"+23:59"}    | ${"+2359"} | ${"the largest offset the shape allows"}
      ${"+02:00:00"} | ${"+0200"} | ${"zero offset seconds are no seconds"}
    `("writes $value as $expected ($reads)", ({ value, expected }) => {
      expect(formatEdifactDtm(value, "406")).toBe(expected);
    });

    it.each`
      value               | reads
      ${"-00:44:30"}      | ${"offset seconds: ZHHMM holds hours and minutes"}
      ${"Z"}              | ${"a designator, not an offset"}
      ${"+0200"}          | ${"the wire form, not ISO 8601"}
      ${"+02"}            | ${"hours only"}
      ${"02:00"}          | ${"no sign"}
      ${"+24:00"}         | ${"hour 24"}
      ${"14:30:00+02:00"} | ${"a time with an offset"}
      ${""}               | ${"an empty string"}
    `("returns the sentinel for $value ($reads)", ({ value }) => {
      expect(formatEdifactDtm(value, "406")).toBe("");
    });
  });

  describe("718 CCYYMMDD-CCYYMMDD and 719 CCYYMMDDHHMM-CCYYMMDDHHMM: a period", () => {
    // UNTDID 2379: "Data is to be transmitted as consecutive characters without hyphen" (718);
    // "Format of period to be given in actual message without hyphen" (719). The value is an
    // interval, <start>/<end>; the halves are run together.
    it.each`
      code     | value                                        | expected                      | reads
      ${"718"} | ${"2024-06-15/2024-06-20"}                   | ${"2024061520240620"}         | ${"six days"}
      ${"718"} | ${"2024-06-15/2024-06-15"}                   | ${"2024061520240615"}         | ${"one day: the end equals the start"}
      ${"718"} | ${"2023-12-31/2024-01-01"}                   | ${"2023123120240101"}         | ${"across a year end"}
      ${"718"} | ${"0000-01-01/9999-12-31"}                   | ${"0000010199991231"}         | ${"the whole four-digit range"}
      ${"719"} | ${"2024-06-15T14:30:00/2024-06-20T16:00:00"} | ${"202406151430202406201600"} | ${"a date-time period"}
      ${"719"} | ${"2024-06-15T14:30/2024-06-20T16:00"}       | ${"202406151430202406201600"} | ${"no seconds in the value"}
      ${"719"} | ${"2024-06-15T14:30:00/2024-06-15T14:30:00"} | ${"202406151430202406151430"} | ${"zero length"}
      ${"719"} | ${"2024-06-15T14:30:00/2024-06-15T14:31:00"} | ${"202406151430202406151431"} | ${"one minute"}
    `(
      "writes $value under $code as $expected ($reads)",
      ({ code, value, expected }) => {
        const out = formatEdifactDtm(value, code);
        expect(out).toBe(expected);
        expect(out.includes("-")).toBe(false);
      },
    );

    // The interval's solidus is the one outside any RFC 9557 bracket: an IANA zone name has its
    // own. Each half is then read as isValidDate and isValidDateTime read it, annotation and all.
    it.each`
      code     | value                                                                      | expected                      | reads
      ${"719"} | ${"2024-06-15T14:30:00[Europe/Berlin]/2024-06-20T16:00:00[Europe/Berlin]"} | ${"202406151430202406201600"} | ${"a zone annotation on each half"}
      ${"719"} | ${"2024-06-15T14:30:00[Europe/Berlin]/2024-06-20T16:00:00"}                | ${"202406151430202406201600"} | ${"a zone annotation on the start alone"}
      ${"718"} | ${"2024-06-15[u-ca=iso8601]/2024-06-20[u-ca=iso8601]"}                     | ${"2024061520240620"}         | ${"an ISO calendar annotation on each half"}
    `(
      "writes the annotated $value under $code as $expected ($reads)",
      ({ code, value, expected }) => {
        expect(formatEdifactDtm(value, code)).toBe(expected);
      },
    );

    it.each`
      code     | value                                                      | reads
      ${"719"} | ${"2024-06-15T14:30:00[Europe/Berlin/2024-06-20T16:00:00"} | ${"an unclosed bracket"}
      ${"719"} | ${"2024-06-15T14:30:00[!foo=bar]/2024-06-20T16:00:00"}     | ${"an unknown critical annotation"}
      ${"718"} | ${"2024-06-15[u-ca=hebrew]/2024-06-20"}                    | ${"a non-ISO calendar"}
    `(
      "returns the sentinel for the annotated $value under $code ($reads)",
      ({ code, value }) => {
        expect(formatEdifactDtm(value, code)).toBe("");
      },
    );

    it.each`
      code     | value                                          | reads
      ${"718"} | ${"2024-06-20/2024-06-15"}                     | ${"reversed: the end precedes the start"}
      ${"719"} | ${"2024-06-15T14:31:00/2024-06-15T14:30:00"}   | ${"reversed by one minute"}
      ${"718"} | ${"2024-06-15"}                                | ${"one date: no solidus"}
      ${"718"} | ${"2024-06-15/"}                               | ${"an empty end"}
      ${"718"} | ${"/2024-06-20"}                               | ${"an empty start"}
      ${"718"} | ${"2024-06-15/2024-06-18/2024-06-20"}          | ${"three halves"}
      ${"718"} | ${"2024-06-15/P5D"}                            | ${"a start and a duration"}
      ${"718"} | ${"2024-06-15--2024-06-20"}                    | ${"a double hyphen, not a solidus"}
      ${"718"} | ${"2024-06-15/2024-06-20T16:00:00"}            | ${"a date-time end under a date period"}
      ${"718"} | ${"2024-06-15T14:30:00/2024-06-20T16:00:00"}   | ${"date-times under a date period"}
      ${"719"} | ${"2024-06-15/2024-06-20"}                     | ${"dates under a date-time period"}
      ${"719"} | ${"2024-06-15T14:30:45/2024-06-20T16:00:00"}   | ${"non-zero seconds in the start"}
      ${"719"} | ${"2024-06-15T14:30:00/2024-06-20T16:00:00.5"} | ${"a fraction in the end"}
      ${"719"} | ${"2024-06-15T14:30:00Z/2024-06-20T16:00:00Z"} | ${"instants: a period code carries no offset"}
      ${"718"} | ${"2024-06-15/2024-06-31"}                     | ${"31 June in the end"}
      ${"718"} | ${"2023-02-29/2024-06-20"}                     | ${"29 February 2023 in the start"}
      ${"718"} | ${"2024-06-15/+010000-01-01"}                  | ${"year 10000 in the end"}
      ${"718"} | ${"2024061520240620"}                          | ${"the wire form, not ISO 8601"}
    `(
      "returns the sentinel for $value under $code ($reads)",
      ({ code, value }) => {
        expect(formatEdifactDtm(value, code)).toBe("");
      },
    );
  });

  describe("a two-digit year needs options.yearWindow (GMT rule: a round-trip never changes a century)", () => {
    // 2024 is in all three windows: 2000–2099, 1950–2049 and the rolling 1976–2075 of 2026.
    it.each`
      code     | value                                        | expected
      ${"101"} | ${"2024-06-15"}                              | ${"240615"}
      ${"201"} | ${"2024-06-15T14:30:00"}                     | ${"2406151430"}
      ${"202"} | ${"2024-06-15T14:30:45"}                     | ${"240615143045"}
      ${"206"} | ${"2024-06-15T14:30:00+02:00"}               | ${"2406151430+0200"}
      ${"207"} | ${"2024-06-15T14:30:45+02:00"}               | ${"240615143045+0200"}
      ${"301"} | ${"2024-06-15T14:30:00+02:00"}               | ${"2406151430+02"}
      ${"302"} | ${"2024-06-15T14:30:45+02:00"}               | ${"240615143045+02"}
      ${"713"} | ${"2024-06-15T14:30:00/2024-06-20T16:00:00"} | ${"24061514302406201600"}
      ${"717"} | ${"2024-06-15/2024-06-20"}                   | ${"240615240620"}
    `(
      "$code writes $value as $expected with 2000, 1950 and rolling in 2026, and the sentinel with no window",
      ({ code, value, expected }) => {
        setNow(NOW_2026);
        expect(formatEdifactDtm(value, code)).toBe("");
        expect(formatEdifactDtm(value, code, {})).toBe("");
        expect(formatEdifactDtm(value, code, WINDOW_2000)).toBe(expected);
        expect(formatEdifactDtm(value, code, WINDOW_1950)).toBe(expected);
        expect(formatEdifactDtm(value, code, { yearWindow: "rolling" })).toBe(
          expected,
        );
      },
    );

    // A year is written only when the window holds it: the parser would otherwise read the two
    // digits back as a different century.
    it.each`
      value           | yearWindow | expected    | reads
      ${"2000-01-01"} | ${2000}    | ${"000101"} | ${"the first year of 2000–2099"}
      ${"2099-12-31"} | ${2000}    | ${"991231"} | ${"the last year of 2000–2099"}
      ${"1999-12-31"} | ${2000}    | ${""}       | ${"one year before 2000–2099"}
      ${"2100-01-01"} | ${2000}    | ${""}       | ${"one year after 2000–2099"}
      ${"1969-01-01"} | ${2000}    | ${""}       | ${"the story's row: 1969 is outside 2000–2099"}
      ${"1969-01-01"} | ${1969}    | ${"690101"} | ${"the first year of 1969–2068"}
      ${"2068-12-31"} | ${1969}    | ${"681231"} | ${"the last year of 1969–2068"}
      ${"2069-01-01"} | ${1969}    | ${""}       | ${"one year after 1969–2068"}
      ${"1950-01-01"} | ${1950}    | ${"500101"} | ${"the first year of 1950–2049"}
      ${"2049-12-31"} | ${1950}    | ${"491231"} | ${"the last year of 1950–2049"}
      ${"1949-12-31"} | ${1950}    | ${""}       | ${"one year before 1950–2049"}
      ${"2050-01-01"} | ${1950}    | ${""}       | ${"one year after 1950–2049"}
      ${"0000-01-01"} | ${0}       | ${"000101"} | ${"the lowest window, 0000–0099"}
      ${"0100-01-01"} | ${0}       | ${""}       | ${"one year after 0000–0099"}
      ${"9999-12-31"} | ${9900}    | ${"991231"} | ${"the highest window, 9900–9999"}
      ${"9899-12-31"} | ${9900}    | ${""}       | ${"one year before 9900–9999"}
    `(
      "101 writes $value with yearWindow $yearWindow as '$expected' ($reads)",
      ({ value, yearWindow, expected }) => {
        expect(formatEdifactDtm(value, "101", { yearWindow })).toBe(expected);
      },
    );

    // Rolling in 2026 is 1976–2075; a fixed window gives the same answer in any year.
    it.each`
      value           | rolling     | fixed1950   | reads
      ${"1976-01-01"} | ${"760101"} | ${"760101"} | ${"the first rolling year"}
      ${"2075-12-31"} | ${"751231"} | ${""}       | ${"the last rolling year, outside 1950–2049"}
      ${"1975-12-31"} | ${""}       | ${"751231"} | ${"one year before the rolling window"}
      ${"2076-01-01"} | ${""}       | ${""}       | ${"one year after the rolling window"}
    `(
      "101 writes $value in 2026 as '$rolling' with rolling and '$fixed1950' with 1950 ($reads)",
      ({ value, rolling, fixed1950 }) => {
        setNow(NOW_2026);
        expect(formatEdifactDtm(value, "101", { yearWindow: "rolling" })).toBe(
          rolling,
        );
        expect(formatEdifactDtm(value, "101", WINDOW_1950)).toBe(fixed1950);
      },
    );

    // GMT rule: rolling runs from 50 years before the current UTC year to 49 after it, so it
    // moves at the UTC new year: 1999–2098 through UTC 2049, 2000–2099 from UTC 2050. The last
    // three rows are instants whose local date and UTC date fall in different years: the UTC
    // year decides.
    it.each`
      now                            | value           | expected    | reads
      ${"2049-12-31T23:59:59Z"}      | ${"1999-06-15"} | ${"990615"} | ${"1999 is the first year of 1999–2098"}
      ${"2049-12-31T23:59:59Z"}      | ${"2099-06-15"} | ${""}       | ${"2099 is one year after 1999–2098"}
      ${"2050-01-01T00:00:00Z"}      | ${"1999-06-15"} | ${""}       | ${"1999 is one year before 2000–2099"}
      ${"2050-01-01T00:00:00Z"}      | ${"2099-06-15"} | ${"990615"} | ${"2099 is the last year of 2000–2099"}
      ${"2050-01-01T00:00:00+02:00"} | ${"1999-06-15"} | ${"990615"} | ${"22:00Z on 31 December 2049: still 1999–2098"}
      ${"2049-12-31T23:59:59-05:00"} | ${"1999-06-15"} | ${""}       | ${"04:59:59Z on 1 January 2050: already 2000–2099"}
      ${"2049-12-31T23:59:59-05:00"} | ${"2099-06-15"} | ${"990615"} | ${"04:59:59Z on 1 January 2050: already 2000–2099"}
    `(
      "101 writes $value at $now as '$expected' with rolling ($reads)",
      ({ now, value, expected }) => {
        setNow(now);
        expect(formatEdifactDtm(value, "101", { yearWindow: "rolling" })).toBe(
          expected,
        );
      },
    );

    it("returns the sentinel for a rolling window when the clock cannot be read", () => {
      mockTemporalNowInstantThrow();
      expect(
        formatEdifactDtm("2024-06-15", "101", { yearWindow: "rolling" }),
      ).toBe("");
    });

    // A two-digit code holds what its four-digit sibling holds and no more: nothing is rounded
    // to fit, and a reversed period is refused.
    it.each`
      code     | value                                        | reads
      ${"201"} | ${"2024-06-15T14:30:45"}                     | ${"non-zero seconds under a minute code"}
      ${"202"} | ${"2024-06-15T14:30:45.5"}                   | ${"a fraction of a second"}
      ${"201"} | ${"2024-06-15T14:30:00+02:00"}               | ${"an offset given to an offsetless code"}
      ${"301"} | ${"2024-06-15T14:30:00+05:30"}               | ${"offset minutes: ZZZ holds a signed hour"}
      ${"302"} | ${"2024-06-15T14:30:45+05:45"}               | ${"offset minutes under a second code"}
      ${"301"} | ${"2024-06-15T14:30:00"}                     | ${"a local date-time: no offset to write"}
      ${"713"} | ${"2024-06-15T14:30:45/2024-06-20T16:00:00"} | ${"non-zero seconds in the start"}
      ${"713"} | ${"2024-06-20T16:00:00/2024-06-15T14:30:00"} | ${"reversed: the end precedes the start"}
      ${"717"} | ${"2024-06-20/2024-06-15"}                   | ${"reversed: the end precedes the start"}
      ${"717"} | ${"2024-06-15T14:30:00/2024-06-20T16:00:00"} | ${"date-times under a date period"}
    `(
      "$code returns the sentinel for $value in 2000–2099 ($reads)",
      ({ code, value }) => {
        expect(formatEdifactDtm(value, code, WINDOW_2000)).toBe("");
      },
    );

    // Both halves of a period are held to the window, and a period may cross a century inside it.
    it.each`
      value                      | yearWindow | expected          | reads
      ${"1999-12-31/2000-01-01"} | ${1950}    | ${"991231000101"} | ${"across 2000 inside 1950–2049"}
      ${"1999-12-31/2000-01-01"} | ${2000}    | ${""}             | ${"the start is outside 2000–2099"}
      ${"2099-12-31/2100-01-01"} | ${2000}    | ${""}             | ${"the end is outside 2000–2099"}
    `(
      "717 writes $value with yearWindow $yearWindow as '$expected' ($reads)",
      ({ value, yearWindow, expected }) => {
        expect(formatEdifactDtm(value, "717", { yearWindow })).toBe(expected);
      },
    );

    // The year held to the window is the local one, the year the mask's digits spell.
    it.each`
      value                          | yearWindow | expected           | reads
      ${"2000-01-01T00:30:00+02:00"} | ${2000}    | ${"0001010030+02"} | ${"local year 2000, though the instant is in 1999"}
      ${"1999-12-31T23:30:00-02:00"} | ${2000}    | ${""}              | ${"local year 1999, though the instant is in 2000"}
    `(
      "301 writes $value with yearWindow $yearWindow as '$expected' ($reads)",
      ({ value, yearWindow, expected }) => {
        expect(formatEdifactDtm(value, "301", { yearWindow })).toBe(expected);
      },
    );

    it.each`
      yearWindow                  | reads
      ${undefined}                | ${"undefined"}
      ${null}                     | ${"null"}
      ${-1}                       | ${"a negative year"}
      ${9901}                     | ${"a start whose window would pass year 9999"}
      ${1950.5}                   | ${"a non-integer"}
      ${Number.NaN}               | ${"NaN"}
      ${Number.POSITIVE_INFINITY} | ${"Infinity"}
      ${"2000"}                   | ${"a numeric string"}
      ${"Rolling"}                | ${"a different case"}
    `(
      "101 returns the sentinel for yearWindow $yearWindow ($reads)",
      ({ yearWindow }) => {
        expect(
          formatEdifactDtm("2024-06-15", "101", { yearWindow } as never),
        ).toBe("");
      },
    );

    // A code with a four-digit year never reads the option, valid or not.
    it.each`
      code     | value                          | expected
      ${"102"} | ${"1969-01-01"}                | ${"19690101"}
      ${"203"} | ${"1969-01-01T14:30:00"}       | ${"196901011430"}
      ${"303"} | ${"1969-01-01T14:30:00+02:00"} | ${"196901011430+02"}
      ${"401"} | ${"14:30:00"}                  | ${"1430"}
      ${"406"} | ${"+02:00"}                    | ${"+0200"}
      ${"718"} | ${"1969-01-01/2069-01-01"}     | ${"1969010120690101"}
    `(
      "$code writes $value as $expected with no options, {}, 2000, rolling and an invalid window",
      ({ code, value, expected }) => {
        mockTemporalNowInstantThrow();
        for (const options of [
          undefined,
          {},
          WINDOW_2000,
          { yearWindow: "rolling" },
          { yearWindow: 9901 },
        ]) {
          expect(formatEdifactDtm(value, code, options as never)).toBe(
            expected,
          );
        }
      },
    );
  });

  describe("round-trips through parseEdifactDtm, for every supported code", () => {
    // `parsed` is what the value states, decided from the ISO string alone: a date stays a
    // date, a local date-time gains its :00 seconds, and 14:30 at +02:00 is `local` 14:30,
    // `offset` +02:00 and `instant` 12:30Z.
    // Keyed by the code union, so a supported code with no row fails typecheck.
    const ROUND_TRIPS: Record<
      EdifactDtmFormat,
      { value: string; wire: string; parsed: EdiDateTime }
    > = {
      "101": {
        value: "2024-06-15",
        wire: "240615",
        parsed: { date: "2024-06-15" },
      },
      "102": {
        value: "2024-06-15",
        wire: "20240615",
        parsed: { date: "2024-06-15" },
      },
      "201": {
        value: "2024-06-15T14:30:00",
        wire: "2406151430",
        parsed: { local: "2024-06-15T14:30:00" },
      },
      "202": {
        value: "2024-06-15T14:30:45",
        wire: "240615143045",
        parsed: { local: "2024-06-15T14:30:45" },
      },
      "203": {
        value: "2024-06-15T14:30:00",
        wire: "202406151430",
        parsed: { local: "2024-06-15T14:30:00" },
      },
      "204": {
        value: "2024-06-15T14:30:45",
        wire: "20240615143045",
        parsed: { local: "2024-06-15T14:30:45" },
      },
      "205": {
        value: "2024-06-15T14:30:00+05:30",
        wire: "202406151430+0530",
        parsed: {
          local: "2024-06-15T14:30:00",
          offset: "+05:30",
          instant: "2024-06-15T09:00:00Z",
        },
      },
      "206": {
        value: "2024-06-15T14:30:00+05:30",
        wire: "2406151430+0530",
        parsed: {
          local: "2024-06-15T14:30:00",
          offset: "+05:30",
          instant: "2024-06-15T09:00:00Z",
        },
      },
      "207": {
        value: "2024-06-15T14:30:45-05:00",
        wire: "240615143045-0500",
        parsed: {
          local: "2024-06-15T14:30:45",
          offset: "-05:00",
          instant: "2024-06-15T19:30:45Z",
        },
      },
      "208": {
        value: "2024-06-15T14:30:45+02:00",
        wire: "20240615143045+0200",
        parsed: {
          local: "2024-06-15T14:30:45",
          offset: "+02:00",
          instant: "2024-06-15T12:30:45Z",
        },
      },
      "209": {
        value: "14:30:45+02:00",
        wire: "143045+0200",
        parsed: { time: "14:30:45", offset: "+02:00" },
      },
      "301": {
        value: "2024-06-15T14:30:00+02:00",
        wire: "2406151430+02",
        parsed: {
          local: "2024-06-15T14:30:00",
          offset: "+02:00",
          instant: "2024-06-15T12:30:00Z",
        },
      },
      "302": {
        value: "2024-06-15T14:30:45-05:00",
        wire: "240615143045-05",
        parsed: {
          local: "2024-06-15T14:30:45",
          offset: "-05:00",
          instant: "2024-06-15T19:30:45Z",
        },
      },
      "303": {
        value: "2024-06-15T14:30:00-05:00",
        wire: "202406151430-05",
        parsed: {
          local: "2024-06-15T14:30:00",
          offset: "-05:00",
          instant: "2024-06-15T19:30:00Z",
        },
      },
      "304": {
        value: "2024-06-15T14:30:45+02:00",
        wire: "20240615143045+02",
        parsed: {
          local: "2024-06-15T14:30:45",
          offset: "+02:00",
          instant: "2024-06-15T12:30:45Z",
        },
      },
      "401": {
        value: "14:30:00",
        wire: "1430",
        parsed: { time: "14:30:00" },
      },
      "402": {
        value: "14:30:45",
        wire: "143045",
        parsed: { time: "14:30:45" },
      },
      "404": {
        value: "14:30:45+02:00",
        wire: "143045+02",
        parsed: { time: "14:30:45", offset: "+02:00" },
      },
      "406": {
        value: "-05:30",
        wire: "-0530",
        parsed: { offset: "-05:30" },
      },
      "713": {
        value: "2024-06-15T14:30:00/2024-06-20T16:00:00",
        wire: "24061514302406201600",
        parsed: {
          local: "2024-06-15T14:30:00",
          periodEnd: { local: "2024-06-20T16:00:00" },
        },
      },
      "717": {
        value: "2024-06-15/2024-06-20",
        wire: "240615240620",
        parsed: { date: "2024-06-15", periodEnd: { date: "2024-06-20" } },
      },
      "718": {
        value: "2024-06-15/2024-06-20",
        wire: "2024061520240620",
        parsed: { date: "2024-06-15", periodEnd: { date: "2024-06-20" } },
      },
      "719": {
        value: "2024-06-15T14:30:00/2024-06-20T16:00:00",
        wire: "202406151430202406201600",
        parsed: {
          local: "2024-06-15T14:30:00",
          periodEnd: { local: "2024-06-20T16:00:00" },
        },
      },
    };

    /** The ISO 8601 string a caller builds from one half of a parsed value. */
    function isoOf(half: EdiDateTime): string {
      if (half.instant !== undefined && half.offset !== undefined) {
        return fromOffsetInstant({
          instant: half.instant,
          offset: half.offset,
        });
      }
      if (half.time !== undefined) {
        return `${half.time}${half.offset ?? ""}`;
      }
      return half.date ?? half.local ?? half.offset ?? "";
    }

    /** A wire value read in 2000–2099 and written as the ISO 8601 string a caller would build. */
    function readBack(wire: string, code: string): string {
      const parsed = parseEdifactDtm(wire, code, WINDOW_2000);
      if (parsed === null) {
        return "";
      }
      return parsed.periodEnd === undefined
        ? isoOf(parsed)
        : `${isoOf(parsed)}/${isoOf(parsed.periodEnd)}`;
    }

    it.each(
      EDIFACT_DTM_FORMATS.map((code) => ({ code, ...ROUND_TRIPS[code] })),
    )(
      "$code: $value writes $wire, which parses to $parsed and writes back $wire",
      ({ code, value, wire, parsed }) => {
        // yearWindow is read by the two-digit codes only.
        expect(formatEdifactDtm(value, code, WINDOW_2000)).toBe(wire);
        expect(parseEdifactDtm(wire, code, WINDOW_2000)).toEqual(parsed);
        expect(
          parseEdifactDtm(
            formatEdifactDtm(value, code, WINDOW_2000),
            code,
            WINDOW_2000,
          ),
        ).toEqual(parsed);

        const iso =
          parsed.periodEnd === undefined
            ? isoOf(parsed)
            : `${isoOf(parsed)}/${isoOf(parsed.periodEnd)}`;
        expect(formatEdifactDtm(iso, code, WINDOW_2000)).toBe(wire);
      },
    );

    // A date-time with an offset reads back as `local`, `offset` and `instant`. `local` followed
    // by `offset` is the ISO 8601 string the formatter takes, and `fromOffsetInstant` builds the
    // same string from `instant` and `offset`: either way the caller writes the value it read.
    it.each(
      (["205", "206", "207", "208", "301", "302", "303", "304"] as const).map(
        (code) => ({ code, ...ROUND_TRIPS[code] }),
      ),
    )(
      "$code: $wire reads back as a local and an offset that join to $value, the string fromOffsetInstant builds",
      ({ code, value, wire }) => {
        const read = parseEdifactDtm(wire, code, WINDOW_2000);
        expect(`${read?.local}${read?.offset}`).toBe(value);
        expect(
          fromOffsetInstant({
            instant: read?.instant ?? "",
            offset: read?.offset ?? "",
          }),
        ).toBe(value);
        expect(
          formatEdifactDtm(`${read?.local}${read?.offset}`, code, WINDOW_2000),
        ).toBe(wire);
      },
    );

    // GMT rule: a two-digit year is written only inside the caller's window, so reading the
    // value back with the same window gives the year that was written. Each code at the first
    // and the last year of 2000–2099 reads back as itself; one year before and one year after
    // have no two digits in the window and return the sentinel. For 206, 207, 301 and 302 the
    // year held to the window is the local one: 23:59 at −05:00 on 31 December 1999 is an instant in 2000.
    it.each`
      code     | first                                        | firstWire                 | last                                         | lastWire                  | before                                       | after
      ${"101"} | ${"2000-01-01"}                              | ${"000101"}               | ${"2099-12-31"}                              | ${"991231"}               | ${"1999-12-31"}                              | ${"2100-01-01"}
      ${"201"} | ${"2000-01-01T00:00:00"}                     | ${"0001010000"}           | ${"2099-12-31T23:59:00"}                     | ${"9912312359"}           | ${"1999-12-31T23:59:00"}                     | ${"2100-01-01T00:00:00"}
      ${"202"} | ${"2000-01-01T00:00:00"}                     | ${"000101000000"}         | ${"2099-12-31T23:59:59"}                     | ${"991231235959"}         | ${"1999-12-31T23:59:59"}                     | ${"2100-01-01T00:00:00"}
      ${"206"} | ${"2000-01-01T00:00:00+02:00"}               | ${"0001010000+0200"}      | ${"2099-12-31T23:59:00-05:00"}               | ${"9912312359-0500"}      | ${"1999-12-31T23:59:00-05:00"}               | ${"2100-01-01T00:00:00+02:00"}
      ${"207"} | ${"2000-01-01T00:00:00+02:00"}               | ${"000101000000+0200"}    | ${"2099-12-31T23:59:59-05:00"}               | ${"991231235959-0500"}    | ${"1999-12-31T23:59:59-05:00"}               | ${"2100-01-01T00:00:00+02:00"}
      ${"301"} | ${"2000-01-01T00:00:00+02:00"}               | ${"0001010000+02"}        | ${"2099-12-31T23:59:00-05:00"}               | ${"9912312359-05"}        | ${"1999-12-31T23:59:00-05:00"}               | ${"2100-01-01T00:00:00+02:00"}
      ${"302"} | ${"2000-01-01T00:00:00+02:00"}               | ${"000101000000+02"}      | ${"2099-12-31T23:59:59-05:00"}               | ${"991231235959-05"}      | ${"1999-12-31T23:59:59-05:00"}               | ${"2100-01-01T00:00:00+02:00"}
      ${"713"} | ${"2000-01-01T00:00:00/2000-01-02T00:00:00"} | ${"00010100000001020000"} | ${"2099-12-30T23:59:00/2099-12-31T23:59:00"} | ${"99123023599912312359"} | ${"1999-12-31T23:59:00/2000-01-01T00:00:00"} | ${"2099-12-31T23:59:00/2100-01-01T00:00:00"}
      ${"717"} | ${"2000-01-01/2000-01-02"}                   | ${"000101000102"}         | ${"2099-12-30/2099-12-31"}                   | ${"991230991231"}         | ${"1999-12-31/2000-01-01"}                   | ${"2099-12-31/2100-01-01"}
    `(
      "$code in 2000–2099 writes $first as $firstWire and $last as $lastWire, reads both back unchanged, and refuses $before and $after",
      ({ code, first, firstWire, last, lastWire, before, after }) => {
        expect(formatEdifactDtm(first, code, WINDOW_2000)).toBe(firstWire);
        expect(formatEdifactDtm(last, code, WINDOW_2000)).toBe(lastWire);
        expect(readBack(firstWire, code)).toBe(first);
        expect(readBack(lastWire, code)).toBe(last);
        expect(formatEdifactDtm(before, code, WINDOW_2000)).toBe("");
        expect(formatEdifactDtm(after, code, WINDOW_2000)).toBe("");
      },
    );

    // The instants above are the wall clock minus the offset; plain Temporal agrees.
    it.each`
      local                    | offset      | instant
      ${"2024-06-15T14:30:00"} | ${"+05:30"} | ${"2024-06-15T09:00:00Z"}
      ${"2024-06-15T14:30:00"} | ${"+02:00"} | ${"2024-06-15T12:30:00Z"}
      ${"2024-06-15T14:30:45"} | ${"-05:00"} | ${"2024-06-15T19:30:45Z"}
      ${"2024-06-15T14:30:00"} | ${"-05:00"} | ${"2024-06-15T19:30:00Z"}
      ${"2024-06-15T14:30:45"} | ${"+02:00"} | ${"2024-06-15T12:30:45Z"}
    `(
      "$local at $offset is the instant $instant",
      ({ local, offset, instant }) => {
        expect(Temporal.Instant.from(`${local}${offset}`).toString()).toBe(
          instant,
        );
      },
    );

    it.each`
      code
      ${"713"}
      ${"717"}
      ${"718"}
      ${"719"}
    `("never writes a hyphen for the period code $code", ({ code }) => {
      const { value } = ROUND_TRIPS[code as EdifactDtmFormat];
      expect(formatEdifactDtm(value, code, WINDOW_2000)).not.toContain("-");
    });

    // A value parsed as zone text has no offset, and the formatter writes no abbreviation.
    it("cannot write back a 303 value parsed as local and zone text", () => {
      expect(parseEdifactDtm("202406151430CET", "303")).toEqual({
        local: "2024-06-15T14:30:00",
        zone: "CET",
      });
      expect(formatEdifactDtm("2024-06-15T14:30:00", "303")).toBe("");
    });
  });

  describe("an unsupported format code", () => {
    it.each`
      code             | reads
      ${"2"}           | ${"a day-first or month-first date"}
      ${"3"}           | ${"a day-first or month-first date"}
      ${"4"}           | ${"a day-first or month-first date"}
      ${"5"}           | ${"a day-first or month-first date"}
      ${"10"}          | ${"CCYYMMDDTHHMM"}
      ${"103"}         | ${"the week date"}
      ${"105"}         | ${"the ordinal date"}
      ${"210"}         | ${"a time period with offsets"}
      ${"307"}         | ${"a date and time with milliseconds"}
      ${"308"}         | ${"a zoned period"}
      ${"711"}         | ${"CCYYMMDD-CCYYMMDD, removed in D.03B"}
      ${"501"}         | ${"a time span"}
      ${"502"}         | ${"a time span"}
      ${"503"}         | ${"a time span"}
      ${"602"}         | ${"a partial value"}
      ${"720"}         | ${"a weekday period"}
      ${"801"}         | ${"a quantity"}
      ${"999"}         | ${"not a 2379 code"}
      ${""}            | ${"an empty code"}
      ${"0102"}        | ${"102 with a leading zero"}
      ${" 102"}        | ${"102 with a leading space"}
      ${"D8"}          | ${"an X12 1250 code"}
      ${"constructor"} | ${"an inherited property name"}
    `("returns the sentinel for code $code ($reads)", ({ code }) => {
      expect(formatEdifactDtm("2024-06-15", code, WINDOW_2000)).toBe("");
      expect(formatEdifactDtm("2024-06-15T14:30:00", code, WINDOW_2000)).toBe(
        "",
      );
      expect(formatEdifactDtm("14:30:00", code, WINDOW_2000)).toBe("");
    });
  });

  describe("the options argument (Temporal GetOptionsObject)", () => {
    it.each`
      make          | kind
      ${() => null} | ${"null"}
      ${() => "x"}  | ${"a string"}
      ${() => 1}    | ${"a number"}
      ${() => true} | ${"a boolean"}
    `(
      "returns the sentinel for options that are $kind, for the four-digit 102 and the two-digit 101",
      ({ make }) => {
        expect(formatEdifactDtm("2024-06-15", "102", make() as never)).toBe("");
        expect(formatEdifactDtm("2024-06-15", "101", make() as never)).toBe("");
      },
    );

    it("reads a function carrying yearWindow as an options bag", () => {
      const options = Object.assign(() => 0, { yearWindow: 2000 });
      expect(formatEdifactDtm("2024-06-15", "101", options as never)).toBe(
        "240615",
      );
    });

    // A hostile bag is an Object, so it passes the guard; only a two-digit-year code reads it.
    it.each`
      make                                                                | kind
      ${() => hostileProxy()}                                             | ${"a Proxy that throws on any trap"}
      ${() => revokedProxy()}                                             | ${"a revoked Proxy"}
      ${() => Object.defineProperty({}, "yearWindow", { get: throwing })} | ${"an object whose yearWindow getter throws"}
    `(
      "returns the sentinel for the two-digit 101 with options that are $kind, and never reads them for 102",
      ({ make }) => {
        expect(formatEdifactDtm("2024-06-15", "101", make() as never)).toBe("");
        expect(formatEdifactDtm("2024-06-15", "102", make() as never)).toBe(
          "20240615",
        );
      },
    );
  });

  describe("non-string arguments", () => {
    // A non-string collapses to one path per argument. A period code splits its value before it
    // reads it, so the value is tried under a single-value code and a period code.
    it.each`
      argument                        | call
      ${"value under 102"}            | ${(bad: unknown) => formatEdifactDtm(bad as never, "102")}
      ${"value under the period 718"} | ${(bad: unknown) => formatEdifactDtm(bad as never, "718")}
      ${"formatQualifier"}            | ${(bad: unknown) => formatEdifactDtm("2024-06-15", bad as never)}
    `(
      "returns the sentinel for a $argument that is not a string",
      ({ call }) => {
        for (const [kind, make] of NON_STRINGS) {
          expect(call(make()), kind).toBe("");
        }
      },
    );
  });

  describe("the catch path", () => {
    it("returns the sentinel when Temporal.PlainDate.from throws", () => {
      mockTemporalPlainDateFromThrow();
      expect(formatEdifactDtm("2024-06-15", "102")).toBe("");
      expect(formatEdifactDtm("2024-06-15/2024-06-20", "718")).toBe("");
    });

    it("returns the sentinel when Temporal.PlainDateTime.from throws", () => {
      mockTemporalPlainDateTimeFromThrow();
      expect(formatEdifactDtm("2024-06-15T14:30:00", "203")).toBe("");
    });

    it("returns the sentinel when Temporal.PlainTime.from throws", () => {
      mockTemporalPlainTimeFromThrow();
      expect(formatEdifactDtm("14:30:00", "401")).toBe("");
    });

    it("returns the sentinel when Temporal.Instant.from throws", () => {
      mockTemporalInstantFromThrow();
      expect(formatEdifactDtm("2024-06-15T14:30:00+02:00", "205")).toBe("");
      expect(formatEdifactDtm("2024-06-15T14:30:00+02:00", "303")).toBe("");
      expect(formatEdifactDtm("14:30:45+02:00", "404")).toBe("");
      expect(formatEdifactDtm("+02:00", "406")).toBe("");
    });
  });
});
