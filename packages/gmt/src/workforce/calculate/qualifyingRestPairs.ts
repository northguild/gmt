import { Temporal } from "../../internal/temporal";
import { isObject, nonNegativeExactDurationNanoseconds } from "../../internal";
import { readStatusList, restPairs, runsOf } from "../../internal/dutyEngine";
import { parseDutyLog } from "../../internal/dutyLog";
import { parsePairSpec } from "../../internal/dutyRules";
import type { DutyEntry, PairSpec, RestPair } from "../../types";

/**
 * Return every paired rest in a duty log: two separate rests that together count as one, because
 * they meet all three floors of `spec.pair`.
 *
 * A pair is three constraints, not two integers: with `{ eachAtLeast: "PT2H", oneAtLeast: "PT7H",
 * combinedAtLeast: "PT10H" }`, 7.5 + 2.5 hours and 8 + 2 qualify, and 6 + 4 does not.
 *
 * - Rests are runs of touching entries in `spec.statuses`. Two rests in a row pair; either may be
 *   the longer.
 * - A rest of `spec.minimum` or more is a full rest on its own: it pairs with nothing, and no pair
 *   spans it. A rest shorter than `eachAtLeast` is neither half of a pair nor a break between two.
 * - Pairs chain: rests of 7, 3 and 7 hours give two pairs, (7, 3) and (3, 7).
 * - Intervals are UTC instants ending in "Z", in log order.
 * - `[]` is both a legitimate result and the sentinel: returned when the log fails
 *   `isValidDutyLog`, when `spec` is not an object, when `statuses` is not an array of strings,
 *   and when `minimum` or a floor of `pair` is not a positive ISO 8601 duration of exact time.
 *
 * @param log the duty log, ordered and non-overlapping
 * @param spec the statuses a rest is made of, the length of a full rest, and the pair's floors
 * @returns the pairs as `{ first, second }` records, or [] on invalid input
 *
 * @example qualifyingRestPairs([{ status: "sleeper", start: "2024-01-01T00:00:00Z", end: "2024-01-01T07:30:00Z" }, { status: "work", start: "2024-01-01T07:30:00Z", end: "2024-01-01T11:30:00Z" }, { status: "off", start: "2024-01-01T11:30:00Z", end: "2024-01-01T14:00:00Z" }], { statuses: ["off", "sleeper"], minimum: "PT10H", pair: { eachAtLeast: "PT2H", oneAtLeast: "PT7H", combinedAtLeast: "PT10H" } }) // [{ first: { start: "2024-01-01T00:00:00Z", end: "2024-01-01T07:30:00Z" }, second: { start: "2024-01-01T11:30:00Z", end: "2024-01-01T14:00:00Z" } }]
 * @example qualifyingRestPairs([{ status: "off", start: "2024-01-01T00:00:00Z", end: "2024-01-01T06:00:00Z" }, { status: "work", start: "2024-01-01T06:00:00Z", end: "2024-01-01T10:00:00Z" }, { status: "off", start: "2024-01-01T10:00:00Z", end: "2024-01-01T14:00:00Z" }], { statuses: ["off"], minimum: "PT10H", pair: { eachAtLeast: "PT2H", oneAtLeast: "PT7H", combinedAtLeast: "PT10H" } }) // [] — 6 + 4: neither is 7
 * @example qualifyingRestPairs([], { statuses: ["off"], minimum: "PT10H" }) // [] — no pair
 */
export function qualifyingRestPairs(
  log: DutyEntry[],
  spec: {
    /** The statuses a rest is made of. Touching entries in any of them are one rest. */
    statuses: string[];
    /**
     * The length of a full rest, a positive ISO 8601 duration of exact time (`"PT10H"`). A rest
     * this long or longer is not half of a pair.
     */
    minimum: string;
    /** The three floors the two rests must meet. */
    pair: PairSpec;
  },
): RestPair[] {
  try {
    const entries = parseDutyLog(log);

    if (entries === null || !isObject(spec)) {
      return [];
    }

    const { statuses, minimum, pair } = spec as {
      statuses?: unknown;
      minimum?: unknown;
      pair?: unknown;
    };
    const wanted = readStatusList(statuses);
    const fullRest = nonNegativeExactDurationNanoseconds(minimum);
    const floors = parsePairSpec(pair);

    if (
      wanted === null ||
      fullRest === null ||
      fullRest === 0n ||
      floors === null
    ) {
      return [];
    }

    const text = (nanoseconds: bigint) =>
      Temporal.Instant.fromEpochNanoseconds(nanoseconds).toString();

    return restPairs(runsOf(entries, wanted), fullRest, floors).map(
      ({ first, second }) => ({
        first: { start: text(first.start), end: text(first.end) },
        second: { start: text(second.start), end: text(second.end) },
      }),
    );
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return [];
  }
}
