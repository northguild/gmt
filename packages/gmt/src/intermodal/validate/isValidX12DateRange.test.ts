import { NON_STRINGS, x12FormatsOutside } from "../../test/ediCodes";
import { parseX12DateRange } from "../parse/parseX12DateRange";
import { isValidX12DateRange } from "./isValidX12DateRange";

/** `RD8` is `CCYYMMDD-CCYYMMDD` and `RD` is `MMDDCCYY-MMDDCCYY`, each with its one hyphen. */
describe("isValidX12DateRange", () => {
  it.each`
    code     | value                  | expected | reads
    ${"RD8"} | ${"20240615-20240620"} | ${true}  | ${"five days"}
    ${"RD"}  | ${"06152024-06202024"} | ${true}  | ${"month first"}
    ${"RD8"} | ${"20240615-20240615"} | ${true}  | ${"the end equals the start"}
    ${"RD8"} | ${"20240620-20240615"} | ${false} | ${"the end precedes the start"}
    ${"RD8"} | ${"2024061520240620"}  | ${false} | ${"no hyphen"}
    ${"RD8"} | ${"20230229-20240620"} | ${false} | ${"29 February 2023 in the start"}
    ${"RD"}  | ${"20240615-20240620"} | ${false} | ${"RD8's order under RD"}
    ${"RD8"} | ${"20240615"}          | ${false} | ${"one date"}
    ${"RD8"} | ${""}                  | ${false} | ${"an empty value"}
  `(
    "returns $expected for $value under $code ($reads), as parseX12DateRange reads it",
    ({ code, value, expected }) => {
      expect(isValidX12DateRange(value, code)).toBe(expected);
      expect(parseX12DateRange(value, code) !== null).toBe(expected);
    },
  );

  it.each(x12FormatsOutside("dateRange"))(
    "returns false for code '$code' ($reads)",
    ({ code }) => {
      expect(isValidX12DateRange("20240615-20240620", code as never)).toBe(
        false,
      );
    },
  );

  it("returns false for an argument that is not a string", () => {
    for (const [kind, make] of NON_STRINGS) {
      expect(isValidX12DateRange(make() as never, "RD8"), kind).toBe(false);
      expect(
        isValidX12DateRange("20240615-20240620", make() as never),
        kind,
      ).toBe(false);
    }
  });
});
