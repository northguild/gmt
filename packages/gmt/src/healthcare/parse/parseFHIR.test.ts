import { FHIR_PARSE_ROWS, FHIR_REJECT_ROWS } from "../../test/fhirRows";
import { NON_STRINGS } from "../../test/nonStrings";
import { parseFHIR } from "./parseFHIR";

describe("parseFHIR", () => {
  it.each(FHIR_PARSE_ROWS)(
    "reads '$input' as it is written",
    ({ input, expected }) => {
      expect(parseFHIR(input)).toStrictEqual(expected);
    },
  );

  it.each(FHIR_REJECT_ROWS)(
    "returns null for '$input' ($reason)",
    ({ input }) => {
      expect(parseFHIR(input)).toBeNull();
    },
  );

  it("keeps the identical input string as value", () => {
    const input = "2024-06-15T10:30:00-00:00";
    expect(parseFHIR(input)?.value).toBe(input);
  });

  it.each(NON_STRINGS.map(([kind, make]) => ({ kind, make })))(
    "returns null for the non-string $kind without throwing",
    ({ make }) => {
      expect(parseFHIR(make() as string)).toBeNull();
    },
  );

  // A String object, a number and an array all stringify to "2024": only the typeof check
  // refuses them.
  it.each`
    label                   | make
    ${"new String('2024')"} | ${() => new String("2024")}
    ${"2024"}               | ${() => 2024}
    ${"['2024']"}           | ${() => ["2024"]}
  `(
    "returns null for the non-string $label",
    ({ make }: { make: () => unknown }) => {
      expect(parseFHIR(make() as string)).toBeNull();
    },
  );
});
