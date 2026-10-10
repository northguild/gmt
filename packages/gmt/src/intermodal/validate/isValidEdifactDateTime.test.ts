import { NON_STRINGS, edifactFormatsOutside } from "../../test/ediCodes";
import { parseEdifactDateTime } from "../parse/parseEdifactDateTime";
import { isValidEdifactDateTime } from "./isValidEdifactDateTime";

/** `203` is `CCYYMMDDHHMM` and `204` is `CCYYMMDDHHMMSS`; each verdict is worked out from the mask and the calendar. */
describe("isValidEdifactDateTime", () => {
  it.each`
    code     | value                  | expected | reads
    ${"203"} | ${"202406151430"}      | ${true}  | ${"CCYYMMDDHHMM"}
    ${"204"} | ${"20240615143045"}    | ${true}  | ${"CCYYMMDDHHMMSS"}
    ${"203"} | ${"202402291200"}      | ${true}  | ${"leap day 2024"}
    ${"203"} | ${"20240615143045"}    | ${false} | ${"204's value under 203"}
    ${"204"} | ${"202406151430"}      | ${false} | ${"203's value under 204"}
    ${"203"} | ${"202302291430"}      | ${false} | ${"29 February 2023"}
    ${"203"} | ${"202406152430"}      | ${false} | ${"hour 24"}
    ${"204"} | ${"20240615143060"}    | ${false} | ${"second 60"}
    ${"203"} | ${"202406151430+0200"} | ${false} | ${"205's value"}
    ${"203"} | ${""}                  | ${false} | ${"an empty value"}
  `(
    "returns $expected for $value under $code ($reads), as parseEdifactDateTime reads it",
    ({ code, value, expected }) => {
      expect(isValidEdifactDateTime(value, code)).toBe(expected);
      expect(parseEdifactDateTime(value, code) !== "").toBe(expected);
    },
  );

  it.each(edifactFormatsOutside("dateTime"))(
    "returns false for code '$code' ($reads)",
    ({ code }) => {
      expect(isValidEdifactDateTime("202406151430", code as never)).toBe(false);
    },
  );

  it("returns false for an argument that is not a string", () => {
    for (const [kind, make] of NON_STRINGS) {
      expect(isValidEdifactDateTime(make() as never, "203"), kind).toBe(false);
      expect(
        isValidEdifactDateTime("202406151430", make() as never),
        kind,
      ).toBe(false);
    }
  });
});
