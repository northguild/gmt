import type { Disambiguation } from "./disambiguation";
import type { Interval } from "./interval";
import type { LocalWindow } from "./operating-schedule";

/**
 * One status held over a half-open span of time, `[start, end)`: one line of a duty log.
 *
 * A log is an array of entries ordered by `start` that do not overlap; `isValidDutyLog` checks
 * it. Time no entry covers is in no status: it is neither work nor rest, so an unlogged gap ends
 * a run and never counts as rest.
 */
export type DutyEntry<S extends string = string> = {
  /**
   * The caller's status for the span, such as `"driving"`, `"off"` or `"homeCall"`. GMT reads no
   * meaning into it: each rule names the statuses it counts, and a status no rule names is ignored.
   */
  status: S;
  /** When the status begins, as an ISO 8601 instant string with an offset (`Z` or `±HH:MM`). */
  start: string;
  /**
   * When the status ends, as an ISO 8601 instant string with an offset. It must be after `start`,
   * and the entry does not include it.
   */
  end: string;
};

/**
 * The operator-designated day: a 24-hour period that starts at `dayStartTime` in `timeZone`,
 * wherever the person is. Neither field has a default, and local midnight is never assumed. A
 * day with a clock change inside it is shorter or longer by the change: 23 or 25 hours across a
 * one-hour change.
 */
export type DutyDay = {
  /**
   * The reference time zone the day is read in, an IANA name or UTC offset: a time zone
   * identifier (`+05:30`, `+0530`, `-08`) or a stored offset (`±HH:MM[:SS]`, what
   * `getTimeZoneOffset` returns). A log whose entries cross zones is still read in this one.
   */
  timeZone: string;
  /**
   * The local wall time each day starts at, as an ISO PlainTime string (`"04:00"`) that
   * `isValidTime` accepts.
   */
  dayStartTime: string;
  /**
   * How a day start the clock repeats or skips becomes an instant, as `resolveLocal` resolves it.
   * `"compatible"` reads a skipped time after the gap and a repeated one at its first pass,
   * `"earlier"` and `"later"` take that side in both cases, and `"reject"` returns the sentinel
   * for a day that starts or ends at such a time.
   *
   * @defaultValue `"compatible"`, Temporal's default.
   */
  disambiguation?: Disambiguation;
};

/** An exact length of time, every sliding window of it ending at the instant evaluated. */
export type ElapsedPeriod = {
  /**
   * The window's length, as an ISO 8601 duration of exact time: hours, minutes, seconds and
   * days of 24 hours (`"PT24H"`, `"PT672H"`, `"P7D"`). Years, months and weeks are refused.
   * Clock changes do not lengthen or shorten it.
   */
  elapsed: string;
};

/** A count of operator-designated days, the last of them the day the instant falls in. */
export type OperatorDaysPeriod = {
  /**
   * How many operator days, an integer from 1 to 10,000. The days come from `dayStartTime` in
   * the reference zone, so the call needs `dayStartTime`.
   */
  operatorDays: number;
};

/** A count of local calendar days in the reference zone, the last the day the instant falls in. */
export type CalendarDaysPeriod = {
  /**
   * How many local calendar days, an integer from 1 to 10,000. A day across a one-hour clock
   * change is 23 or 25 hours long, so 28 days across one are 671 or 673 hours.
   */
  calendarDays: number;
};

/** A count of ISO weeks (Monday to Sunday) in the reference zone, the last the current one. */
export type IsoWeeksPeriod = {
  /** How many ISO weeks, an integer from 1 to 10,000. Each starts at local midnight on Monday. */
  isoWeeks: number;
};

/** A count of local calendar months in the reference zone, the last the current one. */
export type CalendarMonthsPeriod = {
  /**
   * How many calendar months, an integer from 1 to 10,000. Each starts at local midnight on the
   * 1st.
   */
  calendarMonths: number;
};

/** A count of local calendar years in the reference zone, the last the current one. */
export type CalendarYearsPeriod = {
  /**
   * How many calendar years, an integer from 1 to 10,000. Each starts at local midnight on
   * 1 January.
   */
  calendarYears: number;
};

/**
 * The span a rule looks back over: an exact elapsed duration, or a count of local periods in
 * the reference zone. Give exactly one key.
 *
 * - `elapsed` is sliding: every window of that length, the one evaluated ending at the instant.
 * - The counts are whole local periods ending with the one the instant falls in, so their window
 *   runs to the end of the current period. A count of `operatorDays` reads `dayStartTime`.
 * - A count is 10,000 at most, and so is a count times the rule's `adjacent`, `lookback` or
 *   `periods`: `{ isoWeeks: 2 }` with `adjacent: 5001` names 10,002 weeks, and is refused.
 */
export type Period =
  | ElapsedPeriod
  | OperatorDaysPeriod
  | CalendarDaysPeriod
  | IsoWeeksPeriod
  | CalendarMonthsPeriod
  | CalendarYearsPeriod;

/** A count of local periods in the reference zone: a `Period` that is not an elapsed duration. */
export type LocalPeriod = Exclude<Period, ElapsedPeriod>;

/**
 * A rest that resets a counter: a run of at least `consecutive` in any of `statuses`. The
 * counter starts again where the run ends.
 */
export type Reset<S extends string = string> = {
  /** The statuses the run is made of. Touching entries in any of them form one run. */
  statuses: S[];
  /** How long the run must be, as a positive ISO 8601 duration of exact time (`"PT10H"`). */
  consecutive: string;
};

/**
 * A paired rest: two separate rest periods that together count as one, when all three floors
 * hold. `{ eachAtLeast: "PT2H", oneAtLeast: "PT7H", combinedAtLeast: "PT10H" }` accepts 7.5 + 2.5
 * hours and 8 + 2, and refuses 6 + 4.
 */
export type PairSpec = {
  /** The floor on each of the two periods, a positive ISO 8601 duration of exact time. */
  eachAtLeast: string;
  /** The floor on the longer period, a positive ISO 8601 duration of exact time. */
  oneAtLeast: string;
  /** The floor on the two periods added together, a positive ISO 8601 duration of exact time. */
  combinedAtLeast: string;
};

/** Whether a failed rule is a violation (a "must") or an advisory (a "should"). */
export type DutySeverity = "violation" | "advisory";

/**
 * A cap on time in `statuses` since the last reset: "11 hours driving since 10 hours off".
 *
 * - `used` is the time in `statuses` since the end of the last `since` run (or since the log's
 *   first entry when there is none); the rule holds while `used` is at most `cap`.
 * - `window` runs from that start to the instant evaluated; `resetAt` is the reset's end.
 */
export type CumulativeCapRule<S extends string = string> = {
  /** The caller's name for the rule. The report is keyed by it; labels must be unique. */
  label: string;
  /**
   * Whether a failure is a violation or an advisory.
   *
   * @defaultValue `"violation"`.
   */
  severity?: DutySeverity;
  /** Selects this rule kind. */
  kind: "cumulativeCap";
  /** The statuses whose time is capped. */
  statuses: S[];
  /** The most time allowed, a positive ISO 8601 duration of exact time. */
  cap: string;
  /** The rest that starts the count again. */
  since: Reset<S>;
};

/**
 * A window that opens when work starts after a reset and closes `length` later, whatever rest
 * falls inside it: "no driving more than 14 hours after work began".
 *
 * - The window opens at the first entry in `startStatuses` after the last `since` run, and the
 *   rule fails once time in `restrictedStatuses` falls at or after its close. `dueBy` is the close.
 * - With `exclude`, two consecutive runs of `since.statuses` that satisfy the `PairSpec` (each
 *   shorter than `since.consecutive`) move the window: it is counted again from the end of the
 *   first, and its time stops while the second lasts, so the close moves by the second's whole
 *   length. A second run that starts after the close moves nothing: the window had closed. A run
 *   shorter than `eachAtLeast` between the two is neither half of the pair nor a break in it.
 * - With `extension`, a window open at the instant `from` closes `by` later. Any other window is
 *   unchanged.
 */
export type ElapsedWindowRule<S extends string = string> = {
  /** The caller's name for the rule. The report is keyed by it; labels must be unique. */
  label: string;
  /**
   * Whether a failure is a violation or an advisory.
   *
   * @defaultValue `"violation"`.
   */
  severity?: DutySeverity;
  /** Selects this rule kind. */
  kind: "elapsedWindow";
  /** The statuses whose first entry after the reset opens the window. */
  startStatuses: S[];
  /** How long the window stays open, a positive ISO 8601 duration of exact time. */
  length: string;
  /** The statuses not allowed once the window has closed. */
  restrictedStatuses: S[];
  /** The rest that closes one window, so that the next work opens a new one. */
  since: Reset<S>;
  /**
   * A paired rest that does not count against the window.
   *
   * @defaultValue None. Rest inside the window never moves it.
   */
  exclude?: PairSpec;
  /**
   * A caller-declared extension: the window open at `from` closes `by` later.
   *
   * @defaultValue None. No window is extended.
   */
  extension?: {
    /** How much later the window closes, a positive ISO 8601 duration of exact time. */
    by: string;
    /** The instant the extension is declared at, an ISO 8601 instant string. */
    from: string;
  };
};

/**
 * A required break after a stretch of counted time: "30 minutes after 8 hours driving".
 *
 * - `used` is the time in `countedStatuses` since the last qualifying interruption, and the rule
 *   holds while it is at most `after`.
 * - An interruption is a run of logged time outside `countedStatuses` (and inside
 *   `outsideStatuses` when given) of at least `minimum`, or the runs of `orderedSplit` taken in
 *   that order. `resetAt` is where the last one ended.
 */
export type RequiredInterruptionRule<S extends string = string> = {
  /** The caller's name for the rule. The report is keyed by it; labels must be unique. */
  label: string;
  /**
   * Whether a failure is a violation or an advisory.
   *
   * @defaultValue `"violation"`.
   */
  severity?: DutySeverity;
  /** Selects this rule kind. */
  kind: "requiredInterruption";
  /** The statuses that count towards the stretch. */
  countedStatuses: S[];
  /** The most counted time allowed without an interruption, a positive ISO 8601 duration. */
  after: string;
  /** What counts as an interruption. */
  interruption: {
    /** The shortest single run that interrupts, a positive ISO 8601 duration of exact time. */
    minimum: string;
    /**
     * The statuses an interruption may be made of.
     *
     * @defaultValue None. Any logged status outside `countedStatuses` interrupts.
     */
    outsideStatuses?: S[];
    /**
     * Shorter runs that together interrupt when taken in this order: `["PT15M", "PT30M"]` is a
     * run of at least 15 minutes followed later by one of at least 30, and not the reverse.
     *
     * @defaultValue None. Only a run of `minimum` interrupts.
     */
    orderedSplit?: string[];
  };
};

/**
 * A cap on time in `statuses` inside a window: "60 hours in 7 operator days", "100 hours in
 * 672 hours".
 *
 * - The window is `window` ending at the instant evaluated, starting no earlier than the end of
 *   the last `reset` run.
 * - With `precondition`, the cap applies only once the window holds a run of `minimum` in
 *   `restStatuses`. Before that run, the limit is `beforeHours`.
 */
export type RollingCapRule<S extends string = string> = {
  /** The caller's name for the rule. The report is keyed by it; labels must be unique. */
  label: string;
  /**
   * Whether a failure is a violation or an advisory.
   *
   * @defaultValue `"violation"`.
   */
  severity?: DutySeverity;
  /** Selects this rule kind. */
  kind: "rollingCap";
  /** The statuses whose time is capped. */
  statuses: S[];
  /** The most time allowed in the window, a positive ISO 8601 duration of exact time. */
  cap: string;
  /** The span the cap is counted over. */
  window: Period;
  /**
   * A rest that starts the count again, as a long rest that restarts a cycle does.
   *
   * @defaultValue None. Only the window limits the count.
   */
  reset?: Reset<S>;
  /**
   * A rest the window must hold before its time passes `beforeHours`.
   *
   * @defaultValue None. The cap applies from the start of the window.
   */
  precondition?: {
    /** The statuses the rest is made of. */
    restStatuses: S[];
    /** How long the rest must be, a positive ISO 8601 duration of exact time. */
    minimum: string;
    /** The most time allowed before that rest, a positive ISO 8601 duration of exact time. */
    beforeHours: string;
  };
};

/**
 * A cap on time in `statuses` over whole local periods: "56 hours in an ISO week", "90 hours in
 * two adjacent weeks", "80 hours a week averaged over four".
 *
 * - The window is the `adjacent` periods ending with the one the instant falls in. A shift that
 *   crosses a period boundary is cut there, and each part counts in its own period.
 * - With `average`, `used` is the mean over the `adjacent` periods, rounded up to the nanosecond,
 *   and `remaining` is the time left before the mean passes `cap`.
 */
export type FixedPeriodCapRule<S extends string = string> = {
  /** The caller's name for the rule. The report is keyed by it; labels must be unique. */
  label: string;
  /**
   * Whether a failure is a violation or an advisory.
   *
   * @defaultValue `"violation"`.
   */
  severity?: DutySeverity;
  /** Selects this rule kind. */
  kind: "fixedPeriodCap";
  /** The statuses whose time is capped. */
  statuses: S[];
  /** The most time allowed, per period with `average`, a positive ISO 8601 duration. */
  cap: string;
  /** The period, a count of local periods. */
  period: LocalPeriod;
  /**
   * How many adjacent periods the cap covers, an integer from 1 to 10,000. Times the period's
   * count, it is 10,000 at most.
   *
   * @defaultValue `1`.
   */
  adjacent?: number;
  /**
   * Whether `cap` limits the mean over the `adjacent` periods instead of their total.
   *
   * @defaultValue `false`.
   */
  average?: boolean;
};

/**
 * A minimum of rest inside every window: "10 hours of rest in every 24, in at most two periods,
 * one at least 6 hours long".
 *
 * - Rest is time in `restStatuses` inside the window; only the part of a run inside it counts.
 * - `composition` limits the periods the rest is counted from; `composite` asks for a long run
 *   plus shorter blocks; `maxGap` caps the time between the end of one run and the start of the
 *   next. The log's first entry starts such a stretch as the end of a rest would, so the work
 *   logged before the first rest is held to `maxGap` too.
 * - A window that runs past the instant evaluated has not failed while it could still be met with
 *   rest from that instant to its end.
 */
export type RestRequirementRule<S extends string = string> = {
  /** The caller's name for the rule. The report is keyed by it; labels must be unique. */
  label: string;
  /**
   * Whether a failure is a violation or an advisory.
   *
   * @defaultValue `"violation"`.
   */
  severity?: DutySeverity;
  /** Selects this rule kind. */
  kind: "restRequirement";
  /** The statuses that are rest. */
  restStatuses: S[];
  /** The window the rest is counted in. */
  per: Period;
  /** The least rest required in the window, a positive ISO 8601 duration of exact time. */
  minimum: string;
  /**
   * How the rest may be divided: it is counted from the `maxPeriods` longest runs, the longest at
   * least `longestAtLeast` and each other at least `othersAtLeast`.
   *
   * @defaultValue None. Every run of rest counts.
   */
  composition?: {
    /** The most runs the rest may come from, a positive integer. */
    maxPeriods: number;
    /** The floor on the longest run, a positive ISO 8601 duration of exact time. */
    longestAtLeast: string;
    /**
     * The floor on every other run counted, a positive ISO 8601 duration of exact time.
     *
     * @defaultValue None. The other runs count at any length.
     */
    othersAtLeast?: string;
  };
  /**
   * A consecutive run plus additional rest in blocks: rest is the longest run, at least
   * `consecutive`, plus the other runs of at least `blockMinimum`, which must add up to
   * `additional`.
   *
   * @defaultValue None. Rest is counted without the split.
   */
  composite?: {
    /** The floor on the longest run, a positive ISO 8601 duration of exact time. */
    consecutive: string;
    /** The rest required beyond the longest run, a positive ISO 8601 duration of exact time. */
    additional: string;
    /** The shortest block that counts, a positive ISO 8601 duration of exact time. */
    blockMinimum: string;
  };
  /**
   * The most time allowed from the end of one run of rest, or from the log's first entry, to the
   * start of the next run of rest, a positive ISO 8601 duration of exact time.
   *
   * @defaultValue None. The time between rests is not limited.
   */
  maxGap?: string;
};

/**
 * A free period of at least `minimum` consecutive rest inside every window: "30 consecutive
 * hours off in every 168", "36 hours off containing two local nights", "one day in seven free,
 * averaged over four weeks".
 *
 * - `used` is how many separate free periods the window holds; only the part of a run inside the
 *   window counts. A run twice `minimum` long holds two.
 * - With `containing`, each free period must also contain `count` whole local windows.
 * - `dueBy` is the instant the next free period must be complete by, if no more rest is taken.
 * - A window that runs past the instant evaluated has not failed while it could still be met with
 *   rest from that instant to its end.
 */
export type FreePeriodRule<S extends string = string> = {
  /** The caller's name for the rule. The report is keyed by it; labels must be unique. */
  label: string;
  /**
   * Whether a failure is a violation or an advisory.
   *
   * @defaultValue `"violation"`.
   */
  severity?: DutySeverity;
  /** Selects this rule kind. */
  kind: "freePeriod";
  /** The statuses that are free time. */
  restStatuses: S[];
  /** The shortest free period, a positive ISO 8601 duration of exact time. */
  minimum: string;
  /** The window the free periods are counted in. */
  within: Period;
  /**
   * Local windows each free period must contain, such as nights from 22:00 to 08:00, read in the
   * reference zone. Their edges resolve under the call's `disambiguation`.
   *
   * @defaultValue None. Any run of `minimum` is a free period.
   */
  containing?: {
    /** The local window, as operating hours take it. */
    window: LocalWindow;
    /** How many whole windows each free period must contain, an integer from 1 to 10,000. */
    count: number;
  };
  /**
   * How many free periods the window must hold, a non-negative integer.
   *
   * @defaultValue `1`.
   */
  atLeast?: number;
};

/**
 * A rest required before each duty: "10 hours off in the 24 before a duty", "rest before duty
 * at least as long as the duty before it, and never under 12 hours".
 *
 * - A duty starts where logged time outside `restStatuses` begins. A stint after any rest is a
 *   new duty start, measured from where it starts: log a break inside a duty in a status outside
 *   `restStatuses`.
 * - Without `orFactor`, the rest before a duty is the longest run of rest inside `within` before
 *   it, so a short break between two stints does not stand in for the rest before them, and it
 *   must be at least `minimum`.
 * - With `orFactor`, the rest is the run that ends where the duty starts, measured whole, and it
 *   must be at least `minimum`, `floor` and `k` × the duty it ends. That duty runs from the end of
 *   the last rest of at least `minimum` before it to where the rest starts, breaks included. A
 *   duty that starts with no rest right before it has none. Logging more of the time before a
 *   duty as rest never fails it, unless a whole duty becomes rest: the two rests around it are
 *   then one, which ends the duty before.
 * - Evaluated during rest, the rule holds and `remaining` is the rest still needed before a duty
 *   may start.
 */
export type RestBeforeDutyRule<S extends string = string> = {
  /** The caller's name for the rule. The report is keyed by it; labels must be unique. */
  label: string;
  /**
   * Whether a failure is a violation or an advisory.
   *
   * @defaultValue `"violation"`.
   */
  severity?: DutySeverity;
  /** Selects this rule kind. */
  kind: "restBeforeDuty";
  /** The statuses that are rest. */
  restStatuses: S[];
  /** The least rest required, a positive ISO 8601 duration of exact time. */
  minimum: string;
  /**
   * How far before a duty the rest is looked for, a positive ISO 8601 duration of exact time.
   * With `orFactor` the rest is the one right before the duty, which `within` does not cut.
   */
  within: string;
  /**
   * A requirement that grows with the previous duty: the larger of `k` × its length and `floor`.
   *
   * @defaultValue None. The requirement is `minimum`.
   */
  orFactor?: {
    /**
     * The multiple of the previous duty's length, a positive finite number. It is read as the
     * shortest decimal `String(k)` prints, exactly: `1.1` is eleven tenths, and `0.1 + 0.2` is
     * 0.30000000000000004. The product is rounded up to the nanosecond.
     */
    k: number;
    /** The least the requirement can be, a positive ISO 8601 duration of exact time. */
    floor: string;
  };
};

/**
 * A cap on how often a short rest is taken: "at most 3 reduced rests between two full rests".
 *
 * - An event is a run in `event.statuses` at least `event.minimum` and shorter than
 *   `event.maximum`, counted in the period it starts in. A run the log carries on past the
 *   instant evaluated may still grow past `maximum`, so it is not counted until it ends.
 * - `used` counts the events since the last `reset` run, or inside the `every` window.
 */
export type QuotaRule<S extends string = string> = {
  /** The caller's name for the rule. The report is keyed by it; labels must be unique. */
  label: string;
  /**
   * Whether a failure is a violation or an advisory.
   *
   * @defaultValue `"violation"`.
   */
  severity?: DutySeverity;
  /** Selects this rule kind. */
  kind: "quota";
  /** The run that counts once. */
  event: {
    /** The statuses the run is made of. */
    statuses: S[];
    /** The shortest run that counts, a positive ISO 8601 duration of exact time. */
    minimum: string;
    /** The length a run must stay under to count, a positive ISO 8601 duration of exact time. */
    maximum: string;
  };
  /** The most events allowed, a non-negative integer. */
  count: number;
  /** What starts the count again: a full rest, or a window. */
  reset:
    | Reset<S>
    | {
        /** The window the events are counted in. */
        every: Period;
      };
};

/**
 * A rest that must start within a number of periods of the last one: "a weekly rest by the end
 * of six operator days after the previous one".
 *
 * - The clock starts at the end of the last run in `event.statuses` of at least `event.minimum`,
 *   or of a `reset` run when that is later. `dueBy` is the end of the `periods`-th `period`, the
 *   period the clock starts in counting as the first.
 * - The rule holds until `dueBy`, and after it while a run in `event.statuses` that began by
 *   `dueBy` is still going.
 */
export type DueByRule<S extends string = string> = {
  /** The caller's name for the rule. The report is keyed by it; labels must be unique. */
  label: string;
  /**
   * Whether a failure is a violation or an advisory.
   *
   * @defaultValue `"violation"`.
   */
  severity?: DutySeverity;
  /** Selects this rule kind. */
  kind: "dueBy";
  /** The rest that is due. */
  event: {
    /** The statuses the rest is made of. */
    statuses: S[];
    /** How long the rest must be, a positive ISO 8601 duration of exact time. */
    minimum: string;
  };
  /** How soon the rest is due. */
  within: {
    /**
     * How many periods, an integer from 1 to 10,000. Times a count `period`, it is 10,000 at
     * most.
     */
    periods: number;
    /** The period counted: an `elapsed` length, or one local period (`{ operatorDays: 1 }`). */
    period: Period;
  };
  /**
   * Another rest that also starts the clock.
   *
   * @defaultValue None. Only the event starts the clock.
   */
  reset?: Reset<S>;
};

/**
 * A count of rests by class inside a window: "at least 4 weekly rests in any 4 weeks, at least
 * 2 of them regular".
 *
 * - The window is `lookback` periods of `period` ending with the instant's.
 * - A run in a class's `statuses` of at least its `minimum` counts once in that class, in the
 *   window it starts in. A run can count in several classes.
 * - `used` and `limit` are the tightest requirement's count and floor, the first on a tie.
 * - A window that runs past the instant evaluated has not failed while enough runs could still
 *   start before it ends, each a class's `minimum` long before the next.
 */
export type PatternRule<S extends string = string> = {
  /** The caller's name for the rule. The report is keyed by it; labels must be unique. */
  label: string;
  /**
   * Whether a failure is a violation or an advisory.
   *
   * @defaultValue `"violation"`.
   */
  severity?: DutySeverity;
  /** Selects this rule kind. */
  kind: "pattern";
  /** The unit the window is counted in. */
  period: Period;
  /**
   * How many periods the window covers, an integer from 1 to 10,000. Times a count `period`, it is
   * 10,000 at most.
   */
  lookback: number;
  /** The classes of rest, each named for `require`. */
  classes: {
    /** The class's name, unique within the rule. */
    label: string;
    /** The statuses a run of this class is made of. */
    statuses: S[];
    /** The shortest run of this class, a positive ISO 8601 duration of exact time. */
    minimum: string;
  }[];
  /** The count each class needs. */
  require: {
    /** The class, one of the labels in `classes`. */
    label: string;
    /** The fewest runs of that class the window must hold, a non-negative integer. */
    atLeast: number;
  }[];
};

/**
 * A cap on how many local periods hold a status: "night duty no more often than every third
 * night", "duty started on at most 6 of any 7 days".
 *
 * - The window is `lookback` periods of `per` ending with the instant's, and `used` is how many
 *   of them hold time in `statuses`, or with `byInitiationDate` how many a run starts in.
 */
export type OccurrenceCapRule<S extends string = string> = {
  /** The caller's name for the rule. The report is keyed by it; labels must be unique. */
  label: string;
  /**
   * Whether a failure is a violation or an advisory.
   *
   * @defaultValue `"violation"`.
   */
  severity?: DutySeverity;
  /** Selects this rule kind. */
  kind: "occurrenceCap";
  /** The statuses that occur. */
  statuses: S[];
  /** The local period occurrences are counted by. */
  per: LocalPeriod;
  /**
   * How many periods the window covers, an integer from 1 to 10,000. Times the count in `per`, it
   * is 10,000 at most.
   */
  lookback: number;
  /** The most periods allowed to hold an occurrence, a non-negative integer. */
  maximum: number;
  /**
   * Whether a run counts only in the period it starts in, so that two tours starting on one date
   * count once and a night shift counts on the date it began.
   *
   * @defaultValue `false`. A run counts in every period it touches.
   */
  byInitiationDate?: boolean;
};

/**
 * An allowance used at most once inside a window, restored by a rest: "not used within the
 * previous 7 days unless 34 hours off came between".
 *
 * - `uses` are the instants the caller used it. `used` counts the uses at or before the instant
 *   evaluated, inside `notWithin`, after the last `reset` run; the rule holds while that is at
 *   most 1, and `remaining` is 1 when the allowance is free to use.
 * - Each window holds a use once. An `elapsed` window holds the uses after its start, up to and
 *   including the instant evaluated, so a use exactly its length before is outside it. A window
 *   of local periods holds only its own uses, so one exactly on its end is the next window's.
 */
export type UsageLookbackRule<S extends string = string> = {
  /** The caller's name for the rule. The report is keyed by it; labels must be unique. */
  label: string;
  /**
   * Whether a failure is a violation or an advisory.
   *
   * @defaultValue `"violation"`.
   */
  severity?: DutySeverity;
  /** Selects this rule kind. */
  kind: "usageLookback";
  /** The instants the allowance was used, as ISO 8601 instant strings. */
  uses: string[];
  /** The window no second use may fall in. */
  notWithin: Period;
  /** The rest that restores the allowance. */
  reset: Reset<S>;
};

/**
 * One hours-of-work rule over a duty log, every number the caller's. A regime is an array of
 * rules the caller assembles and labels; nested caps are separate rules, reported separately.
 */
export type DutyRule<S extends string = string> =
  | CumulativeCapRule<S>
  | ElapsedWindowRule<S>
  | RequiredInterruptionRule<S>
  | RollingCapRule<S>
  | FixedPeriodCapRule<S>
  | RestRequirementRule<S>
  | FreePeriodRule<S>
  | RestBeforeDutyRule<S>
  | QuotaRule<S>
  | DueByRule<S>
  | PatternRule<S>
  | OccurrenceCapRule<S>
  | UsageLookbackRule<S>;

/** Which arithmetic a window used: exact elapsed time, operator days, or local calendar periods. */
export type PeriodBasis = "elapsed" | "operatorDay" | "calendar";

/**
 * One rule evaluated at one instant, reported whether or not it binds. Durations are ISO 8601
 * with hours as the largest unit; counts are numbers.
 */
export type RuleOutcome = {
  /** The rule's label. */
  label: string;
  /** The rule's kind. */
  kind: DutyRule["kind"];
  /** The rule's severity, `"violation"` when the rule gave none. */
  severity: DutySeverity;
  /** Whether the rule holds at the instant evaluated. */
  satisfied: boolean;
  /** How much the rule has used, or found: a duration or a count; null when nothing is measured. */
  used: string | number | null;
  /** The figure `used` is held to: a cap, a minimum or a count. */
  limit: string | number | null;
  /**
   * What is left before a cap binds, or still needed to meet a minimum; never negative.
   */
  remaining: string | number | null;
  /**
   * The span the rule measured, as UTC instants. A window of local periods runs to the end of
   * the current period, past the instant evaluated. Null when the rule has not started: an
   * `elapsedWindow` with no work since its reset.
   */
  window: Interval | null;
  /** How `window` was counted; null when the rule has no window of its own. */
  periodBasis: PeriodBasis | null;
  /** The instant something is due by: a window's close, a rest's deadline; null when none. */
  dueBy: string | null;
  /** Where the last reset ended, as a UTC instant; null when the rule has none or none occurred. */
  resetAt: string | null;
};

/** Every rule of a regime evaluated at one instant. */
export type DutyReport = {
  /** The instant evaluated, as a UTC instant. */
  at: string;
  /** One outcome per rule, in the order the rules were given. */
  outcomes: RuleOutcome[];
  /** The outcomes of failed rules whose severity is `"violation"`. */
  violations: RuleOutcome[];
  /** The outcomes of failed rules whose severity is `"advisory"`. */
  advisories: RuleOutcome[];
};

/** One failed window in a range, for the record. */
export type DutyViolation = {
  /** The label of the rule that failed. */
  label: string;
  /** The window that failed it, as UTC instants. */
  window: Interval;
  /** What the rule found in that window: a duration or a count. */
  used: string | number;
  /** The figure it was held to. */
  limit: string | number;
};

/** Two rest periods that satisfy a `PairSpec`, in the order they were taken. */
export type RestPair = {
  /** The earlier period, as UTC instants. */
  first: Interval;
  /** The later period, as UTC instants. */
  second: Interval;
};
