import { type LocalesArgument, resolveLocale } from "./resolveLocale";
import { twoDigitYear } from "./twoDigitYear";
import { readYearWindowStart } from "./yearWindowStart";
import { getLocaleEraNames } from "../plain/locale/getLocaleEraNames";
import { getLocaleMeridiems } from "../plain/locale/getLocaleMeridiems";
import { getLocaleMonthNames } from "../plain/locale/getLocaleMonthNames";
import { getLocaleWeekdayNames } from "../plain/locale/getLocaleWeekdayNames";

/**
 * Shared token-pattern engine for J11's `parse*WithPattern` family.
 *
 * This is GMT's one named exception to `context/coding-standards.md`'s
 * "manual string parsing" prohibition (its section "Scoped exception:
 * manual string parsing"). The exception is scoped to this module
 * and the three `parse*WithPattern` public functions, and is bound by
 * three rules, enforced throughout this file:
 *   1. The regex is always built *from the pattern string itself* at call
 *      time (see `compilePattern`) — never hand-rolled per-format string
 *      slicing.
 *   2. Extracted fields are handed to the caller for `Temporal.*.from(...,
 *      { overflow: "reject" })` — a regex match alone only proves *shape*,
 *      never validity (see each `parse*WithPattern` wrapper).
 *   3. Never throws; malformed pattern, no match, or invalid input all
 *      resolve to `null` here (the public wrappers translate that to
 *      `""`).
 */

/** Field categories a pattern token can produce. Each may appear at most once per pattern. */
export type PatternField =
  | "year"
  | "month"
  | "day"
  | "hour"
  | "minute"
  | "second"
  | "millisecond"
  | "weekday"
  | "meridiem"
  | "era";

/** Fields accepted by `parseDateWithPattern` — date-shaped tokens only. */
export const DATE_PATTERN_FIELDS: ReadonlySet<PatternField> = new Set([
  "year",
  "month",
  "day",
  "weekday",
  "era",
]);

/** Fields accepted by `parseTimeWithPattern` — time-shaped tokens only. */
export const TIME_PATTERN_FIELDS: ReadonlySet<PatternField> = new Set([
  "hour",
  "minute",
  "second",
  "millisecond",
  "meridiem",
]);

/** Fields accepted by `parseDateTimeWithPattern` — the full combined set. */
export const DATE_TIME_PATTERN_FIELDS: ReadonlySet<PatternField> = new Set([
  ...DATE_PATTERN_FIELDS,
  ...TIME_PATTERN_FIELDS,
]);

/** Resolved output of a successful parse — only fields the pattern actually contained are set. */
export interface ParsedPatternFields {
  year?: number;
  month?: number;
  day?: number;
  hour?: number;
  minute?: number;
  second?: number;
  millisecond?: number;
}

type TokenKind =
  | "yearFull"
  | "yearShort"
  | "monthNumber"
  | "monthNameShort"
  | "monthNameLong"
  | "day"
  | "hour24"
  | "hour12"
  | "minute"
  | "second"
  | "millisecond"
  | "weekdayShort"
  | "weekdayLong"
  | "meridiem"
  | "eraShort"
  | "eraLong";

interface TokenSpec {
  field: PatternField;
  kind: TokenKind;
  /** Regex source for numeric tokens. Name-based tokens build theirs from locale data at call time (see `compilePattern`). */
  regexSource?: string;
}

// Recognized vocabulary letters: a subset of the UTS #35 Date Field Symbol
// Table, with its field lengths (`MMM` abbreviated, `MMMM` wide), restricted
// to what's unambiguous to parse — no offset/zone-name tokens since this
// story is plain-only (Decision 1). Any other unquoted letter in a pattern
// is malformed. Numeric ranges are baked into each regex so a shape
// mismatch (e.g. "13" for a 12-hour token) fails at the regex stage,
// before ever reaching Temporal.
const TOKEN_TABLE: Record<string, TokenSpec> = {
  y4: { field: "year", kind: "yearFull", regexSource: "\\d{4}" },
  y2: { field: "year", kind: "yearShort", regexSource: "\\d{2}" },
  M2: {
    field: "month",
    kind: "monthNumber",
    regexSource: "(?:0[1-9]|1[0-2])",
  },
  M1: {
    field: "month",
    kind: "monthNumber",
    regexSource: "(?:0?[1-9]|1[0-2])",
  },
  M3: { field: "month", kind: "monthNameShort" },
  M4: { field: "month", kind: "monthNameLong" },
  d2: { field: "day", kind: "day", regexSource: "(?:0[1-9]|[12]\\d|3[01])" },
  d1: {
    field: "day",
    kind: "day",
    regexSource: "(?:0?[1-9]|[12]\\d|3[01])",
  },
  H2: { field: "hour", kind: "hour24", regexSource: "(?:[01]\\d|2[0-3])" },
  H1: {
    field: "hour",
    kind: "hour24",
    regexSource: "(?:[01]?\\d|2[0-3])",
  },
  h2: { field: "hour", kind: "hour12", regexSource: "(?:0[1-9]|1[0-2])" },
  h1: {
    field: "hour",
    kind: "hour12",
    regexSource: "(?:0?[1-9]|1[0-2])",
  },
  m2: { field: "minute", kind: "minute", regexSource: "[0-5]\\d" },
  m1: { field: "minute", kind: "minute", regexSource: "(?:[0-5]?\\d)" },
  s2: { field: "second", kind: "second", regexSource: "[0-5]\\d" },
  s1: { field: "second", kind: "second", regexSource: "(?:[0-5]?\\d)" },
  S3: { field: "millisecond", kind: "millisecond", regexSource: "\\d{3}" },
  E3: { field: "weekday", kind: "weekdayShort" },
  E4: { field: "weekday", kind: "weekdayLong" },
  a1: { field: "meridiem", kind: "meridiem" },
  G2: { field: "era", kind: "eraShort" },
  G4: { field: "era", kind: "eraLong" },
};

const VOCABULARY_LETTERS = "yMdHhmsSEaG";

interface PatternPart {
  type: "literal" | "token";
  text?: string;
  letter?: string;
  length?: number;
}

/**
 * Split a pattern string into literal and letter-run parts.
 *
 * Literal text follows UTS #35 Part 4, Date Format Patterns
 * (https://unicode.org/reports/tr35/tr35-dates.html#Date_Format_Patterns):
 *   - "Any characters other than A..Z and a..z, including spaces and
 *     punctuation" are literals with no quoting.
 *   - "Any text between single vertical quotes ('xxxx'), which may include
 *     A..Z and a..z as literal text."
 *   - "Two adjacent single vertical quotes (''), which represent a literal
 *     single quote, either inside or outside quoted text."
 *
 * The pattern is read left to right, so a `''` pair is taken before a
 * lone `'` is read as opening or closing quoted text: `''''` is two
 * literal quotes, and `'''T'` is a literal quote followed by the quoted
 * text `T`. UTS #35 defines quoted text only as text *between* two
 * quotes, so a quote that never closes has no defined meaning and the
 * pattern is malformed (`null`).
 */
function tokenizePattern(pattern: string): PatternPart[] | null {
  const parts: PatternPart[] = [];
  let i = 0;

  while (i < pattern.length) {
    const ch = pattern[i];

    if (ch === "'") {
      // `''` outside quoted text: one literal quote, no quoted text opened.
      if (pattern[i + 1] === "'") {
        parts.push({ type: "literal", text: "'" });
        i += 2;
        continue;
      }

      let j = i + 1;
      let text = "";
      let closed = false;
      while (j < pattern.length) {
        if (pattern[j] === "'") {
          if (pattern[j + 1] === "'") {
            text += "'";
            j += 2;
            continue;
          }
          j += 1;
          closed = true;
          break;
        }
        text += pattern[j];
        j += 1;
      }
      // UTS #35 gives quoted text a meaning only between two quotes, so
      // an unterminated quote is a malformed pattern, not a guess at
      // where it should have closed.
      if (!closed) return null;
      parts.push({ type: "literal", text });
      i = j;
      continue;
    }

    if (/[a-zA-Z]/.test(ch)) {
      let j = i;
      while (j < pattern.length && pattern[j] === ch) j++;
      parts.push({ type: "token", letter: ch, length: j - i });
      i = j;
      continue;
    }

    parts.push({ type: "literal", text: ch });
    i++;
  }

  return parts;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a case-insensitive alternation from a locale's name list.
 *
 * Names are sorted by descending length before joining with `|` so a
 * longer name is tried before a shorter one that happens to be its
 * prefix (e.g. a locale where a short-form weekday name is a strict
 * prefix of a longer name) — otherwise the regex engine's left-to-right
 * alternation would greedily commit to the shorter match and never
 * backtrack into the longer one.
 */
function buildNameAlternation(names: string[]): string {
  return [...names]
    .sort((a, b) => b.length - a.length)
    .map((name) => escapeRegExp(name))
    .join("|");
}

interface CompiledToken {
  groupName: string;
  field: PatternField;
  kind: TokenKind;
  monthNames?: string[];
  meridiems?: string[];
  eras?: string[];
}

interface CompiledPattern {
  regex: RegExp;
  tokens: CompiledToken[];
}

/**
 * Compile a token pattern into an anchored `RegExp` plus the metadata
 * needed to resolve each capture back to a field value.
 *
 * Returns `null` for any malformed pattern: an unquoted letter outside
 * the recognized vocabulary, a recognized letter repeated to an
 * unsupported width, a field appearing more than once, a field outside
 * `allowedFields` (e.g. a time token handed to the date-only parser), an
 * unterminated quote, or (for a locale-aware token) a locale that
 * `Intl.Locale` cannot resolve.
 */
function compilePattern(
  pattern: string,
  allowedFields: ReadonlySet<PatternField>,
  locale: string,
): CompiledPattern | null {
  const parts = tokenizePattern(pattern);
  if (parts === null) return null;

  const usedFields = new Set<PatternField>();
  const tokens: CompiledToken[] = [];
  const regexPieces: string[] = [];
  let groupCounter = 0;

  for (const part of parts) {
    if (part.type === "literal") {
      regexPieces.push(escapeRegExp(part.text ?? ""));
      continue;
    }

    const letter = part.letter as string;
    const length = part.length as number;

    // An unquoted letter outside the recognized vocabulary is always
    // malformed, regardless of run length.
    if (!VOCABULARY_LETTERS.includes(letter)) return null;

    const spec = TOKEN_TABLE[`${letter}${length}`];
    // A recognized letter repeated to a width not in the token table
    // (e.g. "yyy", "hhh", "SS") is malformed.
    if (!spec) return null;

    // A time-only token in a date-only pattern (or vice versa) is
    // rejected here, before ever attempting to match `value` — this is
    // the pattern-parsing-stage rejection the spec requires.
    if (!allowedFields.has(spec.field)) return null;
    // The same field appearing twice (e.g. two independent yyyy runs, or
    // H combined with hh) is malformed — each field may resolve to only
    // one captured value.
    if (usedFields.has(spec.field)) return null;
    usedFields.add(spec.field);

    const groupName = `g${groupCounter++}`;

    if (spec.regexSource) {
      regexPieces.push(`(?<${groupName}>${spec.regexSource})`);
      tokens.push({ groupName, field: spec.field, kind: spec.kind });
      continue;
    }

    if (spec.kind === "monthNameShort" || spec.kind === "monthNameLong") {
      const names = getLocaleMonthNames(
        locale,
        spec.kind === "monthNameLong" ? "long" : "short",
      );
      if (names.length !== 12) return null; // locale not resolvable
      regexPieces.push(`(?<${groupName}>${buildNameAlternation(names)})`);
      tokens.push({
        groupName,
        field: spec.field,
        kind: spec.kind,
        monthNames: names,
      });
      continue;
    }

    if (spec.kind === "weekdayShort" || spec.kind === "weekdayLong") {
      const names = getLocaleWeekdayNames(
        locale,
        spec.kind === "weekdayLong" ? "long" : "short",
      );
      if (names.length !== 7) return null;
      // Deliberate scope limit: the weekday name is consumed and matched
      // against the pattern (so the overall shape still has to line up)
      // but is NOT cross-validated against the constructed date — that
      // would require a second weekday-index-to-ISO-dayOfWeek mapping
      // layer this story does not build. No capturing group is created;
      // nothing about this token feeds `resolvePatternFields`.
      regexPieces.push(`(?:${buildNameAlternation(names)})`);
      continue;
    }

    if (spec.kind === "meridiem") {
      const meridiems = getLocaleMeridiems(locale);
      if (meridiems.length !== 2) return null;
      regexPieces.push(`(?<${groupName}>${buildNameAlternation(meridiems)})`);
      tokens.push({
        groupName,
        field: spec.field,
        kind: spec.kind,
        meridiems,
      });
      continue;
    }

    // era (eraShort | eraLong)
    const eras = getLocaleEraNames(
      locale,
      spec.kind === "eraLong" ? "long" : "short",
    );
    if (eras.length !== 2) return null;
    regexPieces.push(`(?<${groupName}>${buildNameAlternation(eras)})`);
    tokens.push({ groupName, field: spec.field, kind: spec.kind, eras });
  }

  // Anchor the fully assembled pattern so only a whole-string match
  // counts — a `value` that merely starts with something pattern-shaped
  // (e.g. trailing garbage) must not silently succeed. The whole
  // alternation is case-insensitive so locale name matching (and any
  // literal separators) doesn't depend on the caller's casing.
  const regex = new RegExp(`^${regexPieces.join("")}$`, "i");
  return { regex, tokens };
}

/**
 * Resolve a successful regex match's captures back into date/time field
 * values, resolving a two-digit year in the caller's window, converting
 * 12-hour to 24-hour (via a matched meridiem), and adjusting a BCE year.
 *
 * This step only ever produces a *candidate* fields object — it does not
 * itself prove the fields form a real date/time. The caller is
 * responsible for handing the result to `Temporal.*.from(fields, {
 * overflow: "reject" })`, which is what actually validates it.
 *
 * `options` is the caller's `TwoDigitYearOptions` bag, unread. It is read
 * only when a `yy` token matched, once (`readYearWindowStart`): a pattern
 * with no `yy` never reads `yearWindow`, and so never reads the clock a
 * `"rolling"` window needs. Returns `null` when a `yy` token matched and
 * the bag names no valid window: no standard says which century a
 * two-digit year belongs to, so without the caller's window the value
 * cannot be read. Reading a hostile bag throws; the public function's
 * `try` turns that into its sentinel.
 */
function resolvePatternFields(
  match: RegExpMatchArray,
  tokens: CompiledToken[],
  options: unknown,
): ParsedPatternFields | null {
  const groups = (match.groups ?? {}) as Record<string, string | undefined>;
  const fields: ParsedPatternFields = {};

  let hourIsTwelveHour = false;
  let meridiemIsPM = false;
  let eraIsBCE = false;

  for (const token of tokens) {
    const raw = groups[token.groupName];
    if (raw === undefined) continue;

    switch (token.kind) {
      case "yearFull":
        fields.year = Number.parseInt(raw, 10);
        break;
      case "yearShort": {
        // A pattern holds one year token at most (`compilePattern` rejects
        // a repeated field), so this is the call's only read of the option.
        const yearWindowStart = readYearWindowStart(options);
        if (yearWindowStart === null) return null;
        fields.year = twoDigitYear(Number.parseInt(raw, 10), yearWindowStart);
        break;
      }
      case "monthNumber":
        fields.month = Number.parseInt(raw, 10);
        break;
      case "monthNameShort":
      case "monthNameLong": {
        const names = token.monthNames ?? [];
        const index = names.findIndex(
          (name) => name.toLowerCase() === raw.toLowerCase(),
        );
        fields.month = index + 1; // -1 (not found) would yield 0, which Temporal rejects
        break;
      }
      case "day":
        fields.day = Number.parseInt(raw, 10);
        break;
      case "hour24":
        fields.hour = Number.parseInt(raw, 10);
        break;
      case "hour12":
        hourIsTwelveHour = true;
        fields.hour = Number.parseInt(raw, 10);
        break;
      case "minute":
        fields.minute = Number.parseInt(raw, 10);
        break;
      case "second":
        fields.second = Number.parseInt(raw, 10);
        break;
      case "millisecond":
        fields.millisecond = Number.parseInt(raw, 10);
        break;
      case "meridiem": {
        const [amLabel, pmLabel] = token.meridiems ?? ["", ""];
        // Guard against a locale whose AM/PM labels happen to coincide —
        // in that case there is nothing to distinguish, so don't treat
        // the match as PM by accident.
        meridiemIsPM =
          raw.toLowerCase() === (pmLabel ?? "").toLowerCase() &&
          (pmLabel ?? "").toLowerCase() !== (amLabel ?? "").toLowerCase();
        break;
      }
      case "eraShort":
      case "eraLong": {
        const [bceLabel, ceLabel] = token.eras ?? ["", ""];
        eraIsBCE =
          raw.toLowerCase() === (bceLabel ?? "").toLowerCase() &&
          (bceLabel ?? "").toLowerCase() !== (ceLabel ?? "").toLowerCase();
        break;
      }
      default:
        break;
    }
  }

  if (hourIsTwelveHour && fields.hour !== undefined) {
    // Resolve h/hh to 24-hour. With no `a` token present in the pattern
    // at all, `meridiemIsPM` stays false and this falls through the same
    // branch as an explicit AM match — the documented "ambiguous AM
    // default" behavior.
    if (meridiemIsPM && fields.hour !== 12) fields.hour += 12;
    if (!meridiemIsPM && fields.hour === 12) fields.hour = 0;
  }

  if (eraIsBCE && fields.year !== undefined) {
    // Proleptic Gregorian: 1 BCE = year 0, 2 BCE = year -1, etc.
    fields.year = 1 - fields.year;
  }

  return fields;
}

/**
 * Parse `value` against `pattern` and return the resolved candidate
 * fields, or `null` on malformed pattern / no match / invalid input.
 *
 * `null` here always means "return the sentinel" to the caller — it
 * never distinguishes malformed-pattern from no-match from invalid-input
 * from a `yy` token with no window, matching the shared never-throw /
 * sentinel-return contract.
 *
 * `options` is the caller's `TwoDigitYearOptions` bag, already accepted
 * by `isOptionsArgument`. It is read lazily: only a matched `yy` token
 * reads `yearWindow`, once, so a pattern without `yy` reads neither the
 * option nor the clock. A bag that throws when read makes this function
 * throw; every caller runs it inside `try`.
 */
export function parseValueWithPattern(
  value: string,
  pattern: string,
  locale: LocalesArgument | undefined,
  allowedFields: ReadonlySet<PatternField>,
  options?: unknown,
): ParsedPatternFields | null {
  if (typeof value !== "string" || value.length === 0) return null;
  if (typeof pattern !== "string" || pattern.length === 0) return null;

  // No `locale` is required to parse a pattern containing only numeric
  // tokens, but a name-based token (MMM/MMMM/EEE/EEEE/a/GG/GGGG) needs
  // *some* locale to resolve against — default to "en-US" rather than
  // silently returning "" for every caller who didn't have another
  // locale in mind. An empty preference list names no locale either, so
  // it takes that same default: ECMA-402 ResolveLocale would answer `[]`
  // with the *host* locale, which would make a decoder of a fixed
  // producer format read differently on a French machine (house rule,
  // ./resolveLocale.ts).
  const omitted =
    locale === undefined || (Array.isArray(locale) && locale.length === 0);
  const resolvedLocale = omitted ? "en-US" : resolveLocale(locale);
  if (resolvedLocale === null) return null;

  const compiled = compilePattern(pattern, allowedFields, resolvedLocale);
  if (compiled === null) return null;

  const match = value.match(compiled.regex);
  if (match === null) return null;

  return resolvePatternFields(match, compiled.tokens, options);
}
