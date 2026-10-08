import { Temporal } from "@js-temporal/polyfill";
import { vi } from "vitest";
import { EDIFACT_DTM_FORMATS } from "../../internal";
import {
  mockTemporalNowInstantThrow,
  mockTemporalPlainDateFromThrow,
} from "../../test/mocks";
import { hostileProxy, revokedProxy } from "../../test/noThrow";
import type { EdifactDtmFormat } from "../../types/edi";
import { parseEdifactDtm } from "../parse/parseEdifactDtm";
import { isValidEdifactDtm } from "./isValidEdifactDtm";

const WINDOW_2000 = { yearWindow: 2000 };

/**
 * Values that are not strings, each named for the failure message. Built per use: a Proxy that
 * throws on every trap reaches the parser's catch path, where the others stop at a `typeof` guard.
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
 * typecheck: 15 June 2024 at 14:30 (:45 where the mask has `SS`) under the code's UNTDID 2379
 * mask, and the code whose mask is nearest.
 */
const CODE_ROWS: Record<
  EdifactDtmFormat,
  { mask: string; value: string; neighbour: EdifactDtmFormat }
> = {
  "101": { mask: "YYMMDD", value: "240615", neighbour: "102" },
  "102": { mask: "CCYYMMDD", value: "20240615", neighbour: "101" },
  "201": { mask: "YYMMDDHHMM", value: "2406151430", neighbour: "202" },
  "202": { mask: "YYMMDDHHMMSS", value: "240615143045", neighbour: "201" },
  "203": { mask: "CCYYMMDDHHMM", value: "202406151430", neighbour: "204" },
  "204": { mask: "CCYYMMDDHHMMSS", value: "20240615143045", neighbour: "203" },
  "205": {
    mask: "CCYYMMDDHHMMZHHMM",
    value: "202406151430+0200",
    neighbour: "303",
  },
  "206": {
    mask: "YYMMDDHHMMZHHMM",
    value: "2406151430+0200",
    neighbour: "207",
  },
  "207": {
    mask: "YYMMDDHHMMSSZHHMM",
    value: "240615143045+0200",
    neighbour: "206",
  },
  "208": {
    mask: "CCYYMMDDHHMMSSZHHMM",
    value: "20240615143045+0200",
    neighbour: "205",
  },
  "209": { mask: "HHMMSSZHHMM", value: "143045+0200", neighbour: "404" },
  "301": { mask: "YYMMDDHHMMZZZ", value: "2406151430+02", neighbour: "302" },
  "302": {
    mask: "YYMMDDHHMMSSZZZ",
    value: "240615143045+02",
    neighbour: "301",
  },
  "303": {
    mask: "CCYYMMDDHHMMZZZ",
    value: "202406151430+02",
    neighbour: "205",
  },
  "304": {
    mask: "CCYYMMDDHHMMSSZZZ",
    value: "20240615143045+02",
    neighbour: "303",
  },
  "401": { mask: "HHMM", value: "1430", neighbour: "402" },
  "402": { mask: "HHMMSS", value: "143045", neighbour: "401" },
  "404": { mask: "HHMMSSZZZ", value: "143045+02", neighbour: "402" },
  "406": { mask: "ZHHMM", value: "+0200", neighbour: "205" },
  "713": {
    mask: "YYMMDDHHMM-YYMMDDHHMM",
    value: "24061514302406201600",
    neighbour: "719",
  },
  "717": { mask: "YYMMDD-YYMMDD", value: "240615240620", neighbour: "718" },
  "718": {
    mask: "CCYYMMDD-CCYYMMDD",
    value: "2024061520240620",
    neighbour: "717",
  },
  "719": {
    mask: "CCYYMMDDHHMM-CCYYMMDDHHMM",
    value: "202406151430202406201600",
    neighbour: "713",
  },
};

describe("isValidEdifactDtm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // A value is valid only against its own code: one character short or long, or under the code
  // with the nearest mask, it is not. Each answer is also the parser's.
  it.each(EDIFACT_DTM_FORMATS.map((code) => ({ code, ...CODE_ROWS[code] })))(
    "$code ($mask): $value is valid, and not one character short or long, nor under $neighbour, as parseEdifactDtm reads it",
    ({ code, value, neighbour }) => {
      const candidates: [string, EdifactDtmFormat, boolean][] = [
        [value, code, true],
        [value.slice(0, -1), code, false],
        [`${value}0`, code, false],
        [value, neighbour, false],
      ];
      for (const [candidate, under, expected] of candidates) {
        expect(
          isValidEdifactDtm(candidate, under, WINDOW_2000),
          `${candidate} under ${under}`,
        ).toBe(expected);
        expect(
          parseEdifactDtm(candidate, under, WINDOW_2000) !== null,
          `parseEdifactDtm ${candidate} under ${under}`,
        ).toBe(expected);
      }
    },
  );

  // `expected` is decided from the UNTDID 2379 mask and the story's rules, row by row; the
  // second assertion holds the validator to the parser, so the two cannot drift apart.
  describe("agrees with parseEdifactDtm, and with the rule, on every row", () => {
    it.each`
      value                         | code     | options                                     | expected | reads
      ${"240615"}                   | ${"101"} | ${WINDOW_2000}                              | ${true}  | ${"YYMMDD in 2000–2099"}
      ${"240615"}                   | ${"101"} | ${undefined}                                | ${false} | ${"a two-digit year with no window"}
      ${"240615"}                   | ${"101"} | ${{}}                                       | ${false} | ${"a two-digit year with an empty bag"}
      ${"240615"}                   | ${"101"} | ${{ yearWindow: 9901 }}                     | ${false} | ${"a window start past 9900"}
      ${"240615"}                   | ${"101"} | ${{ yearWindow: -1 }}                       | ${false} | ${"a window start below 0"}
      ${"240615"}                   | ${"101"} | ${{ yearWindow: 1.5 }}                      | ${false} | ${"a window start that is not an integer"}
      ${"240615"}                   | ${"101"} | ${{ yearWindow: Number.NaN }}               | ${false} | ${"a NaN window"}
      ${"240615"}                   | ${"101"} | ${{ yearWindow: Number.POSITIVE_INFINITY }} | ${false} | ${"an infinite window"}
      ${"240615"}                   | ${"101"} | ${{ yearWindow: "2000" }}                   | ${false} | ${"a window that is a numeric string"}
      ${"240615"}                   | ${"101"} | ${{ yearWindow: "Rolling" }}                | ${false} | ${"rolling in another case"}
      ${"240615"}                   | ${"101"} | ${{ yearWindow: null }}                     | ${false} | ${"a null window"}
      ${"240615"}                   | ${"101"} | ${{ yearWindow: 0 }}                        | ${true}  | ${"the lowest window: year 0024"}
      ${"240615"}                   | ${"101"} | ${{ yearWindow: 9900 }}                     | ${true}  | ${"the highest window: year 9924"}
      ${"690101"}                   | ${"101"} | ${WINDOW_2000}                              | ${true}  | ${"69 is 2069 in 2000–2099"}
      ${"690101"}                   | ${"101"} | ${{ yearWindow: 1969 }}                     | ${true}  | ${"69 is 1969 in 1969–2068"}
      ${"230229"}                   | ${"101"} | ${WINDOW_2000}                              | ${false} | ${"29 February 2023"}
      ${"000229"}                   | ${"101"} | ${WINDOW_2000}                              | ${true}  | ${"29 February 2000, a leap year"}
      ${"000229"}                   | ${"101"} | ${{ yearWindow: 2001 }}                     | ${false} | ${"29 February 2100, not a leap year"}
      ${"20240615"}                 | ${"102"} | ${undefined}                                | ${true}  | ${"CCYYMMDD"}
      ${"20240615"}                 | ${"102"} | ${{ yearWindow: 9901 }}                     | ${true}  | ${"a four-digit year never reads the window"}
      ${"20230229"}                 | ${"102"} | ${undefined}                                | ${false} | ${"29 February 2023"}
      ${"20240631"}                 | ${"102"} | ${undefined}                                | ${false} | ${"31 June"}
      ${"2024-06-15"}               | ${"102"} | ${undefined}                                | ${false} | ${"an ISO 8601 date"}
      ${"2406151430"}               | ${"201"} | ${WINDOW_2000}                              | ${true}  | ${"YYMMDDHHMM"}
      ${"2406151430"}               | ${"201"} | ${undefined}                                | ${false} | ${"no window"}
      ${"240615143045"}             | ${"202"} | ${WINDOW_2000}                              | ${true}  | ${"YYMMDDHHMMSS"}
      ${"240615143045"}             | ${"202"} | ${undefined}                                | ${false} | ${"no window"}
      ${"202406151430"}             | ${"203"} | ${undefined}                                | ${true}  | ${"CCYYMMDDHHMM"}
      ${"202406152430"}             | ${"203"} | ${undefined}                                | ${false} | ${"hour 24"}
      ${"202406151460"}             | ${"203"} | ${undefined}                                | ${false} | ${"minute 60"}
      ${"20240615143045"}           | ${"203"} | ${undefined}                                | ${false} | ${"a 204 value under 203"}
      ${"20240615143045"}           | ${"204"} | ${undefined}                                | ${true}  | ${"CCYYMMDDHHMMSS"}
      ${"20240615143060"}           | ${"204"} | ${undefined}                                | ${false} | ${"second 60"}
      ${"202406151430+0200"}        | ${"205"} | ${undefined}                                | ${true}  | ${"CCYYMMDDHHMMZHHMM"}
      ${"202406151430+02"}          | ${"205"} | ${undefined}                                | ${false} | ${"hours only under 205"}
      ${"202406151430-1200"}        | ${"205"} | ${undefined}                                | ${true}  | ${"the most negative offset in use"}
      ${"202406151430+1400"}        | ${"205"} | ${undefined}                                | ${true}  | ${"the largest offset in use"}
      ${"202406151430+0545"}        | ${"205"} | ${undefined}                                | ${true}  | ${"a 45-minute offset"}
      ${"202406151430+2400"}        | ${"205"} | ${undefined}                                | ${false} | ${"offset hour 24"}
      ${"2406151430+0200"}          | ${"206"} | ${WINDOW_2000}                              | ${true}  | ${"YYMMDDHHMMZHHMM"}
      ${"2406151430+0200"}          | ${"206"} | ${undefined}                                | ${false} | ${"no window"}
      ${"240615143045+0200"}        | ${"207"} | ${WINDOW_2000}                              | ${true}  | ${"YYMMDDHHMMSSZHHMM"}
      ${"240615143045+0200"}        | ${"207"} | ${undefined}                                | ${false} | ${"no window"}
      ${"20240615143045+0200"}      | ${"208"} | ${undefined}                                | ${true}  | ${"CCYYMMDDHHMMSSZHHMM"}
      ${"20230229143045+0200"}      | ${"208"} | ${undefined}                                | ${false} | ${"29 February 2023"}
      ${"143045+0200"}              | ${"209"} | ${undefined}                                | ${true}  | ${"HHMMSSZHHMM"}
      ${"143045+02"}                | ${"209"} | ${undefined}                                | ${false} | ${"hours only under 209"}
      ${"999912312330-0200"}        | ${"205"} | ${undefined}                                | ${true}  | ${"the last four-digit year, though the instant's UTC year is 10000"}
      ${"2406151430+02"}            | ${"301"} | ${WINDOW_2000}                              | ${true}  | ${"YYMMDDHHMMZZZ"}
      ${"2406151430+02"}            | ${"301"} | ${undefined}                                | ${false} | ${"no window"}
      ${"240615143045CET"}          | ${"302"} | ${WINDOW_2000}                              | ${true}  | ${"zone text is a valid ZZZ"}
      ${"240615143045CET"}          | ${"302"} | ${undefined}                                | ${false} | ${"no window"}
      ${"202406151430+02"}          | ${"303"} | ${undefined}                                | ${true}  | ${"a signed hour"}
      ${"202406151430UTC"}          | ${"303"} | ${undefined}                                | ${true}  | ${"the literal UTC"}
      ${"202406151430CET"}          | ${"303"} | ${undefined}                                | ${true}  | ${"zone text"}
      ${"202406151430GMT"}          | ${"303"} | ${undefined}                                | ${true}  | ${"the literal GMT"}
      ${"202406151430+24"}          | ${"303"} | ${undefined}                                | ${false} | ${"+24 is a broken offset, not a zone name"}
      ${"202406151430000"}          | ${"303"} | ${undefined}                                | ${false} | ${"three digits are not a zone"}
      ${"202406151430?+02"}         | ${"303"} | ${undefined}                                | ${false} | ${"the release character"}
      ${"202406151430utc"}          | ${"303"} | ${undefined}                                | ${false} | ${"lower-case zone characters"}
      ${"202406151430Z"}            | ${"303"} | ${undefined}                                | ${false} | ${"a lone Z: the mask has three zone characters"}
      ${"20240615143045+02"}        | ${"304"} | ${undefined}                                | ${true}  | ${"CCYYMMDDHHMMSSZZZ"}
      ${"1430"}                     | ${"401"} | ${undefined}                                | ${true}  | ${"HHMM"}
      ${"2400"}                     | ${"401"} | ${undefined}                                | ${false} | ${"hour 24"}
      ${"143045"}                   | ${"402"} | ${undefined}                                | ${true}  | ${"HHMMSS"}
      ${"143045+02"}                | ${"404"} | ${undefined}                                | ${true}  | ${"HHMMSSZZZ"}
      ${"143045CET"}                | ${"404"} | ${undefined}                                | ${true}  | ${"zone text beside a time"}
      ${"143045"}                   | ${"404"} | ${undefined}                                | ${false} | ${"no zone characters"}
      ${"+0200"}                    | ${"406"} | ${undefined}                                | ${true}  | ${"ZHHMM"}
      ${"+02"}                      | ${"406"} | ${undefined}                                | ${false} | ${"hours only under 406"}
      ${"24061514302406201600"}     | ${"713"} | ${WINDOW_2000}                              | ${true}  | ${"a period, two-digit years"}
      ${"24061514302406201600"}     | ${"713"} | ${undefined}                                | ${false} | ${"no window"}
      ${"240615240620"}             | ${"717"} | ${WINDOW_2000}                              | ${true}  | ${"a period, two-digit years"}
      ${"240615240620"}             | ${"717"} | ${undefined}                                | ${false} | ${"no window"}
      ${"2024061520240620"}         | ${"718"} | ${undefined}                                | ${true}  | ${"the wire form"}
      ${"20240615-20240620"}        | ${"718"} | ${undefined}                                | ${false} | ${"a hyphen: never transmitted in a 2379 period"}
      ${"2024061520240615"}         | ${"718"} | ${undefined}                                | ${true}  | ${"the end equals the start"}
      ${"2024062020240615"}         | ${"718"} | ${undefined}                                | ${false} | ${"the end precedes the start"}
      ${"20240615--20240620"}       | ${"718"} | ${undefined}                                | ${false} | ${"two hyphens"}
      ${"202406151430202406201600"} | ${"719"} | ${undefined}                                | ${true}  | ${"a date-time period"}
      ${"202406151431202406151430"} | ${"719"} | ${undefined}                                | ${false} | ${"the end is a minute before the start"}
      ${"2024"}                     | ${"602"} | ${undefined}                                | ${false} | ${"an unsupported code"}
      ${"20240615"}                 | ${"720"} | ${undefined}                                | ${false} | ${"an unsupported code"}
      ${"20240615"}                 | ${"801"} | ${undefined}                                | ${false} | ${"an unsupported code"}
      ${"20240615"}                 | ${"999"} | ${undefined}                                | ${false} | ${"not a 2379 code"}
      ${"20240615"}                 | ${""}    | ${undefined}                                | ${false} | ${"an empty code"}
      ${""}                         | ${"102"} | ${undefined}                                | ${false} | ${"an empty value"}
      ${"not a date"}               | ${"203"} | ${undefined}                                | ${false} | ${"garbage"}
    `(
      "returns $expected for $value under $code with options $options ($reads)",
      ({ value, code, options, expected }) => {
        expect(isValidEdifactDtm(value, code, options)).toBe(expected);
        expect(isValidEdifactDtm(value, code, options)).toBe(
          parseEdifactDtm(value, code, options) !== null,
        );
      },
    );
  });

  // The rolling window is 1976–2075 in 2026 and 2027–2126 in 2077, so whether a 29 February
  // exists depends on the clock: 76 is the leap year 1976 in the first, 77 is 2077 in the second.
  it.each`
    now                       | value       | expected | reads
    ${"2026-10-07T12:00:00Z"} | ${"760229"} | ${true}  | ${"76 is 1976, a leap year"}
    ${"2077-01-01T00:00:00Z"} | ${"770229"} | ${false} | ${"77 is 2077 in 2027–2126, not a leap year"}
    ${"2026-10-07T12:00:00Z"} | ${"240615"} | ${true}  | ${"24 is 2024"}
    ${"2026-10-07T12:00:00Z"} | ${"990615"} | ${true}  | ${"99 is 1999 in 1976–2075"}
    ${"2049-12-31T23:59:59Z"} | ${"990615"} | ${true}  | ${"99 is 1999 in 1999–2098"}
    ${"2050-01-01T00:00:00Z"} | ${"990615"} | ${true}  | ${"99 is 2099 in 2000–2099"}
  `(
    'returns $expected for 101 $value with "rolling" at $now ($reads)',
    ({ now, value, expected }) => {
      vi.spyOn(Temporal.Now, "instant").mockReturnValue(
        Temporal.Instant.from(now),
      );
      const options = { yearWindow: "rolling" } as const;
      expect(isValidEdifactDtm(value, "101", options)).toBe(expected);
      expect(isValidEdifactDtm(value, "101", options)).toBe(
        parseEdifactDtm(value, "101", options) !== null,
      );
    },
  );

  // Every code whose mask has YY and no CC needs the caller's window. 24 is 2024 in 2000–2099
  // and in the rolling 1976–2075 of 2026-10-07.
  it.each`
    code     | value
    ${"101"} | ${"240615"}
    ${"201"} | ${"2406151430"}
    ${"202"} | ${"240615143045"}
    ${"301"} | ${"2406151430+02"}
    ${"302"} | ${"240615143045+02"}
    ${"713"} | ${"24061514302406201600"}
    ${"717"} | ${"240615240620"}
  `(
    "$code $value is valid with a fixed window and with rolling, and not with no window or an unreadable rolling clock, as parseEdifactDtm reads it",
    ({ code, value }) => {
      const check = (options: unknown, expected: boolean): void => {
        expect(isValidEdifactDtm(value, code, options as never)).toBe(expected);
        expect(parseEdifactDtm(value, code, options as never) !== null).toBe(
          expected,
        );
      };
      vi.spyOn(Temporal.Now, "instant").mockReturnValue(
        Temporal.Instant.from("2026-10-07T12:00:00Z"),
      );
      check(WINDOW_2000, true);
      check({ yearWindow: "rolling" }, true);
      check(undefined, false);
      check({}, false);
      mockTemporalNowInstantThrow();
      check({ yearWindow: "rolling" }, false);
      check(WINDOW_2000, true);
    },
  );

  // GMT rule: rolling runs from 50 years before the current UTC year to 49 after it. 00 is
  // 2000, a leap year, while the window is 2000–2099 (UTC 2050); from the UTC new year 2051 the
  // window is 2001–2100 and 00 is 2100, which has no 29 February. The last two rows are
  // instants whose local date and UTC date fall in different years: the UTC year decides.
  it.each`
    now                            | expected | reads
    ${"2050-12-31T23:59:59Z"}      | ${true}  | ${"the last second of UTC 2050: 00 is 2000"}
    ${"2051-01-01T00:00:00Z"}      | ${false} | ${"the first second of UTC 2051: 00 is 2100"}
    ${"2051-01-01T00:00:00+02:00"} | ${true}  | ${"22:00Z on 31 December 2050, though a clock two hours east reads 2051"}
    ${"2050-12-31T23:59:59-05:00"} | ${false} | ${"04:59:59Z on 1 January 2051, though a clock five hours west reads 2050"}
  `(
    'returns $expected for 101 000229 with "rolling" at $now ($reads)',
    ({ now, expected }) => {
      expect(Temporal.PlainDate.from("2000-01-01").inLeapYear).toBe(true);
      expect(Temporal.PlainDate.from("2100-01-01").inLeapYear).toBe(false);
      vi.spyOn(Temporal.Now, "instant").mockReturnValue(
        Temporal.Instant.from(now),
      );
      const options = { yearWindow: "rolling" } as const;
      expect(isValidEdifactDtm("000229", "101", options)).toBe(expected);
      expect(parseEdifactDtm("000229", "101", options) !== null).toBe(expected);
    },
  );

  it("returns false for a rolling window when the clock cannot be read", () => {
    mockTemporalNowInstantThrow();
    expect(isValidEdifactDtm("240615", "101", { yearWindow: "rolling" })).toBe(
      false,
    );
  });

  // Temporal GetOptionsObject: a non-Object options argument is the sentinel, as in the parser,
  // even for a code that never reads the option.
  it.each`
    make          | kind
    ${() => null} | ${"null"}
    ${() => "x"}  | ${"a string"}
    ${() => 1}    | ${"a number"}
  `(
    "returns false for options that are $kind, for the four-digit 102 and the two-digit 101",
    ({ make }) => {
      expect(isValidEdifactDtm("20240615", "102", make() as never)).toBe(false);
      expect(isValidEdifactDtm("240615", "101", make() as never)).toBe(false);
    },
  );

  // A hostile bag is an Object; only a two-digit-year code reads it.
  it.each`
    make                    | kind
    ${() => hostileProxy()} | ${"a Proxy that throws on any trap"}
    ${() => revokedProxy()} | ${"a revoked Proxy"}
  `(
    "returns false for the two-digit 101 with options that are $kind, and true for 102",
    ({ make }) => {
      expect(isValidEdifactDtm("240615", "101", make() as never)).toBe(false);
      expect(isValidEdifactDtm("20240615", "102", make() as never)).toBe(true);
    },
  );

  // A non-string collapses to one path per argument.
  it.each`
    argument             | call
    ${"value"}           | ${(bad: unknown) => isValidEdifactDtm(bad as never, "102")}
    ${"formatQualifier"} | ${(bad: unknown) => isValidEdifactDtm("20240615", bad as never)}
  `("returns false for a $argument that is not a string", ({ call }) => {
    for (const [kind, make] of NON_STRINGS) {
      expect(call(make()), kind).toBe(false);
    }
  });

  it("returns false when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(isValidEdifactDtm("20240615", "102")).toBe(false);
  });
});
