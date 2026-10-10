import { NON_STRINGS } from "../../test/ediCodes";
import { parseX12DateAndTime } from "../parse/parseX12DateAndTime";
import { isValidX12DateAndTime } from "./isValidX12DateAndTime";

/**
 * Each verdict is read off the two elements by hand: data element 373 is `CCYYMMDD` and data
 * element 337 is `HHMM`, `HHMMSS`, `HHMMSSD` or `HHMMSSDD`, and together they must name a date
 * and a time that exist. The rows are those of `parseX12DateAndTime.test.ts`, so the two files
 * stay in step.
 */
describe("isValidX12DateAndTime", () => {
  it.each`
    date            | time           | expected | reads
    ${"20240615"}   | ${"1430"}      | ${true}  | ${"CCYYMMDD and HHMM"}
    ${"20240615"}   | ${"143045"}    | ${true}  | ${"HHMMSS"}
    ${"20240615"}   | ${"1430001"}   | ${true}  | ${"HHMMSSD: a tenth of a second"}
    ${"20240615"}   | ${"14300012"}  | ${true}  | ${"HHMMSSDD: hundredths of a second"}
    ${"20240615"}   | ${"14304505"}  | ${true}  | ${"five hundredths"}
    ${"20240229"}   | ${"2359599"}   | ${true}  | ${"the last tenth of leap day 2024"}
    ${"20240615"}   | ${"14300000"}  | ${true}  | ${"a zero fraction"}
    ${"20240229"}   | ${"0000"}      | ${true}  | ${"midnight on leap day 2024"}
    ${"20241231"}   | ${"2359"}      | ${true}  | ${"the last minute of a year"}
    ${"00000101"}   | ${"0000"}      | ${true}  | ${"the first four-digit year"}
    ${"99991231"}   | ${"23595999"}  | ${true}  | ${"the last hundredth of the last four-digit year"}
    ${""}           | ${"1430"}      | ${false} | ${"no date"}
    ${"20240615"}   | ${""}          | ${false} | ${"no time"}
    ${""}           | ${""}          | ${false} | ${"neither element"}
    ${"20230229"}   | ${"1430"}      | ${false} | ${"29 February 2023, not a leap year"}
    ${"20240631"}   | ${"1430"}      | ${false} | ${"31 June"}
    ${"20240615"}   | ${"2430"}      | ${false} | ${"hour 24"}
    ${"20240615"}   | ${"1460"}      | ${false} | ${"minute 60"}
    ${"20240615"}   | ${"143060"}    | ${false} | ${"second 60: GMT rejects a leap second"}
    ${"20240615"}   | ${"14304"}     | ${false} | ${"five digits is not an element 337 form"}
    ${"20240615"}   | ${"143045123"} | ${false} | ${"nine digits"}
    ${"240615"}     | ${"1430"}      | ${false} | ${"a two-digit year: element 373 is CCYYMMDD"}
    ${"06152024"}   | ${"1430"}      | ${false} | ${"month first: element 373 is CCYYMMDD"}
    ${"2024-06-15"} | ${"14:30"}     | ${false} | ${"ISO 8601: the values are the digits of the elements"}
    ${"20240615"}   | ${"1430ET"}    | ${false} | ${"a time code is its own element"}
  `(
    "returns $expected for $date and $time ($reads), as parseX12DateAndTime reads them",
    ({
      date,
      time,
      expected,
    }: {
      date: string;
      time: string;
      expected: boolean;
    }) => {
      expect(isValidX12DateAndTime(date, time)).toBe(expected);
      expect(parseX12DateAndTime(date, time) !== "").toBe(expected);
    },
  );

  it("returns false when an argument is omitted", () => {
    const omitTime = isValidX12DateAndTime as (date: string) => boolean;
    const omitBoth = isValidX12DateAndTime as () => boolean;
    expect(omitTime("20240615")).toBe(false);
    expect(omitBoth()).toBe(false);
  });

  it("returns false for an argument that is not a string", () => {
    for (const [kind, make] of NON_STRINGS) {
      expect(isValidX12DateAndTime(make() as never, "1430"), kind).toBe(false);
      expect(isValidX12DateAndTime("20240615", make() as never), kind).toBe(
        false,
      );
    }
  });
});
