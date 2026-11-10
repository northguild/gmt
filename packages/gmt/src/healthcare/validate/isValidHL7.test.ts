import { hl7AllStringInputs } from "../../test/hl7ParseRows";
import { NON_STRINGS } from "../../test/nonStrings";
import { parseHL7 } from "../parse/parseHL7";
import { isValidHL7 } from "./isValidHL7";

/** Each verdict is worked out from HL7 v2.5.1 2.A.22 (DTM), 2.A.77 (TS) and ch. 2 §2.5.3 (null). */
describe("isValidHL7", () => {
  it.each`
    value                     | expected | reads
    ${"20240615103000-0500"}  | ${true}  | ${"a DTM to the second with an offset"}
    ${"2024"}                 | ${true}  | ${"a year alone"}
    ${'""'}                   | ${true}  | ${"the null value clears the stored one (ch. 2 §2.5.3)"}
    ${"199904011200^L"}       | ${true}  | ${"a TS whose degree lowers the precision to the month"}
    ${"20240615^"}            | ${true}  | ${"a TS with an empty degree of precision"}
    ${"20240615^D^"}          | ${true}  | ${"an empty trailing component is not present (ch. 2 §2.6.2)"}
    ${'""^'}                  | ${true}  | ${"the null value with an empty degree of precision"}
    ${"20240615^D^X"}         | ${true}  | ${"a third component is not expected and is ignored (ch. 2 §2.6.2)"}
    ${"2024&X"}               | ${true}  | ${"a subcomponent is not expected and is ignored (ch. 2 §2.6.2)"}
    ${"&X"}                   | ${false} | ${"an empty DTM before the subcomponent is not present"}
    ${"20240615^S"}           | ${false} | ${"a degree finer than the digits (2.A.77.2)"}
    ${"20240230"}             | ${false} | ${"30 February"}
    ${""}                     | ${false} | ${"an empty string is not the null value"}
    ${"20240615103000.12345"} | ${false} | ${"five fraction digits; the picture allows four"}
  `("returns $expected for '$value' ($reads)", ({ value, expected }) => {
    expect(isValidHL7(value)).toBe(expected);
  });

  it.each(NON_STRINGS.map(([label, make]) => ({ label, make })))(
    "returns false without throwing for $label",
    ({ make }) => {
      expect(isValidHL7(make() as never)).toBe(false);
    },
  );

  it("agrees with parseHL7 on every input of the parser's table", () => {
    expect(hl7AllStringInputs.length).toBeGreaterThan(0);
    for (const input of hl7AllStringInputs) {
      expect(isValidHL7(input), input).toBe(parseHL7(input) !== null);
    }
  });
});
