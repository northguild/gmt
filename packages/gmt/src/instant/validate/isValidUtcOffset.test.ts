import { utcOffset } from "../../regex";
import { NON_STRINGS } from "../../test/ediCodes";
import { isValidTimeZone } from "../../zoned/validate/isValidTimeZone";
import { fromOffsetInstant } from "../convert/fromOffsetInstant";
import { isValidUtcOffset } from "./isValidUtcOffset";

/**
 * Each verdict is decided from the form `utcOffset` documents, the one the offset-instant pair
 * stores: ISO 8601 extended `±HH:MM`, optionally `±HH:MM:SS`, hour `00`–`23`, minute and second
 * `00`–`59`; never `Z`, basic format, an hour alone or a fraction of a second. For a string the
 * pattern is the whole rule, so `utcOffset.test` equals `expected` on every row. Every row then
 * checks that `fromOffsetInstant`, which takes such an offset, accepts exactly the same strings.
 */
describe("isValidUtcOffset", () => {
  it.each`
    value                          | expected | reason
    ${"+00:00"}                    | ${true}  | ${"zero"}
    ${"-00:00"}                    | ${true}  | ${"negative zero, which ISO 8601 permits"}
    ${"-04:00"}                    | ${true}  | ${"a whole-hour offset west of UTC"}
    ${"+14:00"}                    | ${true}  | ${"the largest offset in use"}
    ${"+05:30"}                    | ${true}  | ${"a half-hour offset"}
    ${"+05:45"}                    | ${true}  | ${"a quarter-hour offset"}
    ${"+05:45:00"}                 | ${true}  | ${"seconds written as 00"}
    ${"-00:44:30"}                 | ${true}  | ${"a sub-minute offset: Africa/Monrovia before 1972"}
    ${"+23:59"}                    | ${true}  | ${"the largest whole-minute offset"}
    ${"-23:59"}                    | ${true}  | ${"the smallest whole-minute offset"}
    ${"+23:59:59"}                 | ${true}  | ${"the largest offset the form holds"}
    ${"-23:59:59"}                 | ${true}  | ${"the smallest offset the form holds"}
    ${"Z"}                         | ${false} | ${"Z is a designator, not an offset"}
    ${"z"}                         | ${false} | ${"lower-case z"}
    ${"-0400"}                     | ${false} | ${"basic format, no colon"}
    ${"-04"}                       | ${false} | ${"an hour alone"}
    ${"04:00"}                     | ${false} | ${"no sign"}
    ${"+24:00"}                    | ${false} | ${"hour 24"}
    ${"+04:60"}                    | ${false} | ${"minute 60"}
    ${"+04:00:60"}                 | ${false} | ${"second 60"}
    ${"+4:00"}                     | ${false} | ${"unpadded hour"}
    ${"+01:00:00.5"}               | ${false} | ${"a fraction of a second"}
    ${"−04:00"}                    | ${false} | ${"U+2212 minus sign"}
    ${" -04:00"}                   | ${false} | ${"leading space"}
    ${"-04:00 "}                   | ${false} | ${"trailing space"}
    ${"-04:00\n"}                  | ${false} | ${"trailing line feed"}
    ${"2024-03-10T12:00:00-04:00"} | ${false} | ${"a whole date-time string"}
    ${"UTC"}                       | ${false} | ${"a zone name"}
    ${"America/New_York"}          | ${false} | ${"a zone name"}
    ${""}                          | ${false} | ${"empty"}
  `(
    "returns $expected for $value ($reason), as the pattern does; fromOffsetInstant agrees",
    ({ value, expected }: { value: string; expected: boolean }) => {
      const pair = { instant: "2024-07-15T16:00:00Z", offset: value };

      expect(isValidUtcOffset(value)).toBe(expected);
      expect(utcOffset.test(value)).toBe(expected);
      expect(fromOffsetInstant(pair) !== "").toBe(expected);
    },
  );

  // An offset is also a time zone identifier, and that is a different grammar: Temporal's
  // `UTCOffset[~SubMinutePrecision]` (`isValidTimeZone`) takes basic format and an hour alone and
  // refuses seconds. The two validators agree only on `±HH:MM`.
  it.each`
    value          | asOffset | asTimeZone | reason
    ${"+05:30"}    | ${true}  | ${true}    | ${"±HH:MM is both"}
    ${"-00:00"}    | ${true}  | ${true}    | ${"negative zero is both"}
    ${"+23:59"}    | ${true}  | ${true}    | ${"the largest whole-minute offset is both"}
    ${"-00:44:30"} | ${true}  | ${false}   | ${"seconds: a stored offset, not an identifier"}
    ${"+05:30:00"} | ${true}  | ${false}   | ${"seconds, even 00"}
    ${"+0530"}     | ${false} | ${true}    | ${"basic format: an identifier, not a stored offset"}
    ${"-08"}       | ${false} | ${true}    | ${"an hour alone"}
    ${"Z"}         | ${false} | ${false}   | ${"Z is neither"}
    ${"+24:00"}    | ${false} | ${false}   | ${"hour 24 is neither"}
  `(
    "$value is $asOffset as a stored offset and $asTimeZone as a time zone identifier ($reason)",
    ({
      value,
      asOffset,
      asTimeZone,
    }: {
      value: string;
      asOffset: boolean;
      asTimeZone: boolean;
    }) => {
      expect(isValidUtcOffset(value)).toBe(asOffset);
      expect(isValidTimeZone(value)).toBe(asTimeZone);
    },
  );

  it("returns false for an argument that is not a string, as fromOffsetInstant returns ''", () => {
    for (const [kind, make] of NON_STRINGS) {
      expect(isValidUtcOffset(make() as never), kind).toBe(false);
      expect(
        fromOffsetInstant({
          instant: "2024-07-15T16:00:00Z",
          offset: make() as never,
        }),
        kind,
      ).toBe("");
    }
  });
});
