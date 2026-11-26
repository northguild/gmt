/**
 * The real gmt functions and patterns the FHIR Date Checker's unit tests inject as a `FhirLib`,
 * loaded by module path so a test never needs the loader's dynamic imports. Cast as `FhirLib`
 * through `unknown`, as `test/hl7-lib.ts` does, because `toOffsetInstant`'s result is wider than
 * the Checker states; `fhir-lib.test.ts` checks the two against each other.
 */
import { formatFHIR } from "@northguild/gmt/healthcare/format";
import { parseFHIR } from "@northguild/gmt/healthcare/parse";
import { isValidFHIR } from "@northguild/gmt/healthcare/validate";
import { toOffsetInstant } from "@northguild/gmt/instant/convert";
import { fhirDate, fhirDateTime, fhirInstant } from "@northguild/gmt/regex";
import { isLeapSecond } from "@northguild/gmt/timescale/validate";
import type { FhirLib } from "~/lib/fhir-lib";

export const fhirLib = {
  parseFHIR,
  isValidFHIR,
  formatFHIR,
  toOffsetInstant,
  isLeapSecond,
  fhirDate,
  fhirDateTime,
  fhirInstant,
} as unknown as FhirLib;
