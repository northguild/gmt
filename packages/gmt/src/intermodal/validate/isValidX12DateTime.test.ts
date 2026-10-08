import { X12_TIME_CODES } from "../../internal";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { hostileProxy, revokedProxy } from "../../test/noThrow";
import { parseX12DateTime } from "../parse/parseX12DateTime";
import { isValidX12DateTime } from "./isValidX12DateTime";

// X12 elements 373 (Date, CCYYMMDD), 337 (Time: HHMM, HHMMSS, HHMMSSD or HHMMSSDD) and 623 (Time
// Code). Each `expected` is decided from those three definitions, from the `DTM` syntax notes
// R020305 ("At least one of DTM-02, DTM-03 or DTM-05 is required": a date or a time may stand
// alone) and C0403 ("If DTM-04 is present, then DTM-03 is required"), and from two GMT rules:
// with neither a date nor a time there is nothing to read (R020305 is also met by DTM-05 alone,
// which `isValidX12DateTimePeriod` checks), and a time alone is read wherever it came from,
// though `AT7` C0605 forbids one. Every row then also checks that the parser agrees, null
// exactly where the validator is false.
describe("isValidX12DateTime", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("agrees with parseX12DateTime, and with the rule, on every row", () => {
    it.each`
      date            | time           | timeCode     | expected | reads
      ${"20240615"}   | ${undefined}   | ${undefined} | ${true}  | ${"a date alone"}
      ${"20240615"}   | ${""}          | ${""}        | ${true}  | ${"a date with two empty elements"}
      ${"20240229"}   | ${undefined}   | ${undefined} | ${true}  | ${"the leap day"}
      ${"20230229"}   | ${undefined}   | ${undefined} | ${false} | ${"29 February 2023"}
      ${"20240631"}   | ${undefined}   | ${undefined} | ${false} | ${"31 June"}
      ${"240615"}     | ${undefined}   | ${undefined} | ${false} | ${"a two-digit year: element 373 has four"}
      ${"2024-06-15"} | ${undefined}   | ${undefined} | ${false} | ${"an ISO 8601 date"}
      ${" "}          | ${"1430"}      | ${"UT"}      | ${false} | ${"a date of one space: sent, and not a date"}
      ${""}           | ${"1430"}      | ${undefined} | ${true}  | ${"a time alone, the date empty (R020305)"}
      ${undefined}    | ${"1430"}      | ${undefined} | ${true}  | ${"a time alone, the date undefined"}
      ${""}           | ${"14304512"}  | ${""}        | ${true}  | ${"a time alone with hundredths"}
      ${""}           | ${"1430"}      | ${"UT"}      | ${true}  | ${"a time alone with an offset code"}
      ${undefined}    | ${"1430"}      | ${"20"}      | ${true}  | ${"a time alone with a numeric offset code"}
      ${""}           | ${"1430"}      | ${"ES"}      | ${true}  | ${"a time alone with a named code"}
      ${undefined}    | ${"1430"}      | ${"LT"}      | ${true}  | ${"a time alone with local time"}
      ${""}           | ${"1430"}      | ${"EST"}     | ${false} | ${"a time alone with a code that is not in 623"}
      ${""}           | ${"2430"}      | ${undefined} | ${false} | ${"a time alone, hour 24"}
      ${""}           | ${"14304"}     | ${"UT"}      | ${false} | ${"a time alone, five digits"}
      ${""}           | ${""}          | ${""}        | ${false} | ${"nothing sent: all three empty (GMT rule)"}
      ${undefined}    | ${undefined}   | ${undefined} | ${false} | ${"nothing sent: all three undefined"}
      ${""}           | ${""}          | ${"UT"}      | ${false} | ${"a time code alone (C0403)"}
      ${undefined}    | ${undefined}   | ${"ES"}      | ${false} | ${"a named time code alone (C0403)"}
      ${"20240615"}   | ${"1430"}      | ${undefined} | ${true}  | ${"HHMM"}
      ${"20240615"}   | ${"143045"}    | ${undefined} | ${true}  | ${"HHMMSS"}
      ${"20240615"}   | ${"1430451"}   | ${undefined} | ${true}  | ${"HHMMSSD"}
      ${"20240615"}   | ${"14304512"}  | ${undefined} | ${true}  | ${"HHMMSSDD"}
      ${"20240615"}   | ${"14304"}     | ${undefined} | ${false} | ${"five digits"}
      ${"20240615"}   | ${"143045123"} | ${undefined} | ${false} | ${"nine digits"}
      ${"20240615"}   | ${"2430"}      | ${undefined} | ${false} | ${"hour 24"}
      ${"20240615"}   | ${"1460"}      | ${undefined} | ${false} | ${"minute 60"}
      ${"20240615"}   | ${"143060"}    | ${undefined} | ${false} | ${"second 60"}
      ${"20240615"}   | ${"14:30"}     | ${undefined} | ${false} | ${"a colon"}
      ${"20240615"}   | ${"1430"}      | ${""}        | ${true}  | ${"an empty time code"}
      ${"20240615"}   | ${"1430"}      | ${"UT"}      | ${true}  | ${"an offset code"}
      ${"20240615"}   | ${"1430"}      | ${"13"}      | ${true}  | ${"a numeric offset code"}
      ${"20240615"}   | ${"1430"}      | ${"ES"}      | ${true}  | ${"a named code: valid, though it states no offset"}
      ${"20240615"}   | ${"1430"}      | ${"LT"}      | ${true}  | ${"local time"}
      ${"20240615"}   | ${"1430"}      | ${"EST"}     | ${false} | ${"not an element 623 code"}
      ${"20240615"}   | ${"1430"}      | ${"et"}      | ${false} | ${"lower case"}
      ${"20240615"}   | ${"1430"}      | ${"30"}      | ${false} | ${"above the numeric run"}
      ${"20240615"}   | ${undefined}   | ${"UT"}      | ${false} | ${"a time code with no time (C0403)"}
      ${"20240615"}   | ${""}          | ${"ES"}      | ${false} | ${"a time code with an empty time (C0403)"}
      ${"99991231"}   | ${"2330"}      | ${"24"}      | ${true}  | ${"the last four-digit year, though the instant's UTC year is 10000"}
    `(
      "returns $expected for date $date, time $time, time code $timeCode ($reads)",
      ({ date, time, timeCode, expected }) => {
        expect(isValidX12DateTime(date, time, timeCode)).toBe(expected);
        expect(parseX12DateTime(date, time, timeCode) !== null).toBe(expected);
      },
    );

    it("is true for 20240615 1430 with every one of the 56 element 623 codes", () => {
      expect(X12_TIME_CODES).toHaveLength(56);
      for (const timeCode of X12_TIME_CODES) {
        expect(isValidX12DateTime("20240615", "1430", timeCode), timeCode).toBe(
          true,
        );
      }
    });

    it("is true with the trailing arguments omitted", () => {
      expect(isValidX12DateTime("20240615")).toBe(true);
      expect(isValidX12DateTime("20240615", "1430")).toBe(true);
    });

    it("is true for a time alone with every one of the 56 element 623 codes", () => {
      for (const timeCode of X12_TIME_CODES) {
        expect(isValidX12DateTime("", "1430", timeCode), timeCode).toBe(true);
        expect(isValidX12DateTime(undefined, "1430", timeCode), timeCode).toBe(
          true,
        );
      }
    });

    it("is false with every argument omitted", () => {
      expect(isValidX12DateTime()).toBe(false);
    });
  });

  describe("non-string arguments", () => {
    const nonStrings: [string, () => unknown][] = [
      ["null", () => null],
      ["a number", () => 20240615],
      ["a boolean", () => true],
      ["an array holding the value", () => ["20240615"]],
      ["an object", () => ({})],
      ["a Proxy that throws on any trap", hostileProxy],
      ["a revoked Proxy", revokedProxy],
    ];

    // A non-string collapses to one path per argument.
    it.each`
      argument      | call
      ${"date"}     | ${(bad: unknown) => isValidX12DateTime(bad as never, "1430", "UT")}
      ${"time"}     | ${(bad: unknown) => isValidX12DateTime("20240615", bad as never)}
      ${"timeCode"} | ${(bad: unknown) => isValidX12DateTime("20240615", "1430", bad as never)}
    `("returns false for a $argument that is not a string", ({ call }) => {
      for (const [kind, make] of nonStrings) {
        expect(call(make()), kind).toBe(false);
      }
    });

    // Only undefined and "" mean "not sent": any other non-string date is invalid, even beside
    // a time that could stand alone.
    it("returns false for a non-string date beside a time alone", () => {
      for (const [kind, make] of nonStrings) {
        expect(isValidX12DateTime(make() as never, "1430"), kind).toBe(false);
      }
    });
  });

  it("returns false when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(isValidX12DateTime("20240615")).toBe(false);
  });
});
