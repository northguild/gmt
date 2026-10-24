import { Temporal } from "../internal/temporal";

const TWO_DAYS = 2n * 86_400n * 1_000_000_000n;

/**
 * Whether an instant is within two days of a zone transition found around the window. Temporal
 * finds the transitions, never GMT, so the answer can decide where a GMT oracle is needed.
 */
export function nearTransition(
  zone: string,
  window: { start: string; end: string },
): (instant: string) => boolean {
  const end = Temporal.Instant.from(window.end).epochNanoseconds + TWO_DAYS;
  const edges: bigint[] = [];
  let at: Temporal.ZonedDateTime | null = Temporal.Instant.fromEpochNanoseconds(
    Temporal.Instant.from(window.start).epochNanoseconds - TWO_DAYS,
  )
    .toZonedDateTimeISO(zone)
    .getTimeZoneTransition("next");

  for (
    ;
    at !== null && at.epochNanoseconds < end;
    at = at.getTimeZoneTransition("next")
  ) {
    edges.push(at.epochNanoseconds);
  }

  return (instant) => {
    const ns = Temporal.Instant.from(instant).epochNanoseconds;

    return edges.some(
      (edge) => (ns > edge ? ns - edge : edge - ns) <= TWO_DAYS,
    );
  };
}
