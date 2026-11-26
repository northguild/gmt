/** The three FHIR R4 primitive types that carry a date (R4 Datatypes §2.24.0.1). */
export type FhirDateType = "date" | "dateTime" | "instant";

/**
 * How much of a FHIR value is written, coarsest first. FHIR has no hour or minute precision: a
 * time always carries seconds.
 */
export type FhirPrecision = "year" | "month" | "day" | "second" | "fraction";

/**
 * A FHIR `date`, `dateTime` or `instant` value, read as sent.
 *
 * Returned by `parseFHIR`.
 */
export interface FhirDateTime {
  /** The input, unchanged: nothing is padded and the offset is spelled as sent. */
  value: string;
  /** The finest field the value writes. */
  precision: FhirPrecision;
  /** `±HH:MM` (`Z` and `-00:00` read as `+00:00`), or `""` for a year, month or day. */
  offset: string;
}

/** Options for `formatFHIR`. */
export interface FhirFormatOptions {
  /**
   * The precision to write, no finer than the input's.
   * @defaultValue the input's precision, or `"day"` under `date` for an input finer than a day
   */
  precision?: FhirPrecision;
}
