import { NON_STRINGS, edifactFormatsOutside } from "../../test/ediCodes";
import { parseEdifactDate } from "../parse/parseEdifactDate";
import { isValidEdifactDate } from "./isValidEdifactDate";

/** `102` is `CCYYMMDD`; each row's verdict is worked out from the mask and the calendar. */
describe("isValidEdifactDate", () => {
  it.each`
    value           | expected | reads
    ${"20240615"}   | ${true}  | ${"15 June 2024"}
    ${"20240229"}   | ${true}  | ${"leap day 2024"}
    ${"00000101"}   | ${true}  | ${"the first four-digit year"}
    ${"99991231"}   | ${true}  | ${"the last four-digit year"}
    ${"20230229"}   | ${false} | ${"29 February 2023"}
    ${"20240631"}   | ${false} | ${"31 June"}
    ${"240615"}     | ${false} | ${"a two-digit year"}
    ${"2024-06-15"} | ${false} | ${"an ISO 8601 date"}
    ${""}           | ${false} | ${"an empty value"}
  `(
    "returns $expected for $value under 102 ($reads), as parseEdifactDate reads it",
    ({ value, expected }) => {
      expect(isValidEdifactDate(value, "102")).toBe(expected);
      expect(parseEdifactDate(value, "102") !== "").toBe(expected);
    },
  );

  it.each(edifactFormatsOutside("date"))(
    "returns false for code '$code' ($reads)",
    ({ code }) => {
      expect(isValidEdifactDate("20240615", code as never)).toBe(false);
    },
  );

  it("returns false for an argument that is not a string", () => {
    for (const [kind, make] of NON_STRINGS) {
      expect(isValidEdifactDate(make() as never, "102"), kind).toBe(false);
      expect(isValidEdifactDate("20240615", make() as never), kind).toBe(false);
    }
  });
});
