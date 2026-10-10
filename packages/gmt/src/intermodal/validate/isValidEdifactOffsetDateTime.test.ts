import { NON_STRINGS, edifactFormatsOutside } from "../../test/ediCodes";
import { parseEdifactOffsetDateTime } from "../parse/parseEdifactOffsetDateTime";
import { isValidEdifactOffsetDateTime } from "./isValidEdifactOffsetDateTime";

/** Each verdict is worked out from the UNTDID 2379 mask, the calendar and the `ZZZ` rule. */
describe("isValidEdifactOffsetDateTime", () => {
  it.each`
    code     | value                    | expected | reads
    ${"205"} | ${"202406151430+0200"}   | ${true}  | ${"CCYYMMDDHHMMZHHMM"}
    ${"208"} | ${"20240615143045+0530"} | ${true}  | ${"CCYYMMDDHHMMSSZHHMM"}
    ${"303"} | ${"202406151430+02"}     | ${true}  | ${"a signed hour"}
    ${"303"} | ${"202406151430UTC"}     | ${true}  | ${"the literal UTC"}
    ${"304"} | ${"20240615143045GMT"}   | ${true}  | ${"the literal GMT"}
    ${"303"} | ${"202406151430CET"}     | ${false} | ${"an abbreviation names no offset"}
    ${"303"} | ${"202406151430+24"}     | ${false} | ${"a signed 24"}
    ${"303"} | ${"202406151430Z"}       | ${false} | ${"a lone Z: the mask has three zone characters"}
    ${"303"} | ${"202406151430?+02"}    | ${false} | ${"the release character is not part of the value"}
    ${"205"} | ${"202406151430+02"}     | ${false} | ${"303's value under 205"}
    ${"205"} | ${"202406151430+2400"}   | ${false} | ${"offset hour 24"}
    ${"205"} | ${"202302291430+0200"}   | ${false} | ${"29 February 2023"}
    ${"205"} | ${"202406151430"}        | ${false} | ${"203's value: no offset"}
    ${"205"} | ${""}                    | ${false} | ${"an empty value"}
  `(
    "returns $expected for $value under $code ($reads), as parseEdifactOffsetDateTime reads it",
    ({ code, value, expected }) => {
      expect(isValidEdifactOffsetDateTime(value, code)).toBe(expected);
      expect(parseEdifactOffsetDateTime(value, code) !== "").toBe(expected);
    },
  );

  it.each(edifactFormatsOutside("offsetDateTime"))(
    "returns false for code '$code' ($reads)",
    ({ code }) => {
      expect(
        isValidEdifactOffsetDateTime("202406151430+0200", code as never),
      ).toBe(false);
    },
  );

  it("returns false for an argument that is not a string", () => {
    for (const [kind, make] of NON_STRINGS) {
      expect(isValidEdifactOffsetDateTime(make() as never, "205"), kind).toBe(
        false,
      );
      expect(
        isValidEdifactOffsetDateTime("202406151430+0200", make() as never),
        kind,
      ).toBe(false);
    }
  });
});
