/**
 * Type aliases for the option and unit shapes GMT names, derived from the `temporal-spec` types
 * that `internal/temporal.ts` re-exports. `temporal-spec` does not export these by name, and
 * each is built from its types rather than written out, so a change to the spec's unions reaches
 * GMT through the compiler.
 */
import type { Temporal } from "./temporal";

/** Any calendar or clock unit, singular: `"year"` through `"nanosecond"`. */
export type DateTimeUnit = Temporal.DateUnit | Temporal.TimeUnit;

/** The plural form of each unit in `T` alone (`"day"` becomes `"days"`), without `T` itself. */
export type PluralUnit<T extends DateTimeUnit> = Exclude<
  Temporal.PluralizeUnit<T>,
  T
>;

/** A unit in `T`, singular or plural. */
export type SmallestUnit<T extends DateTimeUnit> = Temporal.PluralizeUnit<T>;

/** A unit in `T`, singular or plural, or `"auto"`. */
export type LargestUnit<T extends DateTimeUnit> = "auto" | SmallestUnit<T>;

/** A unit in `T`, singular or plural, to total a duration in. */
export type TotalUnit<T extends DateTimeUnit> = SmallestUnit<T>;

/** One of the nine rounding modes of `Temporal`. */
export type RoundingMode = NonNullable<
  Temporal.RoundingOptions<DateTimeUnit>["roundingMode"]
>;

/** The options bag of `until` and `since`, limited to the units in `T`. */
export type DifferenceOptions<T extends DateTimeUnit> =
  Temporal.RoundingOptionsWithLargestUnit<T>;

/**
 * The options-bag form of the argument of `Temporal.Duration#round`. The unit-string form is a
 * separate overload in `temporal-spec`, so a union of the two fits neither.
 */
export type DurationRoundTo = Temporal.DurationRoundingOptions;

/** The precision options of a duration `toString`: digits, smallest unit and rounding mode. */
export type ToStringPrecisionOptions = Temporal.DurationToStringOptions;

/** The options bag of an operation that turns wall-clock fields into an instant. */
export type ToInstantOptions = Temporal.DisambiguationOptions;

/** The options bag of `add` and `subtract`. */
export type ArithmeticOptions = Temporal.OverflowOptions;

/** The options bag of `ZonedDateTime.from` and `with`. */
export type ZonedDateTimeAssignmentOptions = Temporal.ZonedDateTimeFromOptions;

/** The time fields a `set` function takes: any of them, none required. */
export type PlainTimeFields =
  Temporal.PartialTemporalLike<Temporal.TimeLikeObject>;

/** The date fields a `set` function takes, without the era pair: any of them, none required. */
export type PlainDateFields = Omit<
  Temporal.PartialTemporalLike<Temporal.DateLikeObject>,
  "era" | "eraYear"
>;

/** The date and time fields a `set` function takes, without the era pair: any of them, none required. */
export type PlainDateTimeFields = Omit<
  Temporal.PartialTemporalLike<Temporal.DateTimeLikeObject>,
  "era" | "eraYear"
>;

/** The fields a `set` function takes on an instant in a zone, without the offset and era pair: any of them, none required. */
export type ZonedDateTimeFields = Omit<
  Temporal.PartialTemporalLike<Temporal.ZonedDateTimeLikeObject>,
  "offset" | "era" | "eraYear"
>;
