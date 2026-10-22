/**
 * One unit of GMT's human duration grammar (CORE-85). GMT's own grammar: no standard defines these
 * strings. Symbols follow the BIPM SI Brochure, 9th ed.: `s` is Table 2 (base units), `ms` is the
 * milli prefix (Table 7), `min`, `h` and `d` are Table 8; `mo` for a month and the other spellings are a GMT rule.
 */
export interface HumanDurationUnit {
  /** Position in the left-to-right order: 1 year to 8 millisecond. Each rank at most once. */
  readonly rank: number;
  /** The ISO 8601 designator the unit becomes (`Y`, `M`, `W`, `D`, `H`, `M`, `S`); `S` for ms. */
  readonly designator: "Y" | "M" | "W" | "D" | "H" | "S";
  /** Whether the unit may carry a fraction (hour, minute, second only). */
  readonly fraction: boolean;
  /** The symbol `formatHumanDuration` writes; empty for the millisecond, which is never written. */
  readonly symbol: string;
  /** Every accepted spelling, lower case; matching is ASCII case-insensitive. */
  readonly spellings: readonly string[];
}

/** The single source of spellings for the reader and the writer. */
export const HUMAN_DURATION_UNITS: readonly HumanDurationUnit[] = [
  {
    rank: 1,
    designator: "Y",
    fraction: false,
    symbol: "y",
    spellings: ["y", "yr", "yrs", "year", "years"],
  },
  {
    rank: 2,
    designator: "M",
    fraction: false,
    symbol: "mo",
    spellings: ["mo", "month", "months"],
  },
  {
    rank: 3,
    designator: "W",
    fraction: false,
    symbol: "w",
    spellings: ["w", "wk", "wks", "week", "weeks"],
  },
  {
    rank: 4,
    designator: "D",
    fraction: false,
    symbol: "d",
    spellings: ["d", "day", "days"],
  },
  {
    rank: 5,
    designator: "H",
    fraction: true,
    symbol: "h",
    spellings: ["h", "hr", "hrs", "hour", "hours"],
  },
  {
    rank: 6,
    designator: "M",
    fraction: true,
    symbol: "m",
    spellings: ["m", "min", "mins", "minute", "minutes"],
  },
  {
    rank: 7,
    designator: "S",
    fraction: true,
    symbol: "s",
    spellings: ["s", "sec", "secs", "second", "seconds"],
  },
  {
    rank: 8,
    designator: "S",
    fraction: false,
    symbol: "",
    spellings: ["ms", "millisecond", "milliseconds"],
  },
];

/**
 * One `number unit` pair. Groups: 1 integer digits, 2 fraction digits (1 to 9), 3 unit spelling.
 * Spellings are the table's, longest first so `ms` beats `m` (G1); no ASCII letter may follow the
 * unit. Flags `i` and `y` only: no `u` or `v`, so the unit letters and the `[a-z]` look-ahead stay
 * ASCII-only (under `iu` they would match U+017F and U+212A) (G7). `\d` is ASCII either way.
 *
 * Sticky and shared: every caller must set `lastIndex` before `exec` or `test`.
 */
export const HUMAN_DURATION_PAIR: RegExp =
  /(\d+)(?:\.(\d{1,9}))? *(milliseconds|millisecond|minutes|seconds|minute|months|second|hours|month|weeks|years|days|hour|mins|secs|week|year|day|hrs|min|sec|wks|yrs|hr|mo|ms|wk|yr|d|h|m|s|w|y)(?![a-z])/iy;

/** The separator between pairs, tried in this order; no match is the empty separator. */
const HUMAN_DURATION_SEPARATOR: RegExp = /,? +and +| +|, */iy;

const MAX_PAIRS = 8;

interface HumanDurationPair {
  readonly unit: HumanDurationUnit;
  readonly digits: string;
  readonly fraction: string | undefined;
  /** Index just past the pair. */
  readonly end: number;
}

/** Match one pair at `cursor`; `null` unless its unit outranks `previousRank` (G2, G3). */
function readPair(
  text: string,
  cursor: number,
  previousRank: number,
): HumanDurationPair | null {
  HUMAN_DURATION_PAIR.lastIndex = cursor;
  const match = HUMAN_DURATION_PAIR.exec(text);
  if (match === null) return null;
  const spelling = match[3].toLowerCase();
  const unit = HUMAN_DURATION_UNITS.find((candidate) =>
    candidate.spellings.includes(spelling),
  );
  const fraction = match[2];
  if (unit === undefined || unit.rank <= previousRank) return null;
  if (fraction !== undefined && !unit.fraction) return null;
  return {
    unit,
    digits: match[1],
    fraction,
    end: HUMAN_DURATION_PAIR.lastIndex,
  };
}

/** Index past the separator at `cursor`, or `cursor` itself for the empty separator. */
function skipSeparator(text: string, cursor: number): number {
  HUMAN_DURATION_SEPARATOR.lastIndex = cursor;
  return HUMAN_DURATION_SEPARATOR.test(text)
    ? HUMAN_DURATION_SEPARATOR.lastIndex
    : cursor;
}

/**
 * Read a human duration string into an ISO 8601 duration string, before Temporal sees it.
 * Digits are kept as matched (no Number conversion); a fraction stays on its hour, minute or
 * second for Temporal to spread. Milliseconds fold into seconds with BigInt (G5). Returns `null`
 * for any string outside the grammar. The Temporal limits are not checked here.
 */
export function humanDurationToIso(text: string): string | null {
  const sign = /^[+-]/.exec(text)?.[0] ?? "";
  let cursor = sign.length;
  const fields: (string | undefined)[] = [];
  let milliseconds: string | undefined;
  let previousRank = 0;

  // Loop bound: at most 8 pairs, one per rank; one pass over the caller's input.
  for (let count = 0; count < MAX_PAIRS; count++) {
    const pair = readPair(text, cursor, previousRank);
    if (pair === null) return null;
    previousRank = pair.unit.rank;
    const written =
      pair.fraction === undefined
        ? pair.digits
        : `${pair.digits}.${pair.fraction}`;
    if (pair.unit.rank === 8) milliseconds = written;
    else fields[pair.unit.rank] = written;
    if (pair.end === text.length)
      return buildIso(sign === "-", fields, milliseconds);
    // A fraction ends the duration (G3): any text after it is refused.
    if (pair.fraction !== undefined) return null;
    cursor = skipSeparator(text, pair.end);
    if (cursor === text.length) return null;
  }
  return null;
}

/** Digit count without leading zeros; linear in the input. */
function significantLength(digits: string): number {
  let start = 0;
  while (start < digits.length && digits.charCodeAt(start) === 48) start++;
  return digits.length - start;
}

function buildIso(
  negative: boolean,
  fields: readonly (string | undefined)[],
  milliseconds: string | undefined,
): string | null {
  let seconds = fields[7];
  if (milliseconds !== undefined) {
    // Cost guard: more than 16 significant seconds digits (2^53 s) or 19 millisecond digits
    // (2^53 x 1000 ms) can never pass Temporal 7.5.16, so refuse before any BigInt call.
    if (
      significantLength(seconds ?? "") > 16 ||
      significantLength(milliseconds) > 19
    )
      return null;
    // G5: `s × 1000 + ms` in BigInt; seconds carry no fraction when ms is present (G3).
    const total = BigInt(seconds ?? "0") * 1000n + BigInt(milliseconds);
    const rest = total % 1000n;
    seconds =
      rest === 0n
        ? String(total / 1000n)
        : `${total / 1000n}.${String(rest).padStart(3, "0").replace(/0+$/, "")}`;
  }
  const date = (["Y", "M", "W", "D"] as const)
    .map((designator, index) =>
      fields[index + 1] === undefined
        ? ""
        : `${fields[index + 1]}${designator}`,
    )
    .join("");
  const time =
    (fields[5] === undefined ? "" : `${fields[5]}H`) +
    (fields[6] === undefined ? "" : `${fields[6]}M`) +
    (seconds === undefined ? "" : `${seconds}S`);
  return `${negative ? "-" : ""}P${date}${time === "" ? "" : `T${time}`}`;
}
