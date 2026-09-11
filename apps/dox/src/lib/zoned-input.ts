/**
 * Turn a date-time a language model (or a reader) supplied into one the zoned
 * widgets will accept.
 *
 * ## The bug this exists for
 *
 * Asked *"if one meeting runs 9am to 11am and another runs 10am to noon, how do
 * they overlap?"*, Gemini correctly called `showIntervalVisualizer` with
 * `2024-10-24T09:00:00` and friends. Every one of those is a **plain**
 * date-time, and the interval visualizer is the *zoned* one: it gates its input
 * on `isValidZonedDateTime`, which requires a bracketed time zone. So the widget
 * mounted, showed "Invalid input", and drew nothing — until the reader nudged
 * the preset, which overwrote the inputs with the widget's own valid values and
 * made it spring to life. A widget that works only after you touch it is worse
 * than one that visibly fails.
 *
 * **Demanding a zone from the model is the wrong fix.** The reader said "9am";
 * there is no zone in the question, and a model that invents one is doing
 * something worse than omitting it. Two ranges either overlap or they do not,
 * and that answer is the same in every zone — so interpreting an unzoned time
 * as UTC is both safe and what the widget's own presets already do.
 *
 * ## The rules, established empirically against `isValidZonedDateTime`
 *
 *     2024-10-24T09:00:00              invalid   (no zone)
 *     2024-10-24T09:00:00[UTC]         valid
 *     2024-10-24T09:00:00Z             invalid   (no bracket, despite the Z)
 *     2024-10-24T09:00:00Z[UTC]        valid
 *     2024-10-24T09:00:00-04:00        invalid   (no bracket)
 *     2024-10-24T09:00:00-04:00[UTC]   invalid   (offset contradicts the zone)
 *     2024-10-24T09:00:00-04:00[-04:00]        valid
 *     2024-10-24T09:00:00-04:00[America/New_York]  valid
 *
 * The offset case is the one worth noticing: a numeric offset cannot simply be
 * given `[UTC]`, because the two disagree. It becomes its own bracket instead,
 * which preserves the instant the model actually meant.
 *
 * ## Why an offset is added and not just a bracket
 *
 * A first version of this appended a bare `[UTC]`, because that is enough for
 * `isValidZonedDateTime` — and it produced a widget that *still* misbehaved, in
 * a more confusing way: the intervals validated, the operations computed the
 * right answers, and the timeline drew nonsense while the panel claimed one
 * interval was reversed. The cause is that the widget reaches for
 * `Temporal.Instant.from` to place bars and classify the relationship, and
 * `Instant.from` requires an offset — `2024-10-24T09:00:00[UTC]` throws where
 * `2024-10-24T09:00:00+00:00[UTC]` does not.
 *
 * So "valid" here means valid to **both** gates, which is why the output
 * carries an offset *and* a bracket — the same shape the widget's own presets
 * use (`2024-01-01T00:00:00+00:00[UTC]`). Passing only the validator is the
 * kind of half-fix that looks correct in a test that asks the wrong question.
 */

/** A trailing numeric offset, e.g. `-04:00` or `+09:00`, at the very end. */
const TRAILING_OFFSET = /([+-]\d{2}:?\d{2})$/;

/**
 * @param value Whatever arrived — from a tool call, or a `?wa=` permalink.
 * @param fallbackZone Used when the value carries no zone information at all.
 *   UTC by design: see above.
 * @returns A string the zoned widgets accept, or the input unchanged when it
 *   already carries a zone or is too malformed to repair — in which case the
 *   widget's own "Invalid input" state is the correct thing for the reader to
 *   see, and this function must not hide it behind a guess.
 */
export function normaliseZonedInput(
  value: string,
  fallbackZone = "UTC",
): string {
  const trimmed = value.trim();
  if (trimmed === "") return trimmed;

  // Already zoned — never second-guess an explicit zone.
  if (trimmed.includes("[")) return trimmed;

  const offset = TRAILING_OFFSET.exec(trimmed);
  if (offset) {
    // `[UTC]` would contradict the offset; the offset becomes the zone.
    return `${trimmed}[${offset[1]}]`;
  }

  // A trailing `Z` already satisfies `Instant.from`; it only needs the bracket.
  if (trimmed.endsWith("Z")) return `${trimmed}[${fallbackZone}]`;

  /* Beyond this point there is no offset, so one has to be supplied — and only
     UTC's is knowable without a tz database lookup this module deliberately
     does not do. For any other fallback zone, add the bracket alone and let the
     widget's own validator have the final say. */
  if (fallbackZone !== "UTC") return `${trimmed}[${fallbackZone}]`;

  /* A bare date cannot carry an offset (`2024-10-24+00:00` is not a date-time),
     so it is expanded to midnight first. */
  const withTime = trimmed.includes("T") ? trimmed : `${trimmed}T00:00:00`;
  return `${withTime}+00:00[UTC]`;
}
