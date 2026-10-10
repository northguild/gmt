import { NON_STRINGS, edifactFormatsOutside } from "../../test/ediCodes";
import { parseEdifactDatePeriod } from "../parse/parseEdifactDatePeriod";
import { isValidEdifactDatePeriod } from "./isValidEdifactDatePeriod";

/** `718` is `CCYYMMDD-CCYYMMDD` with no hyphen on the wire; each verdict is worked out from that. */
describe("isValidEdifactDatePeriod", () => {
  it.each`
    value                  | expected | reads
    ${"2024061520240620"}  | ${true}  | ${"five days"}
    ${"2024061520240615"}  | ${true}  | ${"the end equals the start"}
    ${"0000010199991231"}  | ${true}  | ${"the whole four-digit range"}
    ${"2024062020240615"}  | ${false} | ${"the end precedes the start"}
    ${"20240615-20240620"} | ${false} | ${"a hyphen is never transmitted"}
    ${"2023022920240620"}  | ${false} | ${"29 February 2023 in the start"}
    ${"20240615"}          | ${false} | ${"one date"}
    ${""}                  | ${false} | ${"an empty value"}
  `(
    "returns $expected for $value under 718 ($reads), as parseEdifactDatePeriod reads it",
    ({ value, expected }) => {
      expect(isValidEdifactDatePeriod(value, "718")).toBe(expected);
      expect(parseEdifactDatePeriod(value, "718") !== null).toBe(expected);
    },
  );

  it.each(edifactFormatsOutside("datePeriod"))(
    "returns false for code '$code' ($reads)",
    ({ code }) => {
      expect(isValidEdifactDatePeriod("2024061520240620", code as never)).toBe(
        false,
      );
    },
  );

  it("returns false for an argument that is not a string", () => {
    for (const [kind, make] of NON_STRINGS) {
      expect(isValidEdifactDatePeriod(make() as never, "718"), kind).toBe(
        false,
      );
      expect(
        isValidEdifactDatePeriod("2024061520240620", make() as never),
        kind,
      ).toBe(false);
    }
  });
});
