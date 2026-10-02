/**
 * What a transport timestamp claims to be, in DCSA's `eventClassifierCode` vocabulary:
 *
 * - `PLN`: planned, the schedule.
 * - `EST`: estimated, a prediction that may be revised.
 * - `REQ`: requested, the time one party asked another for.
 * - `ACT`: actual, an observation of what happened.
 *
 * One field can hold all four. A value is only comparable with another once its class is known:
 * an estimate compared with an actual as though both were observations is the standard
 * visibility-dashboard error.
 */
export type TimestampClass = "PLN" | "EST" | "REQ" | "ACT";

/**
 * One recorded timestamp of an event: what it claims, when it claims it, and when that claim was
 * recorded.
 */
export type TimestampEvent = {
  /** What the timestamp claims to be: planned, estimated, requested or actual. */
  classifier: TimestampClass;
  /**
   * The moment the timestamp names, as an ISO 8601 instant (`Z` or an offset) or zoned string.
   * Functions that return it echo it exactly as written.
   */
  at: string;
  /**
   * When the timestamp was recorded or received, as an ISO 8601 instant or zoned string. It
   * orders revisions of the same class: the latest recorded is the current one.
   */
  recordedAt: string;
};

/**
 * The caller's punctuality tolerance, as ISO 8601 durations of exact time (a day is 24 hours;
 * years, months and weeks are refused; neither may be negative).
 *
 * GMT holds no default: "on time" without a stated tolerance is not a measurement. A 15-minute
 * tolerance is `{ late: "PT15M" }`; a day-based one is `{ late: "P1D", early: "P1D" }`.
 */
export type PunctualityTolerance = {
  /**
   * How far after the plan an arrival may be before it is late: a deviation of this much or more
   * is late. `"PT0S"` makes every arrival at or after the plan late.
   */
  late: string;
  /**
   * How far before the plan an arrival may be before it is early: a deviation of this much or
   * more ahead of the plan is early.
   *
   * @defaultValue None. An early arrival is on time.
   */
  early?: string;
};

/** An arrival's punctuality against a `PunctualityTolerance`. */
export type Punctuality = "early" | "onTime" | "late";
