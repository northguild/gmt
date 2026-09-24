/**
 * Functions whose `null` can be a correct, empty answer rather than invalid input.
 *
 * Every `object`-returning function signals invalid input with `null`, and the
 * playground renders that as the sentinel. For the functions below, `null` also
 * means "these intervals share no span" or "no single span joins them". The
 * library returns one value for both cases by design, so the playground cannot
 * tell them apart and renders `null` as the quiet empty state instead of the
 * sentinel: a disjoint pair is a real answer and must never look like a failure
 * (context/dox/reference/visual-design.md, "Widget chrome").
 *
 * Listed by hand, with the `@example` note that shows the empty case, because
 * neither the type nor the examples can decide it: nearly every function has an
 * invalid-input `null` example, and `dwellTime`'s `null` is never an answer.
 * The generator refuses a name that is missing from the corpus or does not
 * return an object, so a rename cannot leave a stale entry behind.
 */
export const NULL_IS_EMPTY: ReadonlyMap<string, string> = new Map([
  ["clampInterval", "null — touching; null — empty, at the edge"],
  ["intersectIntervals", "null — touching; null — disjoint"],
  ["intervalIntersectionDate", "null (touching)"],
  ["intervalIntersectionDateTime", "null (touching)"],
  ["intervalIntersectionTime", "null (touching)"],
  ["intervalIntersectionUnix", "null (touching)"],
  ["intervalIntersectionUtc", "null (touching)"],
  ["intervalIntersectionZoned", "null (touching: no shared instant)"],
  ["intervalUnionDate", "null (06-30 is in neither)"],
  ["intervalUnionDateTime", "null (1 ns gap)"],
  ["intervalUnionTime", "@returns: null on disjoint intervals"],
  ["intervalUnionUnix", "@returns: null on disjoint intervals"],
  ["intervalUnionUtc", "null (1 ns gap)"],
  ["intervalUnionZoned", "null (one-nanosecond gap)"],
]);
