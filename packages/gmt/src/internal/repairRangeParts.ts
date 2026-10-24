/** A `formatRangeToParts` part; `source` is ES2021 Intl.DateTimeFormat v3 and absent from older lib typings. */
export type RangePart = Intl.DateTimeFormatPart & {
  readonly source?: "startRange" | "endRange" | "shared";
};

/**
 * The range's parts with the ones a host wrote in the wrong form replaced by the form the caller
 * asked for. Pure over part arrays so a test can feed it the parts an engine really returned.
 *
 * ECMA-402 FormatDateTimeRange builds each range part with FormatDateTimePattern over the range
 * pattern's own fields (§11.5.8), and UTS #35 (Matching Skeletons) expects the fields of the
 * skeleton and the pattern to be adjusted in parallel, so a range pattern keeps the width the
 * skeleton asked for. An affected engine breaks that for some fields (defect D16, ICU-20548: a
 * `timeZoneName` width; defect D17: a flexible `dayPeriod` written as AM or PM) and keeps every
 * other part right, so its range is the carrier and only the listed part types are replaced.
 *
 * - A `startRange` part takes the value the requested single format gives the start, an
 *   `endRange` part the end's.
 * - A `shared` part names no endpoint in string output, so either endpoint conforms: it takes the
 *   end's value when the carrier printed the end's (and not the start's), else the start's. The
 *   form changes, never the endpoint.
 * - A part the single format lacks keeps the engine's own value.
 *
 * @param range the carrier's `formatRangeToParts` result
 * @param wanted the requested formatter's `formatToParts` for the start and the end
 * @param carrier the carrier's `formatToParts` for the start and the end (the same arrays as
 *   `wanted` when the carrier is the requested formatter)
 * @param types the part types to replace
 * @returns the repaired range text
 */
export function repairRangeParts(
  range: readonly RangePart[],
  wanted: readonly [
    readonly Intl.DateTimeFormatPart[],
    readonly Intl.DateTimeFormatPart[],
  ],
  carrier: readonly [
    readonly Intl.DateTimeFormatPart[],
    readonly Intl.DateTimeFormatPart[],
  ],
  types: readonly string[],
): string {
  const valueOf = (parts: readonly Intl.DateTimeFormatPart[], type: string) =>
    parts.find((part) => part.type === type)?.value;
  return range
    .map((part) => {
      if (!types.includes(part.type)) {
        return part.value;
      }
      const wa = valueOf(wanted[0], part.type) ?? part.value;
      const wb = valueOf(wanted[1], part.type) ?? part.value;
      if (part.source === "startRange") {
        return wa;
      }
      if (part.source === "endRange") {
        return wb;
      }
      const ca = valueOf(carrier[0], part.type);
      const cb = valueOf(carrier[1], part.type);
      return part.value === cb && part.value !== ca ? wb : wa;
    })
    .join("");
}
