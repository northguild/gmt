import { readFhirValue } from "../../internal/fhirDateTime";
import type { FhirDateTime } from "../../types";

/**
 * Reads a FHIR R4 `date`, `dateTime` or `instant` string (R4 Datatypes §2.24.0.1) as it is
 * written, and returns what it states: the input, its precision and its offset.
 *
 * | Precision  | Form                          | Example                         |
 * | ---------- | ----------------------------- | ------------------------------- |
 * | `year`     | `YYYY`                        | `2024`                          |
 * | `month`    | `YYYY-MM`                     | `2024-06`                       |
 * | `day`      | `YYYY-MM-DD`                  | `2024-06-15`                    |
 * | `second`   | `YYYY-MM-DDThh:mm:ss±hh:mm`   | `2015-02-07T13:28:17-05:00`     |
 * | `fraction` | seconds with a decimal part   | `2015-02-07T13:28:17.239+02:00` |
 *
 * - Precision is kept, never padded: `2024-06` is a month, not 1 June.
 * - A time needs seconds and a zone (`Z` or `±hh:mm`, from `-14:00` to `+14:00`). `24:00` is refused.
 * - `Z`, `+00:00` and `-00:00` all read as `offset: "+00:00"`; `value` keeps the input's spelling.
 *   A year, month or day has `offset: ""`.
 * - A month or day that does not exist (`2023-02-29`) is `null`.
 * - A second of `60` is valid only on an inserted leap second (as `isLeapSecond`).
 * - A fraction is at most nine digits.
 * - Disambiguation: none. Every time FHIR carries has an offset, so there is no wall time to resolve.
 *
 * The matching validator is `isValidFHIR`, and the writer is `formatFHIR`.
 *
 * @param value - A FHIR `date`, `dateTime` or `instant` string.
 * @returns The value, its precision and its offset, or `null` when the input is not a FHIR value.
 *
 * @example parseFHIR("2024-06")                    // { value: "2024-06", precision: "month", offset: "" }
 * @example parseFHIR("2015-02-07T13:28:17-05:00")  // { value: "2015-02-07T13:28:17-05:00", precision: "second", offset: "-05:00" }
 * @example parseFHIR("2017-01-01T00:00:00.000Z")   // { value: "2017-01-01T00:00:00.000Z", precision: "fraction", offset: "+00:00" }
 * @example parseFHIR("2024-06-15T10:30:00")        // null (a time needs a zone)
 */
export function parseFHIR(value: string): FhirDateTime | null {
  try {
    return readFhirValue(value);
  } catch {
    // Never throws (Core Rule 3)
    return null;
  }
}
