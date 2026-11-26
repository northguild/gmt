import type { FhirPrecision } from "./fhir";
import type { Hl7Precision } from "./hl7";

// Type-level: `formatFHIR` ranks a FHIR precision with `hl7PrecisionRank`, so every member of
// `FhirPrecision` must be a member of `Hl7Precision`. `tsc` checks the assertion; the row only
// gives the file a test to run.
describe("types/fhir", () => {
  it("FhirPrecision extends Hl7Precision", () => {
    expectTypeOf<FhirPrecision>().toExtend<Hl7Precision>();
    expectTypeOf<FhirPrecision>().toEqualTypeOf<
      "year" | "month" | "day" | "second" | "fraction"
    >();
  });
});
