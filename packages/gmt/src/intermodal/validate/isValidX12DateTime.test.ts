import { NON_STRINGS, x12FormatsOutside } from "../../test/ediCodes";
import { parseX12DateTime } from "../parse/parseX12DateTime";
import { isValidX12DateTime } from "./isValidX12DateTime";

/** `DT` is `CCYYMMDDHHMM` and `RTS` is `CCYYMMDDHHMMSS`; each verdict is worked out from the mask and the calendar. */
describe("isValidX12DateTime", () => {
  it.each`
    code     | value               | expected | reads
    ${"DT"}  | ${"202406151430"}   | ${true}  | ${"CCYYMMDDHHMM"}
    ${"RTS"} | ${"20240615143045"} | ${true}  | ${"CCYYMMDDHHMMSS"}
    ${"DT"}  | ${"20240615143045"} | ${false} | ${"RTS's value under DT"}
    ${"RTS"} | ${"202406151430"}   | ${false} | ${"DT's value under RTS"}
    ${"DT"}  | ${"202302291430"}   | ${false} | ${"29 February 2023"}
    ${"DT"}  | ${"202406152430"}   | ${false} | ${"hour 24"}
    ${"RTS"} | ${"20240615143060"} | ${false} | ${"second 60"}
    ${"DT"}  | ${""}               | ${false} | ${"an empty value"}
  `(
    "returns $expected for $value under $code ($reads), as parseX12DateTime reads it",
    ({ code, value, expected }) => {
      expect(isValidX12DateTime(value, code)).toBe(expected);
      expect(parseX12DateTime(value, code) !== "").toBe(expected);
    },
  );

  it.each(x12FormatsOutside("dateTime"))(
    "returns false for code '$code' ($reads)",
    ({ code }) => {
      expect(isValidX12DateTime("202406151430", code as never)).toBe(false);
    },
  );

  it("returns false for an argument that is not a string", () => {
    for (const [kind, make] of NON_STRINGS) {
      expect(isValidX12DateTime(make() as never, "DT"), kind).toBe(false);
      expect(isValidX12DateTime("202406151430", make() as never), kind).toBe(
        false,
      );
    }
  });
});
