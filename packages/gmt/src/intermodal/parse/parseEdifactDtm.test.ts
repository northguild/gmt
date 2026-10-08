import { Temporal } from "@js-temporal/polyfill";
import { vi } from "vitest";
import { EDIFACT_DTM_FORMATS } from "../../internal";
import {
  mockTemporalInstantFromThrow,
  mockTemporalNowInstantThrow,
  mockTemporalPlainDateFromThrow,
  mockTemporalPlainDateTimeFromThrow,
  mockTemporalPlainTimeFromThrow,
} from "../../test/mocks";
import { hostileProxy, revokedProxy } from "../../test/noThrow";
import type { EdiDateTime, EdifactDtmFormat } from "../../types/edi";
import { parseEdifactDtm } from "./parseEdifactDtm";
import { parseEpcisEvent } from "./parseEpcisEvent";
import { parseX12DateTime } from "./parseX12DateTime";

/**
 * Every expected value below is read off the UNTDID 2379 mask by hand: the fixture is
 * 15 June 2024 at 14:30 (and 45 seconds where the mask has `SS`). An instant is the wall clock
 * minus its offset, worked out on one UTC day (14:30 at +02:00 is 12:30Z), and each instant row
 * is checked again against plain `Temporal.Instant.from` inside the test.
 *
 * The digit-level grammar of each mask (a month 13, a colon, a stray space) is asserted once, in
 * `internal/ediGrammar.test.ts`. This file holds one row per code and the behaviour the public
 * function adds or documents.
 */
const WINDOW_2000 = { yearWindow: 2000 };

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
  ["an array holding a string", () => ["20240615"]],
  ["an object", () => ({})],
  ["a Proxy that throws on any trap", hostileProxy],
  ["a revoked Proxy", revokedProxy],
];

/**
 * One row per supported code, keyed by the code union so that a code with no row fails
 * typecheck. `mask` is UNTDID 2379's own. `value` is the fixture placed under it and
 * `expected` is that value read back off the mask by hand, with a two-digit year in 2000–2099.
 * `neighbour` is the code whose mask is nearest: a code filed under its neighbour's layout, or
 * a mask one field too long or too short, fails here.
 */
const CODE_ROWS: Record<
  EdifactDtmFormat,
  {
    mask: string;
    value: string;
    expected: EdiDateTime;
    neighbour: EdifactDtmFormat;
  }
> = {
  "101": {
    mask: "YYMMDD",
    value: "240615",
    expected: { date: "2024-06-15" },
    neighbour: "102",
  },
  "102": {
    mask: "CCYYMMDD",
    value: "20240615",
    expected: { date: "2024-06-15" },
    neighbour: "101",
  },
  "201": {
    mask: "YYMMDDHHMM",
    value: "2406151430",
    expected: { local: "2024-06-15T14:30:00" },
    neighbour: "202",
  },
  "202": {
    mask: "YYMMDDHHMMSS",
    value: "240615143045",
    expected: { local: "2024-06-15T14:30:45" },
    neighbour: "201",
  },
  "203": {
    mask: "CCYYMMDDHHMM",
    value: "202406151430",
    expected: { local: "2024-06-15T14:30:00" },
    neighbour: "204",
  },
  "204": {
    mask: "CCYYMMDDHHMMSS",
    value: "20240615143045",
    expected: { local: "2024-06-15T14:30:45" },
    neighbour: "203",
  },
  "205": {
    mask: "CCYYMMDDHHMMZHHMM",
    value: "202406151430+0200",
    expected: {
      local: "2024-06-15T14:30:00",
      offset: "+02:00",
      instant: "2024-06-15T12:30:00Z",
    },
    neighbour: "303",
  },
  "206": {
    mask: "YYMMDDHHMMZHHMM",
    value: "2406151430+0200",
    expected: {
      local: "2024-06-15T14:30:00",
      offset: "+02:00",
      instant: "2024-06-15T12:30:00Z",
    },
    neighbour: "207",
  },
  "207": {
    mask: "YYMMDDHHMMSSZHHMM",
    value: "240615143045+0200",
    expected: {
      local: "2024-06-15T14:30:45",
      offset: "+02:00",
      instant: "2024-06-15T12:30:45Z",
    },
    neighbour: "206",
  },
  "208": {
    mask: "CCYYMMDDHHMMSSZHHMM",
    value: "20240615143045+0200",
    expected: {
      local: "2024-06-15T14:30:45",
      offset: "+02:00",
      instant: "2024-06-15T12:30:45Z",
    },
    neighbour: "205",
  },
  "209": {
    mask: "HHMMSSZHHMM",
    value: "143045+0200",
    expected: { time: "14:30:45", offset: "+02:00" },
    neighbour: "404",
  },
  "301": {
    mask: "YYMMDDHHMMZZZ",
    value: "2406151430+02",
    expected: {
      local: "2024-06-15T14:30:00",
      offset: "+02:00",
      instant: "2024-06-15T12:30:00Z",
    },
    neighbour: "302",
  },
  "302": {
    mask: "YYMMDDHHMMSSZZZ",
    value: "240615143045+02",
    expected: {
      local: "2024-06-15T14:30:45",
      offset: "+02:00",
      instant: "2024-06-15T12:30:45Z",
    },
    neighbour: "301",
  },
  "303": {
    mask: "CCYYMMDDHHMMZZZ",
    value: "202406151430+02",
    expected: {
      local: "2024-06-15T14:30:00",
      offset: "+02:00",
      instant: "2024-06-15T12:30:00Z",
    },
    neighbour: "205",
  },
  "304": {
    mask: "CCYYMMDDHHMMSSZZZ",
    value: "20240615143045+02",
    expected: {
      local: "2024-06-15T14:30:45",
      offset: "+02:00",
      instant: "2024-06-15T12:30:45Z",
    },
    neighbour: "303",
  },
  "401": {
    mask: "HHMM",
    value: "1430",
    expected: { time: "14:30:00" },
    neighbour: "402",
  },
  "402": {
    mask: "HHMMSS",
    value: "143045",
    expected: { time: "14:30:45" },
    neighbour: "401",
  },
  "404": {
    mask: "HHMMSSZZZ",
    value: "143045+02",
    expected: { time: "14:30:45", offset: "+02:00" },
    neighbour: "402",
  },
  "406": {
    mask: "ZHHMM",
    value: "+0200",
    expected: { offset: "+02:00" },
    neighbour: "205",
  },
  "713": {
    mask: "YYMMDDHHMM-YYMMDDHHMM",
    value: "24061514302406201600",
    expected: {
      local: "2024-06-15T14:30:00",
      periodEnd: { local: "2024-06-20T16:00:00" },
    },
    neighbour: "719",
  },
  "717": {
    mask: "YYMMDD-YYMMDD",
    value: "240615240620",
    expected: { date: "2024-06-15", periodEnd: { date: "2024-06-20" } },
    neighbour: "718",
  },
  "718": {
    mask: "CCYYMMDD-CCYYMMDD",
    value: "2024061520240620",
    expected: { date: "2024-06-15", periodEnd: { date: "2024-06-20" } },
    neighbour: "717",
  },
  "719": {
    mask: "CCYYMMDDHHMM-CCYYMMDDHHMM",
    value: "202406151430202406201600",
    expected: {
      local: "2024-06-15T14:30:00",
      periodEnd: { local: "2024-06-20T16:00:00" },
    },
    neighbour: "713",
  },
};

describe("parseEdifactDtm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("every supported 2379 code reads its own mask and no other", () => {
    it.each(EDIFACT_DTM_FORMATS.map((code) => ({ code, ...CODE_ROWS[code] })))(
      "$code ($mask) reads $value as $expected, and not one character short or long, nor under $neighbour",
      ({ code, value, expected, neighbour }) => {
        expect(parseEdifactDtm(value, code, WINDOW_2000)).toEqual(expected);
        expect(
          parseEdifactDtm(value.slice(0, -1), code, WINDOW_2000),
        ).toBeNull();
        expect(parseEdifactDtm(`${value}0`, code, WINDOW_2000)).toBeNull();
        expect(parseEdifactDtm(value, neighbour, WINDOW_2000)).toBeNull();
      },
    );

    // Two masks of one length read one run of digits two ways, so the code is what tells them
    // apart: `YYMMDDHHMMSS` against `CCYYMMDDHHMM`, with or without three zone characters.
    // 11:12:13 at +02:00 is 09:12:13Z, and 12:13 at +02:00 is 10:13Z.
    it.each`
      value                | withSeconds | readsWithSeconds                                                                       | withCentury | readsWithCentury
      ${"201012111213"}    | ${"202"}    | ${{ local: "2020-10-12T11:12:13" }}                                                    | ${"203"}    | ${{ local: "2010-12-11T12:13:00" }}
      ${"201012111213+02"} | ${"302"}    | ${{ local: "2020-10-12T11:12:13", offset: "+02:00", instant: "2020-10-12T09:12:13Z" }} | ${"303"}    | ${{ local: "2010-12-11T12:13:00", offset: "+02:00", instant: "2010-12-11T10:13:00Z" }}
    `(
      "reads $value as $readsWithSeconds under $withSeconds and as $readsWithCentury under $withCentury",
      ({
        value,
        withSeconds,
        readsWithSeconds,
        withCentury,
        readsWithCentury,
      }) => {
        expect(parseEdifactDtm(value, withSeconds, WINDOW_2000)).toEqual(
          readsWithSeconds,
        );
        expect(parseEdifactDtm(value, withCentury)).toEqual(readsWithCentury);
      },
    );
  });

  describe("every date-time code returns local, the wall clock as written", () => {
    // GMT rule: a date-time code always returns `local`, the date and time the value itself
    // carries, read off the mask and never moved to UTC. A stated offset adds `offset` and
    // `instant`; unresolved zone text adds `zone`; a code with neither returns `local` alone.
    // The wall clock of every row is the fixture, 15 June 2024 at 14:30 (and 45 seconds where
    // the mask has `SS`).
    it.each`
      code     | value                    | local                    | members
      ${"201"} | ${"2406151430"}          | ${"2024-06-15T14:30:00"} | ${["local"]}
      ${"202"} | ${"240615143045"}        | ${"2024-06-15T14:30:45"} | ${["local"]}
      ${"203"} | ${"202406151430"}        | ${"2024-06-15T14:30:00"} | ${["local"]}
      ${"204"} | ${"20240615143045"}      | ${"2024-06-15T14:30:45"} | ${["local"]}
      ${"205"} | ${"202406151430+0200"}   | ${"2024-06-15T14:30:00"} | ${["instant", "local", "offset"]}
      ${"206"} | ${"2406151430-0500"}     | ${"2024-06-15T14:30:00"} | ${["instant", "local", "offset"]}
      ${"207"} | ${"240615143045+0530"}   | ${"2024-06-15T14:30:45"} | ${["instant", "local", "offset"]}
      ${"208"} | ${"20240615143045-1200"} | ${"2024-06-15T14:30:45"} | ${["instant", "local", "offset"]}
      ${"301"} | ${"2406151430+02"}       | ${"2024-06-15T14:30:00"} | ${["instant", "local", "offset"]}
      ${"302"} | ${"240615143045UTC"}     | ${"2024-06-15T14:30:45"} | ${["instant", "local", "offset"]}
      ${"303"} | ${"202406151430GMT"}     | ${"2024-06-15T14:30:00"} | ${["instant", "local", "offset"]}
      ${"304"} | ${"20240615143045-12"}   | ${"2024-06-15T14:30:45"} | ${["instant", "local", "offset"]}
      ${"301"} | ${"2406151430CET"}       | ${"2024-06-15T14:30:00"} | ${["local", "zone"]}
      ${"302"} | ${"240615143045CET"}     | ${"2024-06-15T14:30:45"} | ${["local", "zone"]}
      ${"303"} | ${"202406151430CET"}     | ${"2024-06-15T14:30:00"} | ${["local", "zone"]}
      ${"304"} | ${"20240615143045CET"}   | ${"2024-06-15T14:30:45"} | ${["local", "zone"]}
    `(
      "$code $value returns local $local beside exactly $members",
      ({ code, value, local, members }) => {
        const result = parseEdifactDtm(value, code, WINDOW_2000);
        expect(result?.local).toBe(local);
        expect(Object.keys(result ?? {}).toSorted()).toEqual(members);
      },
    );

    // The local clock is the value's own, on its own day: the instant can be on the UTC day
    // before or after it, and outside years 0000–9999, and `local` does not move.
    it.each`
      code     | value                  | local                    | instant
      ${"205"} | ${"202406150030+0200"} | ${"2024-06-15T00:30:00"} | ${"2024-06-14T22:30:00Z"}
      ${"205"} | ${"202412312330-1200"} | ${"2024-12-31T23:30:00"} | ${"2025-01-01T11:30:00Z"}
      ${"205"} | ${"999912312330-0200"} | ${"9999-12-31T23:30:00"} | ${"+010000-01-01T01:30:00Z"}
      ${"303"} | ${"000001010030+02"}   | ${"0000-01-01T00:30:00"} | ${"-000001-12-31T22:30:00Z"}
    `(
      "$code $value keeps local $local though the instant is $instant",
      ({ code, value, local, instant }) => {
        expect(parseEdifactDtm(value, code)).toMatchObject({ local, instant });
      },
    );

    // One moment, 14:30 on 15 June 2024 at +02:00, sent three ways. X12 time code `02` is
    // "Equivalent to ISO P02", and an EPCIS event carries the instant with the offset beside it.
    // 14:30 less two hours is 12:30Z. The three parsers state it in the same three members.
    it("states one moment as the same local, offset and instant as parseX12DateTime and parseEpcisEvent", () => {
      const moment = {
        local: "2024-06-15T14:30:00",
        offset: "+02:00",
        instant: "2024-06-15T12:30:00Z",
      };
      expect(
        Temporal.Instant.from(`${moment.local}${moment.offset}`).toString(),
      ).toBe(moment.instant);
      expect(parseEdifactDtm("202406151430+0200", "205")).toEqual(moment);
      expect(parseEdifactDtm("202406151430+02", "303")).toEqual(moment);
      expect(parseX12DateTime("20240615", "1430", "02")).toMatchObject(moment);
      expect(
        parseEpcisEvent({
          eventTime: "2024-06-15T12:30:00Z",
          eventTimeZoneOffset: "+02:00",
        }),
      ).toEqual(moment);
    });

    // A time-only code is unchanged: `time` and `offset`, and never `local` or `instant`.
    it.each`
      code     | value            | expected
      ${"209"} | ${"143045+0200"} | ${{ time: "14:30:45", offset: "+02:00" }}
      ${"404"} | ${"143045+02"}   | ${{ time: "14:30:45", offset: "+02:00" }}
      ${"404"} | ${"143045UTC"}   | ${{ time: "14:30:45", offset: "+00:00" }}
    `(
      "the time-only $code $value is $expected: no local",
      ({ code, value, expected }) => {
        expect(parseEdifactDtm(value, code)).toEqual(expected);
      },
    );
  });

  describe("101 YYMMDD and 102 CCYYMMDD: a calendar date", () => {
    it.each`
      value         | expected                  | reads
      ${"20240229"} | ${{ date: "2024-02-29" }} | ${"leap day 2024"}
      ${"00000101"} | ${{ date: "0000-01-01" }} | ${"the first four-digit year"}
      ${"00000229"} | ${{ date: "0000-02-29" }} | ${"year 0000 is a leap year: divisible by 400"}
      ${"99991231"} | ${{ date: "9999-12-31" }} | ${"the last four-digit year"}
    `("reads $value under 102 as $expected ($reads)", ({ value, expected }) => {
      expect(
        Temporal.PlainDate.from(expected.date, {
          overflow: "reject",
        }).toString(),
      ).toBe(expected.date);
      expect(parseEdifactDtm(value, "102")).toEqual(expected);
    });

    // GMT rule: a date names no instant in any zone, so a date-only code returns `date` and
    // never `local`.
    it.each`
      code     | value
      ${"101"} | ${"240615"}
      ${"102"} | ${"20240615"}
    `(
      "returns date alone for the date-only code $code: no local",
      ({ code, value }) => {
        expect(
          Object.keys(parseEdifactDtm(value, code, WINDOW_2000) ?? {}),
        ).toEqual(["date"]);
      },
    );
  });

  describe("201 YYMMDDHHMM, 202 YYMMDDHHMMSS, 203 CCYYMMDDHHMM, 204 CCYYMMDDHHMMSS: a date and time with no offset", () => {
    it.each`
      value             | expected                            | reads
      ${"202406150000"} | ${{ local: "2024-06-15T00:00:00" }} | ${"midnight"}
      ${"202406152359"} | ${{ local: "2024-06-15T23:59:00" }} | ${"the last minute"}
      ${"000001010000"} | ${{ local: "0000-01-01T00:00:00" }} | ${"the first minute of the first four-digit year"}
      ${"999912312359"} | ${{ local: "9999-12-31T23:59:00" }} | ${"the last minute of the last four-digit year"}
    `("reads $value under 203 as $expected ($reads)", ({ value, expected }) => {
      expect(parseEdifactDtm(value, "203")).toEqual(expected);
    });

    // The most common EDI timestamp bug: a 203 value read as UTC. It is local to a place the
    // value does not name, so there is no instant and no offset to return.
    it.each`
      code     | value
      ${"201"} | ${"2406151430"}
      ${"202"} | ${"240615143045"}
      ${"203"} | ${"202406151430"}
      ${"204"} | ${"20240615143045"}
    `(
      "returns local alone for $code $value: no instant, offset or zone",
      ({ code, value }) => {
        const result = parseEdifactDtm(value, code, WINDOW_2000);
        expect(Object.keys(result ?? {})).toEqual(["local"]);
      },
    );
  });

  describe("205 CCYYMMDDHHMMZHHMM: a date and time with a signed HHMM offset from UTC", () => {
    // UNTDID 2379, code 205: "ZHHMM = time zone given as offset from Coordinated Universal Time
    // (UTC)". The instant is the wall clock less the offset. The offsets in use run from −12:00
    // to +14:00 and include half and three-quarter hours; `ZHHMM` holds all of them.
    it.each`
      value                  | local                    | offset      | instant                      | reads
      ${"202406151430-0500"} | ${"2024-06-15T14:30:00"} | ${"-05:00"} | ${"2024-06-15T19:30:00Z"}    | ${"a whole hour west"}
      ${"202406151430+0000"} | ${"2024-06-15T14:30:00"} | ${"+00:00"} | ${"2024-06-15T14:30:00Z"}    | ${"UTC"}
      ${"202406151430+0530"} | ${"2024-06-15T14:30:00"} | ${"+05:30"} | ${"2024-06-15T09:00:00Z"}    | ${"a half hour east"}
      ${"202406151430-0330"} | ${"2024-06-15T14:30:00"} | ${"-03:30"} | ${"2024-06-15T18:00:00Z"}    | ${"a half hour west"}
      ${"202406151430+0545"} | ${"2024-06-15T14:30:00"} | ${"+05:45"} | ${"2024-06-15T08:45:00Z"}    | ${"a 45-minute offset"}
      ${"202406151430+1245"} | ${"2024-06-15T14:30:00"} | ${"+12:45"} | ${"2024-06-15T01:45:00Z"}    | ${"a 45-minute offset past twelve hours"}
      ${"202406151430-1200"} | ${"2024-06-15T14:30:00"} | ${"-12:00"} | ${"2024-06-16T02:30:00Z"}    | ${"the most negative offset in use: the UTC date is the next day"}
      ${"202406151430+1300"} | ${"2024-06-15T14:30:00"} | ${"+13:00"} | ${"2024-06-15T01:30:00Z"}    | ${"thirteen hours east"}
      ${"202406151430+1400"} | ${"2024-06-15T14:30:00"} | ${"+14:00"} | ${"2024-06-15T00:30:00Z"}    | ${"the largest offset in use"}
      ${"202406151430+2359"} | ${"2024-06-15T14:30:00"} | ${"+23:59"} | ${"2024-06-14T14:31:00Z"}    | ${"the largest offset the mask holds"}
      ${"202406150030+0200"} | ${"2024-06-15T00:30:00"} | ${"+02:00"} | ${"2024-06-14T22:30:00Z"}    | ${"the UTC date is the day before"}
      ${"202401010030+1400"} | ${"2024-01-01T00:30:00"} | ${"+14:00"} | ${"2023-12-31T10:30:00Z"}    | ${"the UTC date is in the year before"}
      ${"202412312330-1200"} | ${"2024-12-31T23:30:00"} | ${"-12:00"} | ${"2025-01-01T11:30:00Z"}    | ${"the UTC date is in the year after"}
      ${"202402282330-0500"} | ${"2024-02-28T23:30:00"} | ${"-05:00"} | ${"2024-02-29T04:30:00Z"}    | ${"the UTC date is the leap day"}
      ${"202403010030+0200"} | ${"2024-03-01T00:30:00"} | ${"+02:00"} | ${"2024-02-29T22:30:00Z"}    | ${"the UTC date is back on the leap day"}
      ${"202411030130-0400"} | ${"2024-11-03T01:30:00"} | ${"-04:00"} | ${"2024-11-03T05:30:00Z"}    | ${"the first 01:30 of New York's fall-back day"}
      ${"202411030130-0500"} | ${"2024-11-03T01:30:00"} | ${"-05:00"} | ${"2024-11-03T06:30:00Z"}    | ${"the second 01:30 of that day, an hour later: the offset tells them apart"}
      ${"000001010030+0200"} | ${"0000-01-01T00:30:00"} | ${"+02:00"} | ${"-000001-12-31T22:30:00Z"} | ${"the first four-digit year: the instant's UTC year is before it"}
      ${"999912312330-0200"} | ${"9999-12-31T23:30:00"} | ${"-02:00"} | ${"+010000-01-01T01:30:00Z"} | ${"the last four-digit year: the instant's UTC year is after it"}
    `(
      "reads $value as local $local, offset $offset and instant $instant ($reads)",
      ({ value, local, offset, instant }) => {
        expect(Temporal.Instant.from(`${local}${offset}`).toString()).toBe(
          instant,
        );
        expect(parseEdifactDtm(value, "205")).toEqual({
          local,
          offset,
          instant,
        });
      },
    );

    // RFC 3339's "-00:00" spelling of UTC has no place in the pair: the offset is +00:00.
    it("reads the offset -0000 as +00:00", () => {
      expect(parseEdifactDtm("202406151430-0000", "205")).toEqual({
        local: "2024-06-15T14:30:00",
        offset: "+00:00",
        instant: "2024-06-15T14:30:00Z",
      });
    });
  });

  describe("206 YYMMDDHHMMZHHMM, 207 YYMMDDHHMMSSZHHMM, 208 CCYYMMDDHHMMSSZHHMM, 209 HHMMSSZHHMM: a signed HHMM offset (D.12A on)", () => {
    // UNTDID 2379, codes 206–209 (first in directory D.12A): "Z = leading plus/minus sign, HHMM
    // = difference to UTC in Hours and Minutes." The instant is the wall clock less the offset,
    // worked out on the fixture's own day and checked against plain Temporal in the test.
    it.each`
      code     | value                    | options        | local                    | offset      | instant                      | reads
      ${"206"} | ${"2406151430+0200"}     | ${WINDOW_2000} | ${"2024-06-15T14:30:00"} | ${"+02:00"} | ${"2024-06-15T12:30:00Z"}    | ${"two-digit year, a whole hour east"}
      ${"206"} | ${"2406151430-0500"}     | ${WINDOW_2000} | ${"2024-06-15T14:30:00"} | ${"-05:00"} | ${"2024-06-15T19:30:00Z"}    | ${"a whole hour west"}
      ${"206"} | ${"2406151430+0545"}     | ${WINDOW_2000} | ${"2024-06-15T14:30:00"} | ${"+05:45"} | ${"2024-06-15T08:45:00Z"}    | ${"a 45-minute offset"}
      ${"206"} | ${"2406151430-0000"}     | ${WINDOW_2000} | ${"2024-06-15T14:30:00"} | ${"+00:00"} | ${"2024-06-15T14:30:00Z"}    | ${"-0000 is the offset +00:00"}
      ${"207"} | ${"240615143045+0200"}   | ${WINDOW_2000} | ${"2024-06-15T14:30:45"} | ${"+02:00"} | ${"2024-06-15T12:30:45Z"}    | ${"two-digit year, seconds"}
      ${"207"} | ${"241231233045-1200"}   | ${WINDOW_2000} | ${"2024-12-31T23:30:45"} | ${"-12:00"} | ${"2025-01-01T11:30:45Z"}    | ${"the UTC date is in the year after"}
      ${"208"} | ${"20240615143045+0200"} | ${undefined}   | ${"2024-06-15T14:30:45"} | ${"+02:00"} | ${"2024-06-15T12:30:45Z"}    | ${"four-digit year, seconds"}
      ${"208"} | ${"20240615143045+0530"} | ${undefined}   | ${"2024-06-15T14:30:45"} | ${"+05:30"} | ${"2024-06-15T09:00:45Z"}    | ${"a half hour east"}
      ${"208"} | ${"20240615003045+0200"} | ${undefined}   | ${"2024-06-15T00:30:45"} | ${"+02:00"} | ${"2024-06-14T22:30:45Z"}    | ${"the UTC date is the day before"}
      ${"208"} | ${"20240615143045+2359"} | ${undefined}   | ${"2024-06-15T14:30:45"} | ${"+23:59"} | ${"2024-06-14T14:31:45Z"}    | ${"the largest offset the mask holds"}
      ${"208"} | ${"00000101003045+0200"} | ${undefined}   | ${"0000-01-01T00:30:45"} | ${"+02:00"} | ${"-000001-12-31T22:30:45Z"} | ${"the first four-digit year: the instant's UTC year is before it"}
      ${"208"} | ${"99991231233045-0200"} | ${undefined}   | ${"9999-12-31T23:30:45"} | ${"-02:00"} | ${"+010000-01-01T01:30:45Z"} | ${"the last four-digit year: the instant's UTC year is after it"}
    `(
      "reads $code $value as local $local, offset $offset and instant $instant ($reads)",
      ({ code, value, options, local, offset, instant }) => {
        expect(Temporal.Instant.from(`${local}${offset}`).toString()).toBe(
          instant,
        );
        expect(parseEdifactDtm(value, code, options)).toEqual({
          local,
          offset,
          instant,
        });
      },
    );

    // A time names no instant, so 209 returns the offset beside the time, as 404 does, and the
    // time is not moved to UTC.
    it.each`
      value            | expected                                  | reads
      ${"143045+0200"} | ${{ time: "14:30:45", offset: "+02:00" }} | ${"a whole hour east"}
      ${"143045-0530"} | ${{ time: "14:30:45", offset: "-05:30" }} | ${"a half hour west"}
      ${"143045-0000"} | ${{ time: "14:30:45", offset: "+00:00" }} | ${"-0000 is the offset +00:00"}
      ${"000000+1400"} | ${{ time: "00:00:00", offset: "+14:00" }} | ${"midnight stays midnight"}
      ${"235959+2359"} | ${{ time: "23:59:59", offset: "+23:59" }} | ${"the last second, the largest offset the mask holds"}
    `("reads 209 $value as $expected ($reads)", ({ value, expected }) => {
      expect(parseEdifactDtm(value, "209")).toEqual(expected);
    });

    it.each`
      code     | value                     | reads
      ${"206"} | ${"2406151430+02"}        | ${"301's hours-only zone"}
      ${"206"} | ${"2406151430+2400"}      | ${"offset hour 24"}
      ${"206"} | ${"2406151430+0260"}      | ${"offset minute 60"}
      ${"206"} | ${"24061514300200"}       | ${"no sign"}
      ${"207"} | ${"240615143060+0200"}    | ${"second 60"}
      ${"207"} | ${"240230143045+0200"}    | ${"30 February"}
      ${"208"} | ${"202406151430+0200"}    | ${"205's value: no seconds"}
      ${"208"} | ${"20230229143045+0200"}  | ${"29 February 2023"}
      ${"208"} | ${"20240615143045+02:00"} | ${"a colon in the offset"}
      ${"208"} | ${"20240615143045?+0200"} | ${"the release character"}
      ${"209"} | ${"1430+0200"}            | ${"no seconds"}
      ${"209"} | ${"143045+02"}            | ${"404's hours-only zone"}
      ${"209"} | ${"143045UTC"}            | ${"404's literal UTC"}
      ${"209"} | ${"243045+0200"}          | ${"hour 24"}
      ${"209"} | ${"143045+2400"}          | ${"offset hour 24"}
      ${"209"} | ${"143045"}               | ${"402's value: no offset"}
    `("returns null for $code $value ($reads)", ({ code, value }) => {
      expect(parseEdifactDtm(value, code, WINDOW_2000)).toBeNull();
    });

    it("returns null for 205 20240615143045+0200: seconds belong to 208", () => {
      expect(parseEdifactDtm("20240615143045+0200", "205")).toBeNull();
    });
  });

  describe("301 YYMMDDHHMMZZZ, 302 YYMMDDHHMMSSZZZ, 303 CCYYMMDDHHMMZZZ, 304 CCYYMMDDHHMMSSZZZ: three zone characters", () => {
    // UN/ECE Recommendation 7 ¶12: the difference is appended "in hours and minutes, or hours
    // only, with a leading "+" or "-" sign" (`+01`, `-05`); hours only is exactly three
    // characters. The SMDG
    // IFTSAI and BAPLIE guides also write the literal `UTC` in a 303 value, and ¶12 names the
    // same scale twice: "Co-ordinated Universal Time (formerly known as Greenwich Mean Time)",
    // so `GMT` is +00:00 too.
    it.each`
      code     | value                  | options        | local                    | offset      | instant                      | reads
      ${"303"} | ${"202406151430-05"}   | ${undefined}   | ${"2024-06-15T14:30:00"} | ${"-05:00"} | ${"2024-06-15T19:30:00Z"}    | ${"-05, the Recommendation 7 example"}
      ${"303"} | ${"202406151430+00"}   | ${undefined}   | ${"2024-06-15T14:30:00"} | ${"+00:00"} | ${"2024-06-15T14:30:00Z"}    | ${"+00"}
      ${"303"} | ${"202406151430-00"}   | ${undefined}   | ${"2024-06-15T14:30:00"} | ${"+00:00"} | ${"2024-06-15T14:30:00Z"}    | ${"-00 is the offset +00:00"}
      ${"303"} | ${"202406151430UTC"}   | ${undefined}   | ${"2024-06-15T14:30:00"} | ${"+00:00"} | ${"2024-06-15T14:30:00Z"}    | ${"the literal UTC"}
      ${"303"} | ${"202406151430GMT"}   | ${undefined}   | ${"2024-06-15T14:30:00"} | ${"+00:00"} | ${"2024-06-15T14:30:00Z"}    | ${"the literal GMT: UTC's former name (Rec 7 ¶12)"}
      ${"301"} | ${"2406151430GMT"}     | ${WINDOW_2000} | ${"2024-06-15T14:30:00"} | ${"+00:00"} | ${"2024-06-15T14:30:00Z"}    | ${"two-digit year, the literal GMT"}
      ${"303"} | ${"202406151430-12"}   | ${undefined}   | ${"2024-06-15T14:30:00"} | ${"-12:00"} | ${"2024-06-16T02:30:00Z"}    | ${"-12, the most negative offset in use"}
      ${"303"} | ${"202406151430+14"}   | ${undefined}   | ${"2024-06-15T14:30:00"} | ${"+14:00"} | ${"2024-06-15T00:30:00Z"}    | ${"+14, the largest offset in use"}
      ${"303"} | ${"202406151430+23"}   | ${undefined}   | ${"2024-06-15T14:30:00"} | ${"+23:00"} | ${"2024-06-14T15:30:00Z"}    | ${"+23, the largest hour"}
      ${"303"} | ${"202406151430-23"}   | ${undefined}   | ${"2024-06-15T14:30:00"} | ${"-23:00"} | ${"2024-06-16T13:30:00Z"}    | ${"-23, the largest hour west"}
      ${"303"} | ${"202401010030+14"}   | ${undefined}   | ${"2024-01-01T00:30:00"} | ${"+14:00"} | ${"2023-12-31T10:30:00Z"}    | ${"the UTC date is in the year before"}
      ${"303"} | ${"999912312330-02"}   | ${undefined}   | ${"9999-12-31T23:30:00"} | ${"-02:00"} | ${"+010000-01-01T01:30:00Z"} | ${"the last four-digit year: the instant's UTC year is after it"}
      ${"302"} | ${"240615143045UTC"}   | ${WINDOW_2000} | ${"2024-06-15T14:30:45"} | ${"+00:00"} | ${"2024-06-15T14:30:45Z"}    | ${"two-digit year, seconds, the literal UTC"}
      ${"304"} | ${"20241231233045-12"} | ${undefined}   | ${"2024-12-31T23:30:45"} | ${"-12:00"} | ${"2025-01-01T11:30:45Z"}    | ${"seconds: the UTC date is in the year after"}
    `(
      "reads $code $value as local $local, offset $offset and instant $instant ($reads)",
      ({ code, value, options, local, offset, instant }) => {
        expect(Temporal.Instant.from(`${local}${offset}`).toString()).toBe(
          instant,
        );
        expect(parseEdifactDtm(value, code, options)).toEqual({
          local,
          offset,
          instant,
        });
      },
    );

    // GMT rule: no UN/EDIFACT text defines an abbreviation, so any other three upper-case
    // letters come back unread beside the wall clock, with no offset and no instant.
    it.each`
      code     | value                  | options        | expected                                         | reads
      ${"303"} | ${"202406151430CET"}   | ${undefined}   | ${{ local: "2024-06-15T14:30:00", zone: "CET" }} | ${"an abbreviation"}
      ${"303"} | ${"202406151430PDT"}   | ${undefined}   | ${{ local: "2024-06-15T14:30:00", zone: "PDT" }} | ${"an abbreviation"}
      ${"303"} | ${"202406151430UTZ"}   | ${undefined}   | ${{ local: "2024-06-15T14:30:00", zone: "UTZ" }} | ${"one letter off UTC is not UTC"}
      ${"303"} | ${"202406151430ZZZ"}   | ${undefined}   | ${{ local: "2024-06-15T14:30:00", zone: "ZZZ" }} | ${"Z is not read as a UTC designator"}
      ${"301"} | ${"2406151430CET"}     | ${WINDOW_2000} | ${{ local: "2024-06-15T14:30:00", zone: "CET" }} | ${"two-digit year"}
      ${"302"} | ${"240615143045CET"}   | ${WINDOW_2000} | ${{ local: "2024-06-15T14:30:45", zone: "CET" }} | ${"two-digit year, seconds"}
      ${"304"} | ${"20240615143045CET"} | ${undefined}   | ${{ local: "2024-06-15T14:30:45", zone: "CET" }} | ${"seconds"}
    `(
      "reads $code $value as $expected ($reads)",
      ({ code, value, options, expected }) => {
        expect(parseEdifactDtm(value, code, options)).toEqual(expected);
      },
    );

    // GMT rule: the directory names no character set for the field. Zone text is exactly three
    // upper-case letters, A–Z, because every published example is upper case. The syntax rules
    // do not forbid lower case: level A (§5.1) is upper case only, and level B (§5.2) includes
    // lower case. A field led by a sign or holding a digit that is not a valid signed hour is a
    // broken offset, not a zone name, and anything else is malformed. A lone `Z` is refused too:
    // Recommendation 7 ¶12 writes UTC as the single letter `Z`, but the mask has three
    // characters, a variable-length element carries no trailing spaces (syntax rules §7:
    // "leading zeroes and trailing spaces shall be suppressed"), and no guide writes it.
    // `zone` is null where the value is refused.
    it.each`
      text      | zone     | reads
      ${"XYZ"}  | ${"XYZ"} | ${"three letters that spell no zone anyone uses"}
      ${"AAA"}  | ${"AAA"} | ${"the first letter three times"}
      ${"+24"}  | ${null}  | ${"a signed 24: one past the last hour"}
      ${"-99"}  | ${null}  | ${"a signed 99"}
      ${"+-1"}  | ${null}  | ${"two signs and a digit"}
      ${"---"}  | ${null}  | ${"signs alone"}
      ${"000"}  | ${null}  | ${"digits alone, no sign"}
      ${"123"}  | ${null}  | ${"digits alone, no sign"}
      ${"+2A"}  | ${null}  | ${"a sign, one digit and a letter"}
      ${"A0+"}  | ${null}  | ${"a letter, a digit and a plus"}
      ${"-Z9"}  | ${null}  | ${"a minus, a letter and a digit"}
      ${"Z00"}  | ${null}  | ${"a letter and two digits"}
      ${"UT1"}  | ${null}  | ${"two letters and a digit"}
      ${"utc"}  | ${null}  | ${"lower case"}
      ${"Utc"}  | ${null}  | ${"mixed case"}
      ${" 02"}  | ${null}  | ${"a space for the sign"}
      ${"A B"}  | ${null}  | ${"a space between letters"}
      ${"A.B"}  | ${null}  | ${"a full stop"}
      ${"ÅBC"}  | ${null}  | ${"a letter outside A–Z"}
      ${"AB"}   | ${null}  | ${"two characters"}
      ${"Z"}    | ${null}  | ${"a lone Z: Recommendation 7's UTC designator is one character and the mask has three"}
      ${"Z  "}  | ${null}  | ${"a lone Z padded to three characters with spaces"}
      ${"  Z"}  | ${null}  | ${"a lone Z after two spaces"}
      ${"ABCD"} | ${null}  | ${"four characters"}
    `(
      "reads the zone characters '$text' as zone $zone under 303 and 404 ($reads)",
      ({ text, zone }) => {
        expect(parseEdifactDtm(`202406151430${text}`, "303")).toEqual(
          zone === null ? null : { local: "2024-06-15T14:30:00", zone },
        );
        expect(parseEdifactDtm(`143045${text}`, "404")).toEqual(
          zone === null ? null : { time: "14:30:45", zone },
        );
      },
    );

    // `+` is the EDIFACT data element separator, so an interchange transmits `+02` as `?+02`
    // (ISO 9735-1 release character). The value is taken after the interchange is unescaped.
    it("returns null for 303 202406151430?+02: the release character is the caller's to remove", () => {
      expect(parseEdifactDtm("202406151430?+02", "303")).toBeNull();
      expect(parseEdifactDtm("202406151430+02", "303")).not.toBeNull();
    });
  });

  describe("401 HHMM, 402 HHMMSS, 404 HHMMSSZZZ: a time", () => {
    it.each`
      code     | value          | expected                                  | reads
      ${"401"} | ${"0000"}      | ${{ time: "00:00:00" }}                   | ${"midnight"}
      ${"401"} | ${"2359"}      | ${{ time: "23:59:00" }}                   | ${"the last minute"}
      ${"402"} | ${"235959"}    | ${{ time: "23:59:59" }}                   | ${"the last second"}
      ${"404"} | ${"143045-05"} | ${{ time: "14:30:45", offset: "-05:00" }} | ${"a negative offset"}
      ${"404"} | ${"143045-00"} | ${{ time: "14:30:45", offset: "+00:00" }} | ${"-00 is the offset +00:00"}
      ${"404"} | ${"143045UTC"} | ${{ time: "14:30:45", offset: "+00:00" }} | ${"the literal UTC"}
      ${"404"} | ${"143045GMT"} | ${{ time: "14:30:45", offset: "+00:00" }} | ${"the literal GMT: UTC's former name"}
      ${"404"} | ${"143045+14"} | ${{ time: "14:30:45", offset: "+14:00" }} | ${"the largest offset in use"}
      ${"404"} | ${"143045CET"} | ${{ time: "14:30:45", zone: "CET" }}      | ${"an undefined abbreviation: zone text"}
    `(
      "reads $value under $code as $expected ($reads)",
      ({ code, value, expected }) => {
        expect(parseEdifactDtm(value, code)).toEqual(expected);
      },
    );

    // A time names no instant, so the offset stands beside it and the time is not moved to UTC.
    it("never returns an instant for 404: a time has no date", () => {
      expect(parseEdifactDtm("143045+02", "404")).not.toHaveProperty("instant");
    });
  });

  describe("406 ZHHMM: an offset from UTC alone", () => {
    // UNTDID 2379, code 406: "Offset from Coordinated Universal Time (UTC) where Z is plus (+)
    // or minus (-)".
    it.each`
      value      | expected
      ${"-0530"} | ${{ offset: "-05:30" }}
      ${"+0545"} | ${{ offset: "+05:45" }}
      ${"+0000"} | ${{ offset: "+00:00" }}
      ${"-0000"} | ${{ offset: "+00:00" }}
      ${"-1200"} | ${{ offset: "-12:00" }}
      ${"+1400"} | ${{ offset: "+14:00" }}
      ${"+2359"} | ${{ offset: "+23:59" }}
    `("reads $value as $expected", ({ value, expected }) => {
      expect(parseEdifactDtm(value, "406")).toEqual(expected);
    });
  });

  describe("713 YYMMDDHHMM-YYMMDDHHMM, 717 YYMMDD-YYMMDD, 718 CCYYMMDD-CCYYMMDD, 719 CCYYMMDDHHMM-CCYYMMDDHHMM: a period", () => {
    // UNTDID 2379, from D.01C: "Data is to be transmitted as consecutive characters without
    // hyphen." (713, 717, 718); "Format of period to be given in actual message without hyphen."
    // (719, in every directory that has it). The hyphen in the mask is notation and none of the
    // twelve directories read, from D.93A to D.22B, transmits one, so only the run-together
    // form reads.
    it.each`
      code     | start             | end               | options        | expected
      ${"713"} | ${"2406151430"}   | ${"2406201600"}   | ${WINDOW_2000} | ${{ local: "2024-06-15T14:30:00", periodEnd: { local: "2024-06-20T16:00:00" } }}
      ${"717"} | ${"240615"}       | ${"240620"}       | ${WINDOW_2000} | ${{ date: "2024-06-15", periodEnd: { date: "2024-06-20" } }}
      ${"718"} | ${"20240615"}     | ${"20240620"}     | ${undefined}   | ${{ date: "2024-06-15", periodEnd: { date: "2024-06-20" } }}
      ${"719"} | ${"202406151430"} | ${"202406201600"} | ${undefined}   | ${{ local: "2024-06-15T14:30:00", periodEnd: { local: "2024-06-20T16:00:00" } }}
    `(
      "reads $code $start then $end run together as $expected, and refuses one hyphen or two between them",
      ({ code, start, end, options, expected }) => {
        expect(parseEdifactDtm(`${start}${end}`, code, options)).toEqual(
          expected,
        );
        expect(parseEdifactDtm(`${start}-${end}`, code, options)).toBeNull();
        expect(parseEdifactDtm(`${start}--${end}`, code, options)).toBeNull();
      },
    );

    it.each`
      code     | value                         | expected                                                                         | reads
      ${"718"} | ${"2024061520240615"}         | ${{ date: "2024-06-15", periodEnd: { date: "2024-06-15" } }}                     | ${"one day: the end equals the start"}
      ${"719"} | ${"202406151430202406151430"} | ${{ local: "2024-06-15T14:30:00", periodEnd: { local: "2024-06-15T14:30:00" } }} | ${"zero length"}
      ${"718"} | ${"2023123120240101"}         | ${{ date: "2023-12-31", periodEnd: { date: "2024-01-01" } }}                     | ${"across a year end"}
      ${"718"} | ${"0000010199991231"}         | ${{ date: "0000-01-01", periodEnd: { date: "9999-12-31" } }}                     | ${"the whole four-digit range"}
    `(
      "reads $code $value as $expected ($reads)",
      ({ code, value, expected }) => {
        expect(parseEdifactDtm(value, code)).toEqual(expected);
      },
    );

    // GMT rule: a period whose end precedes its start names no span of time.
    it.each`
      code     | value                         | reads
      ${"718"} | ${"2024062020240615"}         | ${"the end date is five days before the start"}
      ${"717"} | ${"240620240615"}             | ${"two-digit years"}
      ${"719"} | ${"202406151431202406151430"} | ${"the end is one minute before the start"}
      ${"713"} | ${"24061514312406151430"}     | ${"two-digit years, one minute"}
    `(
      "returns null for the reversed $code $value ($reads)",
      ({ code, value }) => {
        expect(parseEdifactDtm(value, code, WINDOW_2000)).toBeNull();
      },
    );

    it.each`
      value                     | reads
      ${"20240615 20240620"}    | ${"a space"}
      ${"20240615-20240620"}    | ${"a hyphen: X12 RD8's wire form, never a 2379 one"}
      ${"-2024061520240620"}    | ${"a leading hyphen"}
      ${"2024061520240620-"}    | ${"a trailing hyphen"}
      ${"2024-06-152024-06-20"} | ${"ISO 8601 dates"}
    `("returns null for 718 $value ($reads)", ({ value }) => {
      expect(parseEdifactDtm(value, "718")).toBeNull();
    });
  });

  describe("a two-digit year needs options.yearWindow (GMT rule: no standard names the century)", () => {
    // 80 falls in a different century under each window: 2080 in 2000–2099, 1980 in 1950–2049,
    // and 1980 in the rolling 1976–2075 of 2026.
    it.each`
      code     | value                     | in2000                                                                                 | in1950AndRolling
      ${"101"} | ${"800615"}               | ${{ date: "2080-06-15" }}                                                              | ${{ date: "1980-06-15" }}
      ${"201"} | ${"8006151430"}           | ${{ local: "2080-06-15T14:30:00" }}                                                    | ${{ local: "1980-06-15T14:30:00" }}
      ${"202"} | ${"800615143045"}         | ${{ local: "2080-06-15T14:30:45" }}                                                    | ${{ local: "1980-06-15T14:30:45" }}
      ${"206"} | ${"8006151430+0200"}      | ${{ local: "2080-06-15T14:30:00", offset: "+02:00", instant: "2080-06-15T12:30:00Z" }} | ${{ local: "1980-06-15T14:30:00", offset: "+02:00", instant: "1980-06-15T12:30:00Z" }}
      ${"207"} | ${"800615143045+0200"}    | ${{ local: "2080-06-15T14:30:45", offset: "+02:00", instant: "2080-06-15T12:30:45Z" }} | ${{ local: "1980-06-15T14:30:45", offset: "+02:00", instant: "1980-06-15T12:30:45Z" }}
      ${"301"} | ${"8006151430+02"}        | ${{ local: "2080-06-15T14:30:00", offset: "+02:00", instant: "2080-06-15T12:30:00Z" }} | ${{ local: "1980-06-15T14:30:00", offset: "+02:00", instant: "1980-06-15T12:30:00Z" }}
      ${"302"} | ${"800615143045+02"}      | ${{ local: "2080-06-15T14:30:45", offset: "+02:00", instant: "2080-06-15T12:30:45Z" }} | ${{ local: "1980-06-15T14:30:45", offset: "+02:00", instant: "1980-06-15T12:30:45Z" }}
      ${"713"} | ${"80061514308006201600"} | ${{ local: "2080-06-15T14:30:00", periodEnd: { local: "2080-06-20T16:00:00" } }}       | ${{ local: "1980-06-15T14:30:00", periodEnd: { local: "1980-06-20T16:00:00" } }}
      ${"717"} | ${"800615800620"}         | ${{ date: "2080-06-15", periodEnd: { date: "2080-06-20" } }}                           | ${{ date: "1980-06-15", periodEnd: { date: "1980-06-20" } }}
    `(
      "$code $value is null with no window, $in2000 with 2000, and $in1950AndRolling with 1950 and with rolling in 2026",
      ({ code, value, in2000, in1950AndRolling }) => {
        setNow(NOW_2026);
        expect(parseEdifactDtm(value, code)).toBeNull();
        expect(parseEdifactDtm(value, code, {})).toBeNull();
        expect(parseEdifactDtm(value, code, { yearWindow: 2000 })).toEqual(
          in2000,
        );
        expect(parseEdifactDtm(value, code, { yearWindow: 1950 })).toEqual(
          in1950AndRolling,
        );
        expect(parseEdifactDtm(value, code, { yearWindow: "rolling" })).toEqual(
          in1950AndRolling,
        );
      },
    );

    // The window is [start, start + 99]: the one year in it that ends in the two digits.
    it.each`
      value       | yearWindow | expected        | reads
      ${"240615"} | ${2000}    | ${"2024-06-15"} | ${"24 in 2000–2099"}
      ${"000101"} | ${2000}    | ${"2000-01-01"} | ${"00 is the first year of 2000–2099"}
      ${"991231"} | ${2000}    | ${"2099-12-31"} | ${"99 is the last year of 2000–2099"}
      ${"690101"} | ${2000}    | ${"2069-01-01"} | ${"69 in 2000–2099"}
      ${"690101"} | ${1969}    | ${"1969-01-01"} | ${"69 is the first year of 1969–2068"}
      ${"680101"} | ${1969}    | ${"2068-01-01"} | ${"68 is the last year of 1969–2068"}
      ${"500101"} | ${1950}    | ${"1950-01-01"} | ${"50 is the first year of 1950–2049"}
      ${"991231"} | ${1950}    | ${"1999-12-31"} | ${"99 is in the first century of 1950–2049"}
      ${"000101"} | ${1950}    | ${"2000-01-01"} | ${"00 is in the second century of 1950–2049"}
      ${"490101"} | ${1950}    | ${"2049-01-01"} | ${"49 is the last year of 1950–2049"}
      ${"000101"} | ${0}       | ${"0000-01-01"} | ${"the lowest window, 0000–0099"}
      ${"991231"} | ${0}       | ${"0099-12-31"} | ${"the last year of the lowest window"}
      ${"000101"} | ${-0}      | ${"0000-01-01"} | ${"negative zero is zero"}
      ${"000101"} | ${9900}    | ${"9900-01-01"} | ${"the first year of the highest window"}
      ${"991231"} | ${9900}    | ${"9999-12-31"} | ${"the highest window, 9900–9999"}
      ${"000229"} | ${2000}    | ${"2000-02-29"} | ${"2000 is a leap year"}
    `(
      "101 $value with yearWindow $yearWindow is $expected ($reads)",
      ({ value, yearWindow, expected }) => {
        expect(parseEdifactDtm(value, "101", { yearWindow })).toEqual({
          date: expected,
        });
      },
    );

    it("101 000229 with yearWindow 2001 is null: 00 is 2100, which has no 29 February", () => {
      expect(Temporal.PlainDate.from("2100-03-01").inLeapYear).toBe(false);
      expect(parseEdifactDtm("000229", "101", { yearWindow: 2001 })).toBeNull();
    });

    // GMT rule: rolling runs from 50 years before the current UTC year to 49 after it, so it
    // moves at the UTC new year. 99 is 1999 while the window still starts before 2000. The last
    // two rows are instants whose local date and UTC date fall in different years: the UTC year
    // decides. (CI runs this suite under ten system time zones, from Pacific/Niue to
    // Pacific/Apia, so a rule that read the system zone's year fails there on the rows at the
    // UTC new year.)
    it.each`
      now                            | window         | rolling         | reads
      ${"2026-10-07T12:00:00Z"}      | ${"1976–2075"} | ${"1999-06-15"} | ${"mid-year"}
      ${"2049-12-31T23:59:59Z"}      | ${"1999–2098"} | ${"1999-06-15"} | ${"the last second of UTC 2049"}
      ${"2050-01-01T00:00:00Z"}      | ${"2000–2099"} | ${"2099-06-15"} | ${"the first second of UTC 2050"}
      ${"2050-01-01T00:00:00+02:00"} | ${"1999–2098"} | ${"1999-06-15"} | ${"22:00Z on 31 December 2049: a clock two hours east already reads 2050"}
      ${"2049-12-31T23:59:59-05:00"} | ${"2000–2099"} | ${"2099-06-15"} | ${"04:59:59Z on 1 January 2050: a clock five hours west still reads 2049"}
    `(
      '101 990615 at $now is $rolling with "rolling" ($window; $reads) and 1999-06-15 with 1950',
      ({ now, rolling }) => {
        setNow(now);
        expect(
          parseEdifactDtm("990615", "101", { yearWindow: "rolling" }),
        ).toEqual({ date: rolling });
        expect(parseEdifactDtm("990615", "101", { yearWindow: 1950 })).toEqual({
          date: "1999-06-15",
        });
      },
    );

    it("returns null for a rolling window when the clock cannot be read", () => {
      mockTemporalNowInstantThrow();
      expect(
        parseEdifactDtm("240615", "101", { yearWindow: "rolling" }),
      ).toBeNull();
    });

    it("a fixed window does not read the clock", () => {
      mockTemporalNowInstantThrow();
      expect(parseEdifactDtm("240615", "101", WINDOW_2000)).toEqual({
        date: "2024-06-15",
      });
    });

    it.each`
      yearWindow                  | reads
      ${undefined}                | ${"undefined"}
      ${null}                     | ${"null"}
      ${-1}                       | ${"a negative year"}
      ${9901}                     | ${"a start whose window would pass year 9999"}
      ${1950.5}                   | ${"a non-integer"}
      ${Number.NaN}               | ${"NaN"}
      ${Number.POSITIVE_INFINITY} | ${"Infinity"}
      ${Number.NEGATIVE_INFINITY} | ${"-Infinity"}
      ${"2000"}                   | ${"a numeric string"}
      ${"Rolling"}                | ${"a different case"}
      ${"rolling "}               | ${"rolling with a trailing space"}
      ${"sliding"}                | ${"an unknown name"}
      ${true}                     | ${"a boolean"}
      ${[2000]}                   | ${"an array holding a year"}
      ${2000n}                    | ${"a bigint"}
    `(
      "101 240615 is null for yearWindow $yearWindow ($reads)",
      ({ yearWindow }) => {
        expect(
          parseEdifactDtm("240615", "101", { yearWindow } as never),
        ).toBeNull();
      },
    );

    // A code with a four-digit year never reads the option, valid or not.
    it.each`
      code     | value                         | expected
      ${"102"} | ${"20240615"}                 | ${{ date: "2024-06-15" }}
      ${"203"} | ${"202406151430"}             | ${{ local: "2024-06-15T14:30:00" }}
      ${"204"} | ${"20240615143045"}           | ${{ local: "2024-06-15T14:30:45" }}
      ${"205"} | ${"202406151430+0200"}        | ${{ local: "2024-06-15T14:30:00", offset: "+02:00", instant: "2024-06-15T12:30:00Z" }}
      ${"303"} | ${"202406151430+02"}          | ${{ local: "2024-06-15T14:30:00", offset: "+02:00", instant: "2024-06-15T12:30:00Z" }}
      ${"304"} | ${"20240615143045+02"}        | ${{ local: "2024-06-15T14:30:45", offset: "+02:00", instant: "2024-06-15T12:30:45Z" }}
      ${"401"} | ${"1430"}                     | ${{ time: "14:30:00" }}
      ${"402"} | ${"143045"}                   | ${{ time: "14:30:45" }}
      ${"404"} | ${"143045+02"}                | ${{ time: "14:30:45", offset: "+02:00" }}
      ${"406"} | ${"+0200"}                    | ${{ offset: "+02:00" }}
      ${"718"} | ${"2024061520240620"}         | ${{ date: "2024-06-15", periodEnd: { date: "2024-06-20" } }}
      ${"719"} | ${"202406151430202406201600"} | ${{ local: "2024-06-15T14:30:00", periodEnd: { local: "2024-06-20T16:00:00" } }}
    `(
      "$code $value is $expected with no options, {}, 1950, rolling and an invalid window",
      ({ code, value, expected }) => {
        mockTemporalNowInstantThrow();
        for (const options of [
          undefined,
          {},
          { yearWindow: 1950 },
          { yearWindow: "rolling" },
          { yearWindow: 9901 },
        ]) {
          expect(parseEdifactDtm(value, code, options as never)).toEqual(
            expected,
          );
        }
      },
    );
  });

  describe("a field out of range, or a day the year does not have, is rejected (TC39 overflow: reject)", () => {
    it.each`
      code     | value                 | reads
      ${"102"} | ${"20230229"}         | ${"29 February 2023, not a leap year"}
      ${"102"} | ${"20240631"}         | ${"31 June"}
      ${"102"} | ${"20241301"}         | ${"month 13"}
      ${"203"} | ${"202406152430"}     | ${"hour 24"}
      ${"204"} | ${"20240615143060"}   | ${"second 60: GMT rejects a leap second"}
      ${"303"} | ${"202302291430+02"}  | ${"29 February 2023 with a zone"}
      ${"718"} | ${"2023022920240620"} | ${"29 February 2023 in the start of a period"}
    `("returns null for $code $value ($reads)", ({ code, value }) => {
      expect(parseEdifactDtm(value, code)).toBeNull();
    });
  });

  describe("a value that is not the digits of its mask", () => {
    it.each`
      value              | reads
      ${"2024061514３0"} | ${"a full-width digit"}
      ${"not a date"}    | ${"garbage"}
    `("returns null for 203 $value ($reads)", ({ value }) => {
      expect(parseEdifactDtm(value, "203")).toBeNull();
    });
  });

  describe("an unsupported format code", () => {
    // The 2379 codes GMT does not read: partial values, weekday periods (720), quantities (801
    // and up), the day-first and month-first dates (2–5), 10 (CCYYMMDDTHHMM), the week date 103,
    // the ordinal date 105, the time period 210, 307 (milliseconds), the zoned period 308, the
    // time spans (501–503) and 711, which the directory dropped in D.03B. Each value below fits
    // a supported code, so null is for the code.
    it.each`
      code      | reads
      ${"2"}    | ${"a day-first or month-first date"}
      ${"3"}    | ${"a day-first or month-first date"}
      ${"4"}    | ${"a day-first or month-first date"}
      ${"5"}    | ${"a day-first or month-first date"}
      ${"10"}   | ${"CCYYMMDDTHHMM"}
      ${"103"}  | ${"the week date"}
      ${"105"}  | ${"the ordinal date"}
      ${"210"}  | ${"a time period with offsets"}
      ${"307"}  | ${"a date and time with milliseconds"}
      ${"308"}  | ${"a zoned period"}
      ${"711"}  | ${"CCYYMMDD-CCYYMMDD, removed in D.03B"}
      ${"501"}  | ${"a time span"}
      ${"502"}  | ${"a time span"}
      ${"503"}  | ${"a time span"}
      ${"602"}  | ${"a partial value"}
      ${"609"}  | ${"a partial value"}
      ${"610"}  | ${"a partial value"}
      ${"616"}  | ${"a partial value"}
      ${"720"}  | ${"a weekday period"}
      ${"801"}  | ${"a quantity"}
      ${"804"}  | ${"a quantity"}
      ${"999"}  | ${"not a 2379 code"}
      ${""}     | ${"an empty code"}
      ${"0102"} | ${"102 with a leading zero"}
      ${" 102"} | ${"102 with a leading space"}
      ${"102 "} | ${"102 with a trailing space"}
      ${"D8"}   | ${"an X12 1250 code"}
    `("returns null for code $code ($reads)", ({ code }) => {
      expect(parseEdifactDtm("20240615", code, WINDOW_2000)).toBeNull();
      expect(parseEdifactDtm("2024", code, WINDOW_2000)).toBeNull();
      expect(parseEdifactDtm("202406151430", code, WINDOW_2000)).toBeNull();
    });

    it.each`
      code
      ${"constructor"}
      ${"toString"}
      ${"__proto__"}
      ${"hasOwnProperty"}
    `("returns null for the inherited property name $code", ({ code }) => {
      expect(parseEdifactDtm("20240615", code)).toBeNull();
    });
  });

  describe("the options argument (Temporal GetOptionsObject)", () => {
    // A non-Object options argument is a TypeError in Temporal, so it is the sentinel here even
    // for a code that never reads the option.
    it.each`
      make          | kind
      ${() => null} | ${"null"}
      ${() => "x"}  | ${"a string"}
      ${() => 1}    | ${"a number"}
      ${() => true} | ${"a boolean"}
    `(
      "returns null for options that are $kind, for the four-digit 102 and the two-digit 101",
      ({ make }) => {
        expect(parseEdifactDtm("20240615", "102", make() as never)).toBeNull();
        expect(parseEdifactDtm("240615", "101", make() as never)).toBeNull();
      },
    );

    it("reads a function carrying yearWindow as an options bag", () => {
      const options = Object.assign(() => 0, { yearWindow: 2000 });
      expect(parseEdifactDtm("240615", "101", options as never)).toEqual({
        date: "2024-06-15",
      });
    });

    // A hostile bag is an Object, so it passes the guard; reading `yearWindow` from it throws.
    // Only a two-digit-year code reads it.
    it.each`
      make                                                                | kind
      ${() => hostileProxy()}                                             | ${"a Proxy that throws on any trap"}
      ${() => revokedProxy()}                                             | ${"a revoked Proxy"}
      ${() => Object.defineProperty({}, "yearWindow", { get: throwing })} | ${"an object whose yearWindow getter throws"}
    `(
      "returns null for the two-digit 101 with options that are $kind, and never reads them for 102",
      ({ make }) => {
        expect(parseEdifactDtm("240615", "101", make() as never)).toBeNull();
        expect(parseEdifactDtm("20240615", "102", make() as never)).toEqual({
          date: "2024-06-15",
        });
      },
    );
  });

  describe("non-string arguments", () => {
    // A non-string collapses to one path per argument.
    it.each`
      argument             | call
      ${"value"}           | ${(bad: unknown) => parseEdifactDtm(bad as never, "102")}
      ${"formatQualifier"} | ${(bad: unknown) => parseEdifactDtm("20240615", bad as never)}
    `("returns null for a $argument that is not a string", ({ call }) => {
      for (const [kind, make] of NON_STRINGS) {
        expect(call(make()), kind).toBeNull();
      }
    });
  });

  describe("the catch path", () => {
    it("returns null when Temporal.PlainDate.from throws", () => {
      mockTemporalPlainDateFromThrow();
      expect(parseEdifactDtm("20240615", "102")).toBeNull();
    });

    it("returns null when Temporal.PlainDateTime.from throws", () => {
      mockTemporalPlainDateTimeFromThrow();
      expect(parseEdifactDtm("202406151430", "203")).toBeNull();
    });

    it("returns null when Temporal.PlainTime.from throws", () => {
      mockTemporalPlainTimeFromThrow();
      expect(parseEdifactDtm("1430", "401")).toBeNull();
    });

    it("returns null when Temporal.Instant.from throws under an offset code", () => {
      mockTemporalInstantFromThrow();
      expect(parseEdifactDtm("202406151430+0200", "205")).toBeNull();
      expect(parseEdifactDtm("202406151430+02", "303")).toBeNull();
      expect(parseEdifactDtm("143045+02", "404")).toBeNull();
      expect(parseEdifactDtm("+0200", "406")).toBeNull();
    });
  });
});

/** A getter that throws, for an options bag that cannot be read. */
function throwing(): never {
  throw new Error("hostile getter");
}
