import { NON_STRINGS, x12FormatsOutside } from "../../test/ediCodes";
import { parseX12Time } from "../parse/parseX12Time";
import { isValidX12Time } from "./isValidX12Time";

/** Data element 337 is `HHMM`, `HHMMSS`, `HHMMSSD` or `HHMMSSDD`; each verdict is worked out from that. */
describe("isValidX12Time", () => {
  it.each`
    value          | expected | reads
    ${"1430"}      | ${true}  | ${"HHMM"}
    ${"143045"}    | ${true}  | ${"HHMMSS"}
    ${"1430451"}   | ${true}  | ${"HHMMSSD"}
    ${"14304512"}  | ${true}  | ${"HHMMSSDD"}
    ${"0000"}      | ${true}  | ${"midnight"}
    ${"2400"}      | ${false} | ${"hour 24"}
    ${"1460"}      | ${false} | ${"minute 60"}
    ${"143060"}    | ${false} | ${"second 60"}
    ${"14304"}     | ${false} | ${"five digits"}
    ${"143045123"} | ${false} | ${"nine digits"}
    ${"14:30"}     | ${false} | ${"a colon"}
    ${""}          | ${false} | ${"an empty value"}
  `(
    "returns $expected for $value ($reads), as parseX12Time reads it",
    ({ value, expected }) => {
      expect(isValidX12Time(value)).toBe(expected);
      expect(parseX12Time(value) !== "").toBe(expected);
    },
  );

  // With a 1250 qualifier the value is that qualifier's mask exactly: `TM` is `HHMM` and `TS` is
  // `HHMMSS`. `unqualified` is the verdict for the same digits as an element 337 value.
  it.each`
    format  | value         | expected | unqualified | reads
    ${"TM"} | ${"1430"}     | ${true}  | ${true}     | ${"HHMM"}
    ${"TS"} | ${"143045"}   | ${true}  | ${true}     | ${"HHMMSS"}
    ${"TM"} | ${"143045"}   | ${false} | ${true}     | ${"six digits is a TS value"}
    ${"TS"} | ${"1430"}     | ${false} | ${true}     | ${"four digits is a TM value"}
    ${"TM"} | ${"1430451"}  | ${false} | ${true}     | ${"tenths: no 1250 code holds them"}
    ${"TS"} | ${"14304512"} | ${false} | ${true}     | ${"hundredths: no 1250 code holds them"}
    ${"TM"} | ${"2400"}     | ${false} | ${false}    | ${"hour 24"}
    ${"TS"} | ${"143060"}   | ${false} | ${false}    | ${"second 60"}
    ${"TM"} | ${""}         | ${false} | ${false}    | ${"an empty value"}
  `(
    "returns $expected for $value under $format ($reads) and $unqualified with no qualifier, as parseX12Time reads it",
    ({ format, value, expected, unqualified }) => {
      expect(isValidX12Time(value, format)).toBe(expected);
      expect(parseX12Time(value, format) !== "").toBe(expected);
      expect(isValidX12Time(value)).toBe(unqualified);
      expect(isValidX12Time(value, undefined)).toBe(unqualified);
    },
  );

  it.each(x12FormatsOutside("time"))(
    "returns false for the format '$code' ($reads)",
    ({ code }) => {
      expect(isValidX12Time("1430", code as never)).toBe(false);
      expect(isValidX12Time("143045", code as never)).toBe(false);
    },
  );

  it("returns false for a format that is not a string and not undefined", () => {
    for (const [kind, make] of NON_STRINGS) {
      const format = make();
      if (format === undefined) {
        continue;
      }
      expect(isValidX12Time("1430", format as never), kind).toBe(false);
    }
  });

  it("returns false for a value that is not a string", () => {
    for (const [kind, make] of NON_STRINGS) {
      expect(isValidX12Time(make() as never), kind).toBe(false);
    }
  });
});
