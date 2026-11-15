/*
 * CORE-112 slice 7, D25 and D29: the text an engine puts between two dates of a range.
 *
 * UTS #35 `intervalFormatFallback` (`{0} – {1}`) and ECMA-402 PartitionDateTimeRangePattern give a
 * range whose two ends differ in a field the engine has no interval pattern for. A repair that has
 * to write a range from two single-date texts needs that joiner. GMT owns no joiner datum: it is
 * read from the engine, as the text between the two singles in a helper range, so the output of a
 * fixed engine is never replaced.
 */

/** The text of a fallback range around the two single texts: `P + a + J + b + S`. */
export interface FallbackTemplate {
  readonly prefix: string;
  readonly joiner: string;
  readonly suffix: string;
}

const HELPER = {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
} as const;
const FROM = 1718457900000; // 2024-06-15T13:25Z;
const TO = 1718630700000; // 2024-06-17T13:25Z;
const WORD = /[\p{Nd}\p{L}\p{M}]/u;
const DIGIT = /\p{Nd}/u;

const templates = new Map<string, FallbackTemplate | null>();
let templatesBuiltWith: unknown;

/** Forget every template (the `Intl.DateTimeFormat` constructor was replaced, a test seam). */
export function forgetFallbackTemplates(): void {
  templates.clear();
  templatesBuiltWith = undefined;
}

/** Whether a single's text sits in the range as whole words (not inside a longer word). */
function isWhole(range: string, at: number, text: string): boolean {
  return (
    !(WORD.test(range[at - 1] ?? "") && WORD.test(text[0] ?? "")) &&
    !(WORD.test(range[at + text.length] ?? "") && WORD.test(text.at(-1) ?? ""))
  );
}

/**
 * The template read off a helper range and its two single texts, or `null` when it has no
 * recognisable shape.
 *
 * @example readTemplate("6/15/2024 – 6/17/2024", "6/15/2024", "6/17/2024") // { prefix: "", joiner: " – ", suffix: "" }
 * @example readTemplate("du 15/06 au 17/06", "15/06", "17/06") // { prefix: "du ", joiner: " au ", suffix: "" }
 */
export function readTemplate(
  range: string,
  first: string,
  last: string,
): FallbackTemplate | null {
  // 1. The range is the two singles and a joiner.
  if (
    range.length > first.length + last.length &&
    range.startsWith(first) &&
    range.endsWith(last)
  ) {
    return {
      prefix: "",
      joiner: range.slice(first.length, range.length - last.length),
      suffix: "",
    };
  }
  // 2. The range is one block written twice (digits masked) and a joiner.
  const masked: string[] = [];
  const at: number[] = [];
  for (const match of range.matchAll(/\p{Nd}+|[^]/gu)) {
    masked.push(DIGIT.test(match[0]) ? "#" : match[0]);
    at.push(match.index);
  }
  at.push(range.length);
  const n = masked.length;
  for (let size = Math.floor((n - 1) / 2); size > 0; size--) {
    const second = n - size;
    if (
      second > size &&
      masked.slice(0, size).includes("#") &&
      masked.slice(0, size).join("") === masked.slice(second).join("")
    ) {
      return {
        prefix: "",
        joiner: range.slice(at[size], at[second]),
        suffix: "",
      };
    }
  }
  // 3. The singles inside the range with words around them ('du ... au ...').
  let p = range.indexOf(first);
  while (p >= 0 && !isWhole(range, p, first)) {
    p = range.indexOf(first, p + 1);
  }
  let q = range.lastIndexOf(last);
  while (q > 0 && !isWhole(range, q, last)) {
    q = range.lastIndexOf(last, q - 1);
  }
  if (p >= 0 && q >= p + first.length && isWhole(range, q, last)) {
    return {
      prefix: range.slice(0, p),
      joiner: range.slice(p + first.length, q),
      suffix: range.slice(q + last.length),
    };
  }
  return null;
}

/**
 * The fallback template of a locale and numbering system, read from a helper formatter (bounded:
 * one `formatRange` and two `format` calls, then cached, at most 256 entries).
 *
 * @param locale the locale the formatter resolved
 * @param numberingSystem the numbering system it resolved
 * @param calendar the calendar the helper prints in
 * @returns the template, or `null` when the engine's range has no shape this reads
 *
 * @example fallbackTemplate("en", "latn", "gregory") // { prefix: "", joiner: " – ", suffix: "" }
 */
export function fallbackTemplate(
  locale: string,
  numberingSystem: string,
  calendar: string,
): FallbackTemplate | null {
  if (templatesBuiltWith !== Intl.DateTimeFormat) {
    templates.clear();
    templatesBuiltWith = Intl.DateTimeFormat;
  }
  const key = JSON.stringify([locale, numberingSystem, calendar]);
  if (templates.has(key)) {
    return templates.get(key) ?? null;
  }
  let template: FallbackTemplate | null = null;
  try {
    const helper = new Intl.DateTimeFormat(locale, {
      ...HELPER,
      calendar,
      numberingSystem,
      timeZone: "UTC",
    });
    template = readTemplate(
      helper.formatRange(FROM, TO),
      helper.format(FROM),
      helper.format(TO),
    );
  } catch {
    template = null;
  }
  if (templates.size >= 256) {
    templates.clear();
  }
  templates.set(key, template);
  return template;
}

/**
 * A range written from two single-date texts.
 *
 * @example joinFallback({ prefix: "", joiner: " – ", suffix: "" }, "1872 AD", "6 Meiji") // "1872 AD – 6 Meiji"
 */
export function joinFallback(
  template: FallbackTemplate,
  first: string,
  last: string,
): string {
  return template.prefix + first + template.joiner + last + template.suffix;
}
