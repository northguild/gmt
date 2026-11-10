/**
 * The precision of an HL7 v2 date-time, coarsest first. HL7 v2.5.1 ch. 2A 2.A.22 (headed
 * 2.A.1.22 in the [hl7.eu v2.5.1 copy](https://www.hl7.eu/HL7v2x/v251/std251/ch02a.html)):
 * "The number of characters populated (excluding the time zone specification) specifies the
 * precision". The characters before the offset, per member:
 *
 * - `"year"`: 4 (`YYYY`)
 * - `"month"`: 6 (`YYYYMM`)
 * - `"day"`: 8 (`YYYYMMDD`)
 * - `"hour"`: 10 (`YYYYMMDDHH`)
 * - `"minute"`: 12 (`YYYYMMDDHHMM`)
 * - `"second"`: 14 (`YYYYMMDDHHMMSS`)
 * - `"fraction"`: 16 to 19, a decimal point and one to four digits after the seconds
 *
 * The six coarser members are the degrees of precision of Table 0529 (`Y`, `L`, `D`, `H`, `M`,
 * `S`). `"fraction"` has no Table 0529 letter.
 *
 * Returned in `Hl7DateTime` by `parseHL7`; taken by `formatHL7` through `Hl7FormatOptions`.
 */
export type Hl7Precision =
  | "year"
  | "month"
  | "day"
  | "hour"
  | "minute"
  | "second"
  | "fraction";

/**
 * An HL7 v2 date-time (`DTM`, 2.A.22; or `TS`, 2.A.77) read as what it states. What the sender
 * did not send is not invented: a value with no offset has no instant, and a year or a day has
 * no moment.
 *
 * Returned by `parseHL7`.
 */
export type Hl7DateTime =
  | {
      /** An offset and a precision of a minute or finer: a moment in time. */
      kind: "instant";
      /**
       * UTC, ISO 8601 ending in `Z`, as `toOffsetInstant` writes it (a sent fraction of `.1000`
       * is `.1Z`; `local` keeps `.1000`).
       */
      instant: string;
      /** `±HH:MM`, as sent; `+0000` and `-0000` both read `+00:00`. */
      offset: string;
      /**
       * The wall clock as sent, ISO 8601 extended, at the precision sent; seconds always written
       * (`2024-06-15T10:30:00`, `2024-06-15T10:30:00.1234`).
       */
      local: string;
      /** The digits sent, or the `TS` degree of precision when it lowers them. */
      precision: Hl7Precision;
    }
  | {
      /** No offset and a precision of a minute or finer: the sender's local time. */
      kind: "local";
      /**
       * The wall clock as sent, ISO 8601 extended, at the precision sent; seconds always written
       * (`2024-06-15T10:30:00`, `2024-06-15T10:30:00.1234`). Ready for `resolveLocal` once you
       * supply the sender's zone; HL7 2.A.22: "if the time zone is not included, the time zone
       * defaults to that of the local time zone of the sender".
       */
      local: string;
      /** The digits sent, or the `TS` degree of precision when it lowers them. */
      precision: Hl7Precision;
    }
  | {
      /**
       * Year, month, day or hour precision, with or without an offset: no single moment, so no
       * instant.
       */
      kind: "partial";
      /**
       * The wall clock as sent, ISO 8601 extended, at the precision sent: `2024`, `2024-06`,
       * `2024-06-15`, `2024-06-15T10`.
       */
      local: string;
      /**
       * `±HH:MM`, as sent; `+0000` and `-0000` both read `+00:00`; or `""` when the value
       * carried none.
       */
      offset: string;
      /** The digits sent, or the `TS` degree of precision when it lowers them. */
      precision: Hl7Precision;
    }
  | {
      /**
       * The HL7 null value `""` (two double quote marks), ch. 2 §2.5.3: "is different from
       * omitting an optional data field". The old value "should be changed to null".
       */
      kind: "null";
    };

/**
 * Options for `formatHL7`.
 *
 * Taken by `formatHL7`.
 */
export interface Hl7FormatOptions {
  /**
   * Lowers the precision written; never raises it. The precision is read from the form the input
   * is written in, and a value lower than that cuts the digits (never rounds).
   *
   * @defaultValue the precision of the input
   */
  precision?: Hl7Precision;
}
