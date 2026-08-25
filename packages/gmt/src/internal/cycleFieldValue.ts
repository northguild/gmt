/**
 * Compute the wrapped (or rounded) target value for one field of a `cycle*` call.
 *
 * - `bounds: null` means the field is unbounded (only `year` uses this) — cycling is plain
 *   addition, and rounding still snaps to a multiple of `amount` with no wrap correction.
 * - Non-round path is modulo arithmetic relative to `bounds.min`, so it resolves any `amount` —
 *   including one bigger than the field's own range (e.g. cycling month by +13) — in one step,
 *   not by repeatedly correcting a single overflow.
 * - Round path is **not** "round to nearest": it steps by `Math.sign(amount)` first, then snaps to
 *   the next multiple of `Math.abs(amount)` in the direction of that sign (ceiling for positive
 *   amounts, floor for negative). Multiples are relative to `0`, not `bounds.min`. This matches
 *   `@internationalized/date`'s `CycleOptions.round` behavior exactly (verified against its
 *   `manipulation.ts` source) — e.g. minute `22` cycled by `+15` with `round: true` lands on `30`
 *   (the next multiple of 15 above 22), not `15` (the nearest multiple).
 *
 * @param current the field's current numeric value
 * @param amount signed amount to cycle by
 * @param bounds inclusive `{ min, max }` range to wrap within, or `null` for unbounded
 * @param round whether to snap to the next/previous multiple of `amount` instead of adding it
 * @example cycleFieldValue(12, 1, { min: 1, max: 12 }, false) // 1 (month December +1 wraps to January)
 * @example cycleFieldValue(1, 13, { min: 1, max: 12 }, false) // 2 (amount larger than the range)
 * @example cycleFieldValue(22, 15, { min: 0, max: 59 }, true) // 30 (next multiple of 15 above 22)
 * @example cycleFieldValue(22, -15, { min: 0, max: 59 }, true) // 15 (previous multiple of 15 below 22)
 * @example cycleFieldValue(2022, 5, null, true) // 2025 (unbounded field, still rounds)
 * @returns the new field value
 */
export function cycleFieldValue(
  current: number,
  amount: number,
  bounds: { min: number; max: number } | null,
  round: boolean,
): number {
  if (amount === 0) return current;

  if (round) {
    let stepped = current + Math.sign(amount);
    if (bounds && stepped < bounds.min) stepped = bounds.max;

    const increment = Math.abs(amount);
    stepped =
      amount > 0
        ? Math.ceil(stepped / increment) * increment
        : Math.floor(stepped / increment) * increment;

    if (bounds && stepped > bounds.max) stepped = bounds.min;
    return stepped;
  }

  if (!bounds) return current + amount;

  const size = bounds.max - bounds.min + 1;
  const wrapped = (((current - bounds.min + amount) % size) + size) % size;
  return bounds.min + wrapped;
}
