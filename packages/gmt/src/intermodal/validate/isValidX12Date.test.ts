import { NON_STRINGS, x12FormatsOutside } from "../../test/ediCodes";
import { parseX12Date } from "../parse/parseX12Date";
import { isValidX12Date } from "./isValidX12Date";

/** `D8` is `CCYYMMDD` and `DB` is `MMDDCCYY`; each verdict is worked out from the mask and the calendar. */
describe("isValidX12Date", () => {
  it.each`
    code    | value           | expected | reads
    ${"D8"} | ${"20240615"}   | ${true}  | ${"CCYYMMDD"}
    ${"DB"} | ${"06152024"}   | ${true}  | ${"MMDDCCYY"}
    ${"D8"} | ${"20240229"}   | ${true}  | ${"leap day 2024"}
    ${"D8"} | ${"06152024"}   | ${false} | ${"DB's value under D8: 20 is not a month"}
    ${"DB"} | ${"20240615"}   | ${false} | ${"D8's value under DB: 20 is not a month"}
    ${"D8"} | ${"20230229"}   | ${false} | ${"29 February 2023"}
    ${"DB"} | ${"02292023"}   | ${false} | ${"29 February 2023, month first"}
    ${"D8"} | ${"240615"}     | ${false} | ${"a two-digit year"}
    ${"D8"} | ${"2024-06-15"} | ${false} | ${"an ISO 8601 date"}
    ${"D8"} | ${""}           | ${false} | ${"an empty value"}
  `(
    "returns $expected for $value under $code ($reads), as parseX12Date reads it",
    ({ code, value, expected }) => {
      expect(isValidX12Date(value, code)).toBe(expected);
      expect(parseX12Date(value, code) !== "").toBe(expected);
    },
  );

  it.each(x12FormatsOutside("date"))(
    "returns false for code '$code' ($reads)",
    ({ code }) => {
      expect(isValidX12Date("20240615", code as never)).toBe(false);
    },
  );

  it("returns false for an argument that is not a string", () => {
    for (const [kind, make] of NON_STRINGS) {
      expect(isValidX12Date(make() as never, "D8"), kind).toBe(false);
      expect(isValidX12Date("20240615", make() as never), kind).toBe(false);
    }
  });
});
