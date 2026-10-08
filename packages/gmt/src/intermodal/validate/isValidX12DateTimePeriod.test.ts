import { Temporal } from "@js-temporal/polyfill";
import { vi } from "vitest";
import { X12_DATE_TIME_PERIOD_FORMATS } from "../../internal";
import {
  mockTemporalNowInstantThrow,
  mockTemporalPlainDateFromThrow,
} from "../../test/mocks";
import { hostileProxy, revokedProxy } from "../../test/noThrow";
import type { X12DateTimePeriodFormat } from "../../types/edi";
import { parseX12DateTimePeriod } from "../parse/parseX12DateTimePeriod";
import { isValidX12DateTimePeriod } from "./isValidX12DateTimePeriod";

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
 * One row per code GMT reads, keyed by the code union so that a code with no row fails
 * typecheck (`UN` has no mask): 15 June 2024 at 14:30 (:45 where the mask has `SS`), or day 166,
 * under the mask X12 data element 1250 gives, and the code whose mask is nearest.
 */
const CODE_ROWS: Record<
  Exclude<X12DateTimePeriodFormat, "UN">,
  { mask: string; value: string; neighbour: X12DateTimePeriodFormat }
> = {
  D8: { mask: "CCYYMMDD", value: "20240615", neighbour: "D6" },
  D6: { mask: "YYMMDD", value: "240615", neighbour: "D8" },
  DB: { mask: "MMDDCCYY", value: "06152024", neighbour: "D8" },
  TT: { mask: "MMDDYY", value: "061524", neighbour: "D6" },
  DT: { mask: "CCYYMMDDHHMM", value: "202406151430", neighbour: "RTS" },
  TR: { mask: "DDMMYYHHMM", value: "1506241430", neighbour: "DT" },
  RTS: { mask: "CCYYMMDDHHMMSS", value: "20240615143045", neighbour: "DT" },
  TM: { mask: "HHMM", value: "1430", neighbour: "TS" },
  TS: { mask: "HHMMSS", value: "143045", neighbour: "TM" },
  RD8: {
    mask: "CCYYMMDD-CCYYMMDD",
    value: "20240615-20240620",
    neighbour: "RD6",
  },
  RD6: { mask: "YYMMDD-YYMMDD", value: "240615-240620", neighbour: "RD8" },
  RD: {
    mask: "MMDDCCYY-MMDDCCYY",
    value: "06152024-06202024",
    neighbour: "RD8",
  },
  RDT: {
    mask: "CCYYMMDDHHMM-CCYYMMDDHHMM",
    value: "202406151430-202406201600",
    neighbour: "DTS",
  },
  DTS: {
    mask: "CCYYMMDDHHMMSS-CCYYMMDDHHMMSS",
    value: "20240615143045-20240620160000",
    neighbour: "RDT",
  },
  DDT: {
    mask: "CCYYMMDD-CCYYMMDDHHMM",
    value: "20240615-202406201600",
    neighbour: "DTD",
  },
  DTD: {
    mask: "CCYYMMDDHHMM-CCYYMMDD",
    value: "202406151430-20240620",
    neighbour: "DDT",
  },
  RTM: { mask: "HHMM-HHMM", value: "0900-1700", neighbour: "TM" },
  TC: { mask: "DDD", value: "166", neighbour: "EH" },
  TU: { mask: "YYDDD", value: "24166", neighbour: "EH" },
  EH: { mask: "YDDD", value: "4166", neighbour: "TU" },
};

describe("isValidX12DateTimePeriod", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // A value is valid only against its own code: one character short or long, or under the code
  // with the nearest mask, it is not. Each answer is also the parser's.
  it.each(
    X12_DATE_TIME_PERIOD_FORMATS.filter(
      (code): code is Exclude<X12DateTimePeriodFormat, "UN"> => code !== "UN",
    ).map((formatQualifier) => ({
      formatQualifier,
      ...CODE_ROWS[formatQualifier],
    })),
  )(
    "$formatQualifier ($mask): $value is valid, and not one character short or long, nor under $neighbour, as parseX12DateTimePeriod reads it",
    ({ formatQualifier, value, neighbour }) => {
      const candidates: [string, X12DateTimePeriodFormat, boolean][] = [
        [value, formatQualifier, true],
        [value.slice(0, -1), formatQualifier, false],
        [`${value}0`, formatQualifier, false],
        [value, neighbour, false],
      ];
      for (const [candidate, under, expected] of candidates) {
        expect(
          isValidX12DateTimePeriod(candidate, under, WINDOW_2000),
          `${candidate} under ${under}`,
        ).toBe(expected);
        expect(
          parseX12DateTimePeriod(candidate, under, WINDOW_2000) !== null,
          `parseX12DateTimePeriod ${candidate} under ${under}`,
        ).toBe(expected);
      }
    },
  );

  // The expected column is decided from the code's mask (X12 data element 1250), the calendar and
  // the GMT rules in the spec, not from the parser. Each row then also checks that the validator
  // and the parser agree, so the two cannot drift.
  describe("a value that fits its code's mask and names a real date or time is valid", () => {
    it.each`
      formatQualifier | mask                                     | value                              | options
      ${"D8"}         | ${"CCYYMMDD"}                            | ${"20240615"}                      | ${undefined}
      ${"D8"}         | ${"CCYYMMDD"}                            | ${"20240229"}                      | ${undefined}
      ${"D6"}         | ${"YYMMDD"}                              | ${"240615"}                        | ${WINDOW_2000}
      ${"D6"}         | ${"YYMMDD"}                              | ${"990615"}                        | ${{ yearWindow: 1950 }}
      ${"DB"}         | ${"MMDDCCYY"}                            | ${"06152024"}                      | ${undefined}
      ${"TT"}         | ${"MMDDYY"}                              | ${"061524"}                        | ${WINDOW_2000}
      ${"DT"}         | ${"CCYYMMDDHHMM"}                        | ${"202406151430"}                  | ${undefined}
      ${"TR"}         | ${"DDMMYYHHMM"}                          | ${"1506241430"}                    | ${WINDOW_2000}
      ${"RTS"}        | ${"CCYYMMDDHHMMSS"}                      | ${"20240615143000"}                | ${undefined}
      ${"TM"}         | ${"HHMM"}                                | ${"1430"}                          | ${undefined}
      ${"TS"}         | ${"HHMMSS"}                              | ${"143045"}                        | ${undefined}
      ${"RD8"}        | ${"CCYYMMDD-CCYYMMDD"}                   | ${"20240615-20240620"}             | ${undefined}
      ${"RD8"}        | ${"CCYYMMDD-CCYYMMDD"}                   | ${"20240615-20240615"}             | ${undefined}
      ${"RD6"}        | ${"YYMMDD-YYMMDD"}                       | ${"240615-240620"}                 | ${WINDOW_2000}
      ${"RD"}         | ${"MMDDCCYY-MMDDCCYY"}                   | ${"06152024-06202024"}             | ${undefined}
      ${"RDT"}        | ${"CCYYMMDDHHMM-CCYYMMDDHHMM"}           | ${"202406151430-202406201600"}     | ${undefined}
      ${"DTS"}        | ${"CCYYMMDDHHMMSS-CCYYMMDDHHMMSS"}       | ${"20240615143045-20240620160000"} | ${undefined}
      ${"DDT"}        | ${"CCYYMMDD-CCYYMMDDHHMM"}               | ${"20240615-202406201600"}         | ${undefined}
      ${"DTD"}        | ${"CCYYMMDDHHMM-CCYYMMDD"}               | ${"202406151430-20240620"}         | ${undefined}
      ${"RTM"}        | ${"HHMM-HHMM"}                           | ${"0900-1700"}                     | ${undefined}
      ${"RTM"}        | ${"HHMM-HHMM: crosses midnight"}         | ${"2200-0600"}                     | ${undefined}
      ${"RTM"}        | ${"HHMM-HHMM: end before start"}         | ${"1700-0900"}                     | ${undefined}
      ${"RTM"}        | ${"HHMM-HHMM: equal times"}              | ${"0600-0600"}                     | ${undefined}
      ${"TC"}         | ${"DDD"}                                 | ${"166"}                           | ${undefined}
      ${"TC"}         | ${"DDD"}                                 | ${"366"}                           | ${undefined}
      ${"TU"}         | ${"YYDDD"}                               | ${"24366"}                         | ${WINDOW_2000}
      ${"EH"}         | ${"YDDD"}                                | ${"4166"}                          | ${undefined}
      ${"D8"}         | ${"CCYYMMDD"}                            | ${"20240615"}                      | ${{}}
      ${"D8"}         | ${"CCYYMMDD"}                            | ${"20240615"}                      | ${{ yearWindow: 9901 }}
      ${"D8"}         | ${"CCYYMMDD: the first four-digit year"} | ${"00000101"}                      | ${undefined}
      ${"D8"}         | ${"CCYYMMDD: the last four-digit year"}  | ${"99991231"}                      | ${undefined}
      ${"D6"}         | ${"YYMMDD: the lowest window"}           | ${"240615"}                        | ${{ yearWindow: 0 }}
      ${"D6"}         | ${"YYMMDD: the highest window"}          | ${"240615"}                        | ${{ yearWindow: 9900 }}
      ${"D6"}         | ${"YYMMDD: 69 is 2069"}                  | ${"690101"}                        | ${WINDOW_2000}
      ${"D6"}         | ${"YYMMDD: 69 is 1969"}                  | ${"690101"}                        | ${{ yearWindow: 1969 }}
      ${"RD6"}        | ${"YYMMDD-YYMMDD: across 2000"}          | ${"991231-000101"}                 | ${{ yearWindow: 1950 }}
      ${"TU"}         | ${"YYDDD: 2000 is a leap year"}          | ${"00366"}                         | ${WINDOW_2000}
    `(
      "returns true for $formatQualifier ($mask) $value with options $options, and the parser reads it",
      ({ formatQualifier, value, options }) => {
        expect(isValidX12DateTimePeriod(value, formatQualifier, options)).toBe(
          true,
        );
        expect(
          parseX12DateTimePeriod(value, formatQualifier, options),
        ).not.toBeNull();
      },
    );
  });

  describe("a value the parser cannot read is not valid", () => {
    it.each`
      formatQualifier | value                              | options                                     | reads
      ${"D8"}         | ${"20230229"}                      | ${undefined}                                | ${"29 February 2023"}
      ${"D8"}         | ${"20240631"}                      | ${undefined}                                | ${"31 June"}
      ${"D8"}         | ${"20241301"}                      | ${undefined}                                | ${"month 13"}
      ${"D8"}         | ${"2024-06-15"}                    | ${undefined}                                | ${"an ISO 8601 date in an X12 element"}
      ${"D8"}         | ${"240615"}                        | ${undefined}                                | ${"D6's value under D8"}
      ${"D8"}         | ${""}                              | ${undefined}                                | ${"an empty string"}
      ${"D6"}         | ${"240615"}                        | ${undefined}                                | ${"a two-digit year with no window"}
      ${"D6"}         | ${"240615"}                        | ${{}}                                       | ${"a two-digit year with an empty bag"}
      ${"D6"}         | ${"240615"}                        | ${{ yearWindow: 9901 }}                     | ${"a two-digit year with a window past 9900"}
      ${"D6"}         | ${"240615"}                        | ${{ yearWindow: -1 }}                       | ${"a window start below 0"}
      ${"D6"}         | ${"240615"}                        | ${{ yearWindow: 1.5 }}                      | ${"a window start that is not an integer"}
      ${"D6"}         | ${"240615"}                        | ${{ yearWindow: Number.NaN }}               | ${"a NaN window"}
      ${"D6"}         | ${"240615"}                        | ${{ yearWindow: Number.POSITIVE_INFINITY }} | ${"an infinite window"}
      ${"D6"}         | ${"240615"}                        | ${{ yearWindow: "2000" }}                   | ${"a window that is a numeric string"}
      ${"D6"}         | ${"240615"}                        | ${{ yearWindow: "Rolling" }}                | ${"rolling in another case"}
      ${"D6"}         | ${"240615"}                        | ${{ yearWindow: null }}                     | ${"a null window"}
      ${"D6"}         | ${"230229"}                        | ${WINDOW_2000}                              | ${"29 February 2023 through the window"}
      ${"TT"}         | ${"061524"}                        | ${undefined}                                | ${"a two-digit year with no window"}
      ${"TR"}         | ${"1506241430"}                    | ${undefined}                                | ${"a two-digit year with no window"}
      ${"RD6"}        | ${"240615-240620"}                 | ${undefined}                                | ${"a two-digit year with no window"}
      ${"RD6"}        | ${"991231-000101"}                 | ${WINDOW_2000}                              | ${"2099 to 2000: the end precedes the start"}
      ${"TU"}         | ${"24366"}                         | ${undefined}                                | ${"a two-digit year with no window"}
      ${"TU"}         | ${"23366"}                         | ${WINDOW_2000}                              | ${"day 366 of 2023"}
      ${"TU"}         | ${"23366"}                         | ${undefined}                                | ${"day 366 of a two-digit year with no window"}
      ${"TU"}         | ${"00366"}                         | ${{ yearWindow: 2001 }}                     | ${"day 366 of 2100, which has 365 days"}
      ${"DT"}         | ${"202406152400"}                  | ${undefined}                                | ${"hour 24"}
      ${"DT"}         | ${"202406151430Z"}                 | ${undefined}                                | ${"a UTC designator: no 1250 code carries one"}
      ${"RTS"}        | ${"20240615143060"}                | ${undefined}                                | ${"second 60"}
      ${"RTS"}        | ${"20240615143000-20240620160000"} | ${undefined}                                | ${"a range under RTS, which is one date-time"}
      ${"TM"}         | ${"2400"}                          | ${undefined}                                | ${"hour 24"}
      ${"TS"}         | ${"1430"}                          | ${undefined}                                | ${"TM's value under TS"}
      ${"RD8"}        | ${"2024061520240620"}              | ${undefined}                                | ${"no hyphen"}
      ${"RD8"}        | ${"20240620-20240615"}             | ${undefined}                                | ${"the end precedes the start"}
      ${"RD"}         | ${"06202024-06152024"}             | ${undefined}                                | ${"the end precedes the start"}
      ${"RDT"}        | ${"202406151431-202406151430"}     | ${undefined}                                | ${"the end is one minute before the start"}
      ${"DTS"}        | ${"20240615143045"}                | ${undefined}                                | ${"a single date-time under DTS, which is a range"}
      ${"DDT"}        | ${"20240616-202406152359"}         | ${undefined}                                | ${"the end is on the day before the start"}
      ${"DTD"}        | ${"202406160000-20240615"}         | ${undefined}                                | ${"the end is on the day before the start"}
      ${"TC"}         | ${"000"}                           | ${undefined}                                | ${"day 0"}
      ${"TC"}         | ${"367"}                           | ${undefined}                                | ${"past the longest year"}
      ${"EH"}         | ${"4367"}                          | ${undefined}                                | ${"past the longest year"}
      ${"UN"}         | ${"20240615"}                      | ${undefined}                                | ${"UN is a valid format and reads no value"}
      ${"UN"}         | ${""}                              | ${undefined}                                | ${"UN is a valid format and reads no value"}
      ${"CC"}         | ${"20"}                            | ${undefined}                                | ${"a 1250 code GMT does not read"}
      ${"CY"}         | ${"2024"}                          | ${undefined}                                | ${"a 1250 code GMT does not read"}
      ${"CM"}         | ${"202406"}                        | ${undefined}                                | ${"a 1250 code GMT does not read"}
      ${"YM"}         | ${"2406"}                          | ${undefined}                                | ${"a 1250 code GMT does not read"}
      ${"MD"}         | ${"0615"}                          | ${undefined}                                | ${"a 1250 code GMT does not read"}
      ${"CD"}         | ${"JUN2024"}                       | ${undefined}                                | ${"a 1250 code GMT does not read"}
      ${"KA"}         | ${"24JUN15"}                       | ${undefined}                                | ${"a 1250 code GMT does not read"}
      ${"YMM"}        | ${"2024JUN-JUL"}                   | ${undefined}                                | ${"a 1250 code GMT does not read"}
      ${"ZZ"}         | ${"20240615"}                      | ${undefined}                                | ${"an unknown code"}
      ${""}           | ${"20240615"}                      | ${undefined}                                | ${"an empty code"}
      ${"d8"}         | ${"20240615"}                      | ${undefined}                                | ${"a lower-case code"}
    `(
      "returns false for $formatQualifier '$value' with options $options ($reads), and the parser returns null",
      ({ formatQualifier, value, options }) => {
        expect(isValidX12DateTimePeriod(value, formatQualifier, options)).toBe(
          false,
        );
        expect(
          parseX12DateTimePeriod(value, formatQualifier, options),
        ).toBeNull();
      },
    );
  });

  describe("yearWindow", () => {
    // On 2026-10-07 "rolling" is 1976–2075, so 75 is 2075 and 76 is 1976: 29 February exists in
    // 1976 (a leap year) and not in 2075.
    it.each`
      value       | expected | reads
      ${"760229"} | ${true}  | ${"29 February 1976"}
      ${"750229"} | ${false} | ${"29 February 2075"}
      ${"240229"} | ${true}  | ${"29 February 2024"}
    `(
      'returns $expected for D6 $value with yearWindow "rolling" on 2026-10-07 ($reads)',
      ({ value, expected }) => {
        vi.spyOn(Temporal.Now, "instant").mockReturnValue(
          Temporal.Instant.from("2026-10-07T12:00:00Z"),
        );
        expect(Temporal.PlainDate.from("1976-12-31").dayOfYear).toBe(366);
        expect(Temporal.PlainDate.from("2075-12-31").dayOfYear).toBe(365);
        const options = { yearWindow: "rolling" } as const;
        expect(isValidX12DateTimePeriod(value, "D6", options)).toBe(expected);
        expect(parseX12DateTimePeriod(value, "D6", options) !== null).toBe(
          expected,
        );
      },
    );

    // Every code whose mask has YY and no CC needs the caller's window. 24 is 2024 in 2000–2099
    // and in the rolling 1976–2075 of 2026-10-07.
    it.each`
      formatQualifier | value
      ${"D6"}         | ${"240615"}
      ${"TT"}         | ${"061524"}
      ${"TR"}         | ${"1506241430"}
      ${"RD6"}        | ${"240615-240620"}
      ${"TU"}         | ${"24166"}
    `(
      "$formatQualifier $value is valid with a fixed window and with rolling, and not with no window or an unreadable rolling clock, as parseX12DateTimePeriod reads it",
      ({ formatQualifier, value }) => {
        const check = (options: unknown, expected: boolean): void => {
          expect(
            isValidX12DateTimePeriod(value, formatQualifier, options as never),
          ).toBe(expected);
          expect(
            parseX12DateTimePeriod(value, formatQualifier, options as never) !==
              null,
          ).toBe(expected);
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
    // 2000, a leap year, while the window is 2000–2099 (UTC 2050); from the UTC new year 2051
    // the window is 2001–2100 and 00 is 2100, which has no 29 February and no day 366. The last
    // two rows are instants whose local date and UTC date fall in different years: the UTC year
    // decides.
    it.each`
      now                            | expected | reads
      ${"2050-12-31T23:59:59Z"}      | ${true}  | ${"the last second of UTC 2050: 00 is 2000"}
      ${"2051-01-01T00:00:00Z"}      | ${false} | ${"the first second of UTC 2051: 00 is 2100"}
      ${"2051-01-01T00:00:00+02:00"} | ${true}  | ${"22:00Z on 31 December 2050, though a clock two hours east reads 2051"}
      ${"2050-12-31T23:59:59-05:00"} | ${false} | ${"04:59:59Z on 1 January 2051, though a clock five hours west reads 2050"}
    `(
      'returns $expected for D6 000229 and TU 00366 with yearWindow "rolling" at $now ($reads)',
      ({ now, expected }) => {
        expect(Temporal.PlainDate.from("2000-12-31").dayOfYear).toBe(366);
        expect(Temporal.PlainDate.from("2100-12-31").dayOfYear).toBe(365);
        vi.spyOn(Temporal.Now, "instant").mockReturnValue(
          Temporal.Instant.from(now),
        );
        const options = { yearWindow: "rolling" } as const;
        expect(isValidX12DateTimePeriod("000229", "D6", options)).toBe(
          expected,
        );
        expect(parseX12DateTimePeriod("000229", "D6", options) !== null).toBe(
          expected,
        );
        expect(isValidX12DateTimePeriod("00366", "TU", options)).toBe(expected);
        expect(parseX12DateTimePeriod("00366", "TU", options) !== null).toBe(
          expected,
        );
      },
    );

    it("returns false for a rolling window when the clock cannot be read", () => {
      mockTemporalNowInstantThrow();
      expect(
        isValidX12DateTimePeriod("240615", "D6", { yearWindow: "rolling" }),
      ).toBe(false);
    });
  });

  describe("the options argument is omitted, undefined or an Object", () => {
    // D8 never reads the bag, so false comes from the argument alone.
    it.each`
      make               | kind
      ${() => null}      | ${"null"}
      ${() => "rolling"} | ${"a string"}
      ${() => 2000}      | ${"a number"}
      ${() => true}      | ${"a boolean"}
    `(
      "returns false for D8 20240615 with options that are $kind, as the parser returns null",
      ({ make }) => {
        expect(
          isValidX12DateTimePeriod("20240615", "D8", make() as never),
        ).toBe(false);
        expect(
          parseX12DateTimePeriod("20240615", "D8", make() as never),
        ).toBeNull();
      },
    );

    it("reads a function carrying yearWindow as the object", () => {
      expect(
        isValidX12DateTimePeriod(
          "240615",
          "D6",
          Object.assign(() => undefined, WINDOW_2000),
        ),
      ).toBe(true);
    });

    it.each`
      make                    | kind
      ${() => hostileProxy()} | ${"a Proxy that throws on any trap"}
      ${() => revokedProxy()} | ${"a revoked Proxy"}
    `(
      "returns false for D6 240615 with options that are $kind, and true for D8, which never reads them",
      ({ make }) => {
        expect(isValidX12DateTimePeriod("240615", "D6", make() as never)).toBe(
          false,
        );
        expect(
          isValidX12DateTimePeriod("20240615", "D8", make() as never),
        ).toBe(true);
      },
    );
  });

  // A non-string collapses to one path per argument.
  it.each`
    argument             | call
    ${"value"}           | ${(bad: unknown) => isValidX12DateTimePeriod(bad as never, "D8")}
    ${"formatQualifier"} | ${(bad: unknown) => isValidX12DateTimePeriod("20240615", bad as never)}
  `("returns false for a $argument that is not a string", ({ call }) => {
    for (const [kind, make] of NON_STRINGS) {
      expect(call(make()), kind).toBe(false);
    }
  });

  it("returns false when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(isValidX12DateTimePeriod("20240615", "D8")).toBe(false);
  });
});
