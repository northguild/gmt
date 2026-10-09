import { NON_STRINGS, edifactFormatsOutside } from "../../test/ediCodes";
import { parseEdifactDateTimePeriod } from "../parse/parseEdifactDateTimePeriod";
import { isValidEdifactDateTimePeriod } from "./isValidEdifactDateTimePeriod";

/** `719` is `CCYYMMDDHHMM-CCYYMMDDHHMM` with no hyphen on the wire; each verdict is worked out from that. */
describe("isValidEdifactDateTimePeriod", () => {
  it.each`
    value                          | expected | reads
    ${"202406151430202406201600"}  | ${true}  | ${"five days and ninety minutes"}
    ${"202406151430202406151430"}  | ${true}  | ${"the end equals the start"}
    ${"202406151431202406151430"}  | ${false} | ${"the end precedes the start"}
    ${"202406151430-202406201600"} | ${false} | ${"a hyphen is never transmitted"}
    ${"202406152430202406201600"}  | ${false} | ${"hour 24 in the start"}
    ${"202406151430"}              | ${false} | ${"one date-time"}
    ${""}                          | ${false} | ${"an empty value"}
  `(
    "returns $expected for $value under 719 ($reads), as parseEdifactDateTimePeriod reads it",
    ({ value, expected }) => {
      expect(isValidEdifactDateTimePeriod(value, "719")).toBe(expected);
      expect(parseEdifactDateTimePeriod(value, "719") !== null).toBe(expected);
    },
  );

  it.each(edifactFormatsOutside("dateTimePeriod"))(
    "returns false for code '$code' ($reads)",
    ({ code }) => {
      expect(
        isValidEdifactDateTimePeriod("202406151430202406201600", code as never),
      ).toBe(false);
    },
  );

  it("returns false for an argument that is not a string", () => {
    for (const [kind, make] of NON_STRINGS) {
      expect(isValidEdifactDateTimePeriod(make() as never, "719"), kind).toBe(
        false,
      );
      expect(
        isValidEdifactDateTimePeriod(
          "202406151430202406201600",
          make() as never,
        ),
        kind,
      ).toBe(false);
    }
  });
});
