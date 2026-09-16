/**
 * Default `maxPieces` for functions that return one array element per generated piece
 * (`splitIntervalByUnit*`, `intervalDivideEqually*`, `mapDatesInRange`, `mapZonedDatesInRange`).
 *
 * Owner decision A2 (CORE-8): an output that would be larger returns the sentinel `[]` rather
 * than exhausting the heap, which aborts the process where no caller can catch it.
 */
export const DEFAULT_MAX_PIECES = 1_000_000;

/** ECMA-262 §10.4.2 (Array exotic objects): an array length is at most 2^32 - 1. */
export const MAX_ARRAY_LENGTH = 2 ** 32 - 1;

/**
 * Read the `maxPieces` option.
 *
 * - Omitted options, or an omitted/`undefined` `maxPieces`, give `DEFAULT_MAX_PIECES`
 *   (Temporal GetOption reads `undefined` as absent).
 * - A non-object options argument returns `null` (Temporal GetOptionsObject throws `TypeError`).
 * - `maxPieces` must be a positive safe integer, otherwise `null`.
 *
 * @param options the caller's options argument
 * @returns the piece limit, or `null` when the option is invalid
 *
 * @example resolveMaxPieces(undefined) // 1000000
 * @example resolveMaxPieces({ maxPieces: 10 }) // 10
 * @example resolveMaxPieces({ maxPieces: 0 }) // null
 */
export function resolveMaxPieces(
  options: { maxPieces?: number } | undefined,
): number | null {
  if (options === undefined) {
    return DEFAULT_MAX_PIECES;
  }

  if (typeof options !== "object" || options === null) {
    return null;
  }

  const { maxPieces } = options;

  if (maxPieces === undefined) {
    return DEFAULT_MAX_PIECES;
  }

  return Number.isSafeInteger(maxPieces) && maxPieces > 0 ? maxPieces : null;
}

/**
 * Whether an output of `count` pieces is over the limit.
 *
 * - Over `maxPieces`, or over the longest array a JavaScript engine can hold.
 *
 * @param count number of pieces the output would hold
 * @param maxPieces resolved limit from `resolveMaxPieces`
 * @returns `true` when the function must return its sentinel instead
 *
 * @example exceedsPieceLimit(11, 10) // true
 * @example exceedsPieceLimit(2 ** 32, 2 ** 40) // true
 */
export function exceedsPieceLimit(count: number, maxPieces: number): boolean {
  return count > maxPieces || count > MAX_ARRAY_LENGTH;
}
