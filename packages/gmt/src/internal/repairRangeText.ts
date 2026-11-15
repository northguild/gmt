/** Which endpoint a zone name belongs to: the start (`a`) or the end (`b`). */
type Endpoint = "a" | "b";

/** One occurrence of a carrier name in the range text. `who` is `null` until it is attributed. */
interface Hit {
  readonly index: number;
  readonly length: number;
  who: Endpoint | null;
}

/**
 * Every occurrence of each name in `text`, longest name first, skipping an occurrence that
 * overlaps one already taken (so `GMT` inside `GMT+1` is not a second hit).
 */
function findHits(
  text: string,
  names: readonly (readonly [string, Endpoint | null])[],
): Hit[] {
  const taken = Array.from({ length: text.length }, () => false);
  const hits: Hit[] = [];
  for (const [name, who] of names) {
    for (
      let index = text.indexOf(name);
      index >= 0;
      index = text.indexOf(name, index + 1)
    ) {
      const end = index + name.length;
      if (taken.slice(index, end).some(Boolean)) {
        continue;
      }
      taken.fill(true, index, end);
      hits.push({ index, length: name.length, who });
    }
  }
  return hits.sort((first, second) => first.index - second.index);
}

/**
 * The range text with the carrier's zone names replaced by the requested ones (defect D16,
 * ICU-20548: an affected engine keeps the `short` zone name in a range and drops the requested
 * width). Pure over strings, so a test can feed it the text an engine really returned.
 *
 * Each hit is attributed to an endpoint by a GMT rule, the same attribution `repairRangeParts` reads
 * off the parts (CORE-112):
 *
 * - Carrier names that differ: a name printed for one endpoint only is that endpoint's
 *   (ECMA-402 PartitionDateTimeRangePattern gives each part one source). The longer name is found
 *   first, so a name inside the other is not a second hit.
 * - Carrier names that are equal: two hits are the start's then the end's, because an interval
 *   pattern writes the start's fields before the end's (UTS #35 Part 4 §2.6); one hit is a shared
 *   part and takes the start's; no hit or more than two cannot be attributed.
 *
 * @param text the carrier's `formatRange` text
 * @param carrierNames the carrier's zone name at the start and at the end
 * @param wantedNames the requested zone name at the start and at the end
 * @returns the repaired text, or `null` when a zone name cannot be given to an endpoint
 *
 * @example repairRangeText("28/03/2026, 12:00 GMT – 30/03/2026, 13:00 BST", ["GMT", "BST"], ["Greenwich Mean Time", "British Summer Time"]) // "28/03/2026, 12:00 Greenwich Mean Time – 30/03/2026, 13:00 British Summer Time"
 * @example repairRangeText("12:00–13:00 GMT", ["GMT", "GMT"], ["GMT+00:00", "GMT+00:00"]) // "12:00–13:00 GMT+00:00" (one shared hit)
 * @example repairRangeText("12:00–13:00", ["GMT", "GMT"], ["GMT+00:00", "GMT+00:00"]) // null (no hit)
 * @example repairRangeText("12:00–13:00", [undefined, "GMT"], ["a", "b"]) // null (no carrier name)
 */
export function repairRangeText(
  text: string,
  carrierNames: readonly [string | undefined, string | undefined],
  wantedNames: readonly [string | undefined, string | undefined],
): string | null {
  const [start, end] = carrierNames;
  if (start === undefined || end === undefined) {
    return null;
  }
  let hits: Hit[];
  if (start === end) {
    hits = findHits(text, [[start, null]]);
    if (hits.length === 2) {
      hits[0]!.who = "a";
      hits[1]!.who = "b";
    } else if (hits.length === 1) {
      hits[0]!.who = "a";
    } else {
      return null;
    }
  } else {
    const names: (readonly [string, Endpoint])[] =
      start.length >= end.length
        ? [
            [start, "a"],
            [end, "b"],
          ]
        : [
            [end, "b"],
            [start, "a"],
          ];
    hits = findHits(text, names);
  }
  let out = "";
  let at = 0;
  for (const hit of hits) {
    const wanted = hit.who === "a" ? wantedNames[0] : wantedNames[1];
    if (wanted === undefined) {
      return null;
    }
    out += text.slice(at, hit.index) + wanted;
    at = hit.index + hit.length;
  }
  return out + text.slice(at);
}
