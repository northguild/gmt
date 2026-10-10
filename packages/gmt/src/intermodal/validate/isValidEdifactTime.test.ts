import { NON_STRINGS, edifactFormatsOutside } from "../../test/ediCodes";
import { parseEdifactTime } from "../parse/parseEdifactTime";
import { isValidEdifactTime } from "./isValidEdifactTime";

/** `401` is `HHMM` and `402` is `HHMMSS`; each verdict is worked out from the mask. */
describe("isValidEdifactTime", () => {
  it.each`
    code     | value       | expected | reads
    ${"401"} | ${"1430"}   | ${true}  | ${"HHMM"}
    ${"401"} | ${"0000"}   | ${true}  | ${"midnight"}
    ${"402"} | ${"143045"} | ${true}  | ${"HHMMSS"}
    ${"402"} | ${"235959"} | ${true}  | ${"the last second of the day"}
    ${"401"} | ${"143045"} | ${false} | ${"402's value under 401"}
    ${"402"} | ${"1430"}   | ${false} | ${"401's value under 402"}
    ${"401"} | ${"2400"}   | ${false} | ${"hour 24"}
    ${"402"} | ${"143060"} | ${false} | ${"second 60"}
    ${"401"} | ${"14:30"}  | ${false} | ${"a colon"}
    ${"401"} | ${""}       | ${false} | ${"an empty value"}
  `(
    "returns $expected for $value under $code ($reads), as parseEdifactTime reads it",
    ({ code, value, expected }) => {
      expect(isValidEdifactTime(value, code)).toBe(expected);
      expect(parseEdifactTime(value, code) !== "").toBe(expected);
    },
  );

  it.each(edifactFormatsOutside("time"))(
    "returns false for code '$code' ($reads)",
    ({ code }) => {
      expect(isValidEdifactTime("1430", code as never)).toBe(false);
    },
  );

  it("returns false for an argument that is not a string", () => {
    for (const [kind, make] of NON_STRINGS) {
      expect(isValidEdifactTime(make() as never, "401"), kind).toBe(false);
      expect(isValidEdifactTime("1430", make() as never), kind).toBe(false);
    }
  });
});
