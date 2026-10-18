import { Temporal } from "./temporal";
import { isValidTime } from "../plain/validate/isValidTime";
import type { DutySeverity } from "../types";
import type { CalendarUnit } from "./dutyPeriods";
import { exactDurationNanoseconds } from "./exactDuration";
import { parseInstantNanoseconds } from "./instantNanoseconds";
import { isObject } from "./isObject";

/**
 * The most local periods one count may name: 10,000, the bound `bucketRange` puts on a walk.
 * 10,000 days is 27 years; a larger count is refused rather than walked.
 */
export const MAX_PERIOD_COUNT = 10_000;

/** A status list read once, as the set a run is tested against. */
export type StatusSet = ReadonlySet<string>;

/** A `Period`, resolved. */
export type ResolvedPeriod =
  | { kind: "elapsed"; length: bigint }
  | { kind: "units"; unit: "operatorDay" | CalendarUnit; count: number };

/** A `Reset`, resolved. */
export type ResolvedReset = { statuses: StatusSet; consecutive: bigint };

/** A `PairSpec`, resolved. */
export type ResolvedPair = { each: bigint; one: bigint; combined: bigint };

/** A `LocalWindow`, resolved: canonical wall times and whether it wraps past midnight. */
export type ResolvedLocalWindow = {
  from: Temporal.PlainTime;
  to: Temporal.PlainTime;
  wraps: boolean;
};

type Common = { label: string; severity: DutySeverity };

/** The kind-specific part of a resolved rule. */
type ResolvedRuleBody =
  | {
      kind: "cumulativeCap";
      statuses: StatusSet;
      cap: bigint;
      since: ResolvedReset;
    }
  | {
      kind: "elapsedWindow";
      startStatuses: StatusSet;
      length: bigint;
      restrictedStatuses: StatusSet;
      since: ResolvedReset;
      exclude: ResolvedPair | null;
      extension: { by: bigint; from: bigint } | null;
    }
  | {
      kind: "requiredInterruption";
      countedStatuses: StatusSet;
      after: bigint;
      minimum: bigint;
      outsideStatuses: StatusSet | null;
      orderedSplit: bigint[] | null;
    }
  | {
      kind: "rollingCap";
      statuses: StatusSet;
      cap: bigint;
      window: ResolvedPeriod;
      reset: ResolvedReset | null;
      precondition: {
        restStatuses: StatusSet;
        minimum: bigint;
        beforeHours: bigint;
      } | null;
    }
  | {
      kind: "fixedPeriodCap";
      statuses: StatusSet;
      cap: bigint;
      period: Extract<ResolvedPeriod, { kind: "units" }>;
      adjacent: number;
      average: boolean;
    }
  | {
      kind: "restRequirement";
      restStatuses: StatusSet;
      per: ResolvedPeriod;
      minimum: bigint;
      composition: {
        maxPeriods: number;
        longestAtLeast: bigint;
        othersAtLeast: bigint;
      } | null;
      composite: {
        consecutive: bigint;
        additional: bigint;
        blockMinimum: bigint;
      } | null;
      maxGap: bigint | null;
    }
  | {
      kind: "freePeriod";
      restStatuses: StatusSet;
      minimum: bigint;
      within: ResolvedPeriod;
      containing: { window: ResolvedLocalWindow; count: number } | null;
      atLeast: number;
    }
  | {
      kind: "restBeforeDuty";
      restStatuses: StatusSet;
      minimum: bigint;
      within: bigint;
      orFactor: { k: DecimalRatio; floor: bigint } | null;
    }
  | {
      kind: "quota";
      statuses: StatusSet;
      minimum: bigint;
      maximum: bigint;
      count: number;
      reset: ResolvedReset | { every: ResolvedPeriod };
    }
  | {
      kind: "dueBy";
      statuses: StatusSet;
      minimum: bigint;
      periods: number;
      period: ResolvedPeriod;
      reset: ResolvedReset | null;
    }
  | {
      kind: "pattern";
      period: ResolvedPeriod;
      lookback: number;
      classes: { label: string; statuses: StatusSet; minimum: bigint }[];
      require: { label: string; atLeast: number }[];
    }
  | {
      kind: "occurrenceCap";
      statuses: StatusSet;
      per: Extract<ResolvedPeriod, { kind: "units" }>;
      lookback: number;
      maximum: number;
      byInitiationDate: boolean;
    }
  | {
      kind: "usageLookback";
      uses: bigint[];
      notWithin: ResolvedPeriod;
      reset: ResolvedReset;
    };

/** A `DutyRule`, validated once and reduced to what evaluation reads. */
export type ResolvedRule = Common & ResolvedRuleBody;

/** Thrown inside the parser for any malformed field; caught once, at the top. */
class Malformed extends Error {}

const fail = (): never => {
  throw new Malformed();
};

/** Read one own-or-inherited property with an ordinary get, as Temporal's `GetOption` reads. */
function field(value: object, key: string): unknown {
  return (value as Record<string, unknown>)[key];
}

function object(value: unknown): object {
  return isObject(value) && !Array.isArray(value) ? value : fail();
}

function statusSet(value: unknown): StatusSet {
  if (!Array.isArray(value) || value.length === 0) {
    return fail();
  }

  const statuses = new Set<string>();
  const length = value.length;

  for (let index = 0; index < length; index++) {
    const status: unknown = value[index];
    statuses.add(typeof status === "string" ? status : fail());
  }

  return statuses;
}

function positiveDuration(value: unknown): bigint {
  const nanoseconds = exactDurationNanoseconds(value);
  return nanoseconds !== null && nanoseconds > 0n ? nanoseconds : fail();
}

/** A positive number as the exact fraction its decimal digits name. */
export type DecimalRatio = { numerator: bigint; denominator: bigint };

/**
 * A positive finite number read as the decimal it prints as, exactly: `1.1` is 11/10, never the
 * binary double nearest it, and `1e-7` is 1/10,000,000.
 */
function decimalRatio(value: unknown): DecimalRatio {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fail();
  }

  const parts = /^(\d+)(?:\.(\d+))?(?:e([+-]\d+))?$/.exec(String(value));

  if (parts === null) {
    return fail();
  }

  const [, whole, fraction = "", exponent = "0"] = parts;
  const shift = Number(exponent) - fraction.length;
  const digits = BigInt(`${whole}${fraction}`);

  return shift >= 0
    ? { numerator: digits * 10n ** BigInt(shift), denominator: 1n }
    : { numerator: digits, denominator: 10n ** BigInt(-shift) };
}

function optional<T>(value: unknown, read: (value: unknown) => T): T | null {
  return value === undefined ? null : read(value);
}

function integer(value: unknown, minimum: number, maximum: number): number {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
    ? value
    : fail();
}

const count = (value: unknown) => integer(value, 0, Number.MAX_SAFE_INTEGER);
const periodCount = (value: unknown) => integer(value, 1, MAX_PERIOD_COUNT);

const PERIOD_KEYS = [
  "elapsed",
  "operatorDays",
  "calendarDays",
  "isoWeeks",
  "calendarMonths",
  "calendarYears",
] as const;

const PERIOD_UNITS: Record<
  Exclude<(typeof PERIOD_KEYS)[number], "elapsed">,
  "operatorDay" | CalendarUnit
> = {
  operatorDays: "operatorDay",
  calendarDays: "day",
  isoWeeks: "week",
  calendarMonths: "month",
  calendarYears: "year",
};

function period(value: unknown): ResolvedPeriod {
  const bag = object(value);
  const present = PERIOD_KEYS.map(
    (key) => [key, field(bag, key)] as const,
  ).filter(([, given]) => given !== undefined);

  if (present.length !== 1) {
    return fail();
  }

  const [key, given] = present[0] as (typeof present)[number];

  return key === "elapsed"
    ? { kind: "elapsed", length: positiveDuration(given) }
    : { kind: "units", unit: PERIOD_UNITS[key], count: periodCount(given) };
}

/**
 * A period that a rule repeats `times` over: the total count of local periods must stay within
 * `MAX_PERIOD_COUNT`, so a walk over them is bounded.
 */
function withinCount<P extends ResolvedPeriod>(resolved: P, times: number): P {
  return resolved.kind === "units" && resolved.count * times > MAX_PERIOD_COUNT
    ? fail()
    : resolved;
}

function unitPeriod(value: unknown) {
  const resolved = period(value);
  return resolved.kind === "units" ? resolved : fail();
}

function reset(value: unknown): ResolvedReset {
  const bag = object(value);
  return {
    statuses: statusSet(field(bag, "statuses")),
    consecutive: positiveDuration(field(bag, "consecutive")),
  };
}

function pair(value: unknown): ResolvedPair {
  const bag = object(value);
  return {
    each: positiveDuration(field(bag, "eachAtLeast")),
    one: positiveDuration(field(bag, "oneAtLeast")),
    combined: positiveDuration(field(bag, "combinedAtLeast")),
  };
}

function instant(value: unknown): bigint {
  return typeof value === "string"
    ? (parseInstantNanoseconds(value) ?? fail())
    : fail();
}

function wallTime(value: unknown): Temporal.PlainTime {
  return typeof value === "string" && isValidTime(value)
    ? Temporal.PlainTime.from(value)
    : fail();
}

function localWindow(value: unknown): ResolvedLocalWindow {
  const bag = object(value);
  const from = wallTime(field(bag, "from"));
  const to = wallTime(field(bag, "to"));
  return { from, to, wraps: Temporal.PlainTime.compare(to, from) <= 0 };
}

function list<T>(value: unknown, read: (value: unknown) => T): T[] {
  if (!Array.isArray(value)) {
    return fail();
  }

  const items: T[] = [];
  const length = value.length;

  for (let index = 0; index < length; index++) {
    items.push(read(value[index]));
  }

  return items;
}

function severity(value: unknown): DutySeverity {
  return value === undefined || value === "violation"
    ? "violation"
    : value === "advisory"
      ? "advisory"
      : fail();
}

function resolveKind(bag: object, kind: unknown): ResolvedRuleBody {
  switch (kind) {
    case "cumulativeCap":
      return {
        kind,
        statuses: statusSet(field(bag, "statuses")),
        cap: positiveDuration(field(bag, "cap")),
        since: reset(field(bag, "since")),
      };
    case "elapsedWindow": {
      const extension = optional(field(bag, "extension"), (value) => {
        const extended = object(value);
        return {
          by: positiveDuration(field(extended, "by")),
          from: instant(field(extended, "from")),
        };
      });
      return {
        kind,
        startStatuses: statusSet(field(bag, "startStatuses")),
        length: positiveDuration(field(bag, "length")),
        restrictedStatuses: statusSet(field(bag, "restrictedStatuses")),
        since: reset(field(bag, "since")),
        exclude: optional(field(bag, "exclude"), pair),
        extension,
      };
    }
    case "requiredInterruption": {
      const countedStatuses = statusSet(field(bag, "countedStatuses"));
      const after = positiveDuration(field(bag, "after"));
      const interruption = object(field(bag, "interruption"));
      return {
        kind,
        countedStatuses,
        after,
        minimum: positiveDuration(field(interruption, "minimum")),
        outsideStatuses: optional(
          field(interruption, "outsideStatuses"),
          statusSet,
        ),
        orderedSplit: optional(field(interruption, "orderedSplit"), (value) => {
          const parts = list(value, positiveDuration);
          return parts.length > 0 ? parts : fail();
        }),
      };
    }
    case "rollingCap":
      return {
        kind,
        statuses: statusSet(field(bag, "statuses")),
        cap: positiveDuration(field(bag, "cap")),
        window: period(field(bag, "window")),
        reset: optional(field(bag, "reset"), reset),
        precondition: optional(field(bag, "precondition"), (value) => {
          const condition = object(value);
          return {
            restStatuses: statusSet(field(condition, "restStatuses")),
            minimum: positiveDuration(field(condition, "minimum")),
            beforeHours: positiveDuration(field(condition, "beforeHours")),
          };
        }),
      };
    case "fixedPeriodCap": {
      const statuses = statusSet(field(bag, "statuses"));
      const cap = positiveDuration(field(bag, "cap"));
      const fixedPeriod = unitPeriod(field(bag, "period"));
      const adjacent = field(bag, "adjacent");
      const average = field(bag, "average");
      const periods = adjacent === undefined ? 1 : periodCount(adjacent);
      return {
        kind,
        statuses,
        cap,
        period: withinCount(fixedPeriod, periods),
        adjacent: periods,
        average:
          average === undefined
            ? false
            : typeof average === "boolean"
              ? average
              : fail(),
      };
    }
    case "restRequirement":
      return {
        kind,
        restStatuses: statusSet(field(bag, "restStatuses")),
        per: period(field(bag, "per")),
        minimum: positiveDuration(field(bag, "minimum")),
        composition: optional(field(bag, "composition"), (value) => {
          const composition = object(value);
          return {
            maxPeriods: integer(
              field(composition, "maxPeriods"),
              1,
              Number.MAX_SAFE_INTEGER,
            ),
            longestAtLeast: positiveDuration(
              field(composition, "longestAtLeast"),
            ),
            othersAtLeast:
              optional(field(composition, "othersAtLeast"), positiveDuration) ??
              0n,
          };
        }),
        composite: optional(field(bag, "composite"), (value) => {
          const composite = object(value);
          return {
            consecutive: positiveDuration(field(composite, "consecutive")),
            additional: positiveDuration(field(composite, "additional")),
            blockMinimum: positiveDuration(field(composite, "blockMinimum")),
          };
        }),
        maxGap: optional(field(bag, "maxGap"), positiveDuration),
      };
    case "freePeriod": {
      const restStatuses = statusSet(field(bag, "restStatuses"));
      const minimum = positiveDuration(field(bag, "minimum"));
      const within = period(field(bag, "within"));
      const containing = optional(field(bag, "containing"), (value) => {
        const contained = object(value);
        return {
          window: localWindow(field(contained, "window")),
          count: integer(field(contained, "count"), 1, MAX_PERIOD_COUNT),
        };
      });
      const atLeast = field(bag, "atLeast");
      return {
        kind,
        restStatuses,
        minimum,
        within,
        containing,
        atLeast: atLeast === undefined ? 1 : count(atLeast),
      };
    }
    case "restBeforeDuty":
      return {
        kind,
        restStatuses: statusSet(field(bag, "restStatuses")),
        minimum: positiveDuration(field(bag, "minimum")),
        within: positiveDuration(field(bag, "within")),
        orFactor: optional(field(bag, "orFactor"), (value) => {
          const factor = object(value);
          return {
            k: decimalRatio(field(factor, "k")),
            floor: positiveDuration(field(factor, "floor")),
          };
        }),
      };
    case "quota": {
      const event = object(field(bag, "event"));
      const statuses = statusSet(field(event, "statuses"));
      const minimum = positiveDuration(field(event, "minimum"));
      const maximum = positiveDuration(field(event, "maximum"));
      const quotaCount = count(field(bag, "count"));
      const quotaReset = object(field(bag, "reset"));
      const every = field(quotaReset, "every");
      return {
        kind,
        statuses,
        minimum,
        maximum: maximum > minimum ? maximum : fail(),
        count: quotaCount,
        reset:
          every === undefined ? reset(quotaReset) : { every: period(every) },
      };
    }
    case "dueBy": {
      const event = object(field(bag, "event"));
      const within = object(field(bag, "within"));
      const statuses = statusSet(field(event, "statuses"));
      const minimum = positiveDuration(field(event, "minimum"));
      const periods = periodCount(field(within, "periods"));
      return {
        kind,
        statuses,
        minimum,
        periods,
        period: withinCount(period(field(within, "period")), periods),
        reset: optional(field(bag, "reset"), reset),
      };
    }
    case "pattern": {
      const patternPeriod = period(field(bag, "period"));
      const lookback = periodCount(field(bag, "lookback"));
      const classes = list(field(bag, "classes"), (value) => {
        const named = object(value);
        const label = field(named, "label");
        return {
          label: typeof label === "string" ? label : fail(),
          statuses: statusSet(field(named, "statuses")),
          minimum: positiveDuration(field(named, "minimum")),
        };
      });
      const labels = new Set(classes.map((named) => named.label));
      const require = list(field(bag, "require"), (value) => {
        const required = object(value);
        const label = field(required, "label");
        return {
          label:
            typeof label === "string" && labels.has(label) ? label : fail(),
          atLeast: count(field(required, "atLeast")),
        };
      });
      if (
        classes.length === 0 ||
        labels.size !== classes.length ||
        require.length === 0
      ) {
        return fail();
      }
      return {
        kind,
        period: withinCount(patternPeriod, lookback),
        lookback,
        classes,
        require,
      };
    }
    case "occurrenceCap": {
      const statuses = statusSet(field(bag, "statuses"));
      const per = unitPeriod(field(bag, "per"));
      const lookback = periodCount(field(bag, "lookback"));
      const byInitiationDate = field(bag, "byInitiationDate");
      return {
        kind,
        statuses,
        per: withinCount(per, lookback),
        lookback,
        maximum: count(field(bag, "maximum")),
        byInitiationDate:
          byInitiationDate === undefined
            ? false
            : typeof byInitiationDate === "boolean"
              ? byInitiationDate
              : fail(),
      };
    }
    case "usageLookback":
      return {
        kind,
        uses: list(field(bag, "uses"), instant).sort((a, b) =>
          a < b ? -1 : a > b ? 1 : 0,
        ),
        notWithin: period(field(bag, "notWithin")),
        reset: reset(field(bag, "reset")),
      };
    default:
      return fail();
  }
}

/**
 * Read a `PairSpec`: three positive exact durations.
 *
 * @param value candidate `{ eachAtLeast, oneAtLeast, combinedAtLeast }`
 * @returns the floors, or null when `value` is not a valid `PairSpec`
 */
export function parsePairSpec(value: unknown): ResolvedPair | null {
  try {
    return pair(value);
  } catch (error) {
    if (error instanceof Malformed) {
      return null;
    }
    throw error;
  }
}

/**
 * Whether a resolved rule counts operator days anywhere, and so needs `dayStartTime`.
 */
export function usesOperatorDays(rule: ResolvedRule): boolean {
  const periods: (ResolvedPeriod | null)[] = [];

  switch (rule.kind) {
    case "rollingCap":
      periods.push(rule.window);
      break;
    case "fixedPeriodCap":
      periods.push(rule.period);
      break;
    case "restRequirement":
      periods.push(rule.per);
      break;
    case "freePeriod":
      periods.push(rule.within);
      break;
    case "quota":
      periods.push("every" in rule.reset ? rule.reset.every : null);
      break;
    case "dueBy":
    case "pattern":
      periods.push(rule.period);
      break;
    case "occurrenceCap":
      periods.push(rule.per);
      break;
    case "usageLookback":
      periods.push(rule.notWithin);
      break;
    default:
      break;
  }

  return periods.some(
    (resolved) => resolved?.kind === "units" && resolved.unit === "operatorDay",
  );
}

/**
 * Validate and resolve a list of `DutyRule`s, all-or-nothing.
 *
 * - Every field is read once, with an ordinary property get. Labels must be strings and unique.
 * - Durations are exact (`exactDurationNanoseconds`) and positive; counts of periods are integers
 *   from 1 to `MAX_PERIOD_COUNT`; other counts are non-negative integers.
 * - A status list is a non-empty array of strings.
 *
 * @param value candidate array of rules
 * @returns the resolved rules in order, or null when any is malformed
 *
 * @example parseDutyRules([]) // []
 * @example parseDutyRules([{ label: "x", kind: "cumulativeCap", statuses: [], cap: "PT11H", since: { statuses: ["off"], consecutive: "PT10H" } }]) // null — no status to count
 */
export function parseDutyRules(value: unknown): ResolvedRule[] | null {
  try {
    const rules = list(value, (candidate) => {
      const bag = object(candidate);
      const label = field(bag, "label");
      const ruleSeverity = severity(field(bag, "severity"));
      const kind = field(bag, "kind");

      return {
        label: typeof label === "string" ? label : fail(),
        severity: ruleSeverity,
        ...resolveKind(bag, kind),
      } as ResolvedRule;
    });

    return new Set(rules.map((rule) => rule.label)).size === rules.length
      ? rules
      : null;
  } catch (error) {
    if (error instanceof Malformed) {
      return null;
    }
    throw error;
  }
}
