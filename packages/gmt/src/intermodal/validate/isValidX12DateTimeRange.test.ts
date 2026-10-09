import { NON_STRINGS, x12FormatsOutside } from "../../test/ediCodes";
import { parseX12DateTimeRange } from "../parse/parseX12DateTimeRange";
import { isValidX12DateTimeRange } from "./isValidX12DateTimeRange";

/** `RDT` is `CCYYMMDDHHMM-CCYYMMDDHHMM` and `DTS` is `CCYYMMDDHHMMSS-CCYYMMDDHHMMSS`, each with its one hyphen. */
describe("isValidX12DateTimeRange", () => {
  it.each`
    code     | value                              | expected | reads
    ${"RDT"} | ${"202406151430-202406201600"}     | ${true}  | ${"minutes"}
    ${"DTS"} | ${"20240615143045-20240620160030"} | ${true}  | ${"seconds"}
    ${"RDT"} | ${"202406151430-202406151430"}     | ${true}  | ${"the end equals the start"}
    ${"RDT"} | ${"202406151431-202406151430"}     | ${false} | ${"the end precedes the start"}
    ${"RDT"} | ${"202406151430202406201600"}      | ${false} | ${"no hyphen"}
    ${"RDT"} | ${"202406152430-202406201600"}     | ${false} | ${"hour 24 in the start"}
    ${"DTS"} | ${"202406151430-202406201600"}     | ${false} | ${"RDT's value under DTS"}
    ${"RDT"} | ${"20240615-202406201600"}         | ${false} | ${"a date and a date-time"}
    ${"RDT"} | ${""}                              | ${false} | ${"an empty value"}
  `(
    "returns $expected for $value under $code ($reads), as parseX12DateTimeRange reads it",
    ({ code, value, expected }) => {
      expect(isValidX12DateTimeRange(value, code)).toBe(expected);
      expect(parseX12DateTimeRange(value, code) !== null).toBe(expected);
    },
  );

  it.each(x12FormatsOutside("dateTimeRange"))(
    "returns false for code '$code' ($reads)",
    ({ code }) => {
      expect(
        isValidX12DateTimeRange("202406151430-202406201600", code as never),
      ).toBe(false);
    },
  );

  it("returns false for an argument that is not a string", () => {
    for (const [kind, make] of NON_STRINGS) {
      expect(isValidX12DateTimeRange(make() as never, "RDT"), kind).toBe(false);
      expect(
        isValidX12DateTimeRange("202406151430-202406201600", make() as never),
        kind,
      ).toBe(false);
    }
  });
});
