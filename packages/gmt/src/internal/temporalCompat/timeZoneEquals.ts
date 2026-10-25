import { Temporal } from "../temporal";
import { isTimeZoneEqualsCompatNeeded } from "./capabilities";

/**
 * The part of a host's `Temporal` this module reads: the `ZonedDateTime` constructor, whose
 * `equals` applies the host's own TimeZoneEquals. Everything else on the host is ignored.
 */
export interface HostTemporal {
  ZonedDateTime?: new (
    epochNanoseconds: bigint,
    timeZone: string,
  ) => { equals(other: unknown): unknown };
}

/** The `Temporal` the host provides on `globalThis`, if any. */
function hostTemporal(): HostTemporal | undefined {
  return (globalThis as { Temporal?: HostTemporal }).Temporal;
}

/**
 * TimeZoneEquals for two identifiers as the host's own `Temporal` answers it, or `undefined` when
 * the host has no `Temporal.ZonedDateTime`, it throws for either identifier, or its `equals`
 * returns something other than a boolean.
 *
 * @param host the host's `Temporal` namespace, or `undefined` when it has none
 * @param one a time zone identifier
 * @param two a time zone identifier
 * @returns the host's answer, or `undefined` when it cannot be had
 */
export function timeZoneEqualsByHost(
  host: HostTemporal | undefined,
  one: string,
  two: string,
): boolean | undefined {
  const ZonedDateTime = host?.ZonedDateTime;
  if (typeof ZonedDateTime !== "function") return undefined;
  try {
    const answer = new ZonedDateTime(0n, one).equals(
      new ZonedDateTime(0n, two),
    );
    return typeof answer === "boolean" ? answer : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The identifiers ECMA-402 §6.5 resolves to `"UTC"` by name, with no time zone data: the last
 * step of AvailableNamedTimeZoneIdentifiers. The polyfill hands them back in this casing.
 */
const RESOLVE_TO_UTC: ReadonlySet<string> = new Set([
  "Etc/UTC",
  "Etc/GMT",
  "GMT",
]);

/** The identifier, or `"UTC"` when ECMA-402 §6.5 names it as one that resolves to `"UTC"`. */
function utcByName(id: string): string {
  return RESOLVE_TO_UTC.has(id) ? "UTC" : id;
}

/**
 * Whether two zoned values are in the same time zone by TC39 TimeZoneEquals: the same
 * identifier, or two identifiers with one primary identifier (`UTC` and `Etc/UTC`,
 * `Asia/Kolkata` and `Asia/Calcutta`).
 *
 * The polyfill's `ZonedDateTime#equals` answers it, except where probe D19 fails: there the
 * polyfill cannot find a non-primary identifier's primary. GMT then resolves the names ECMA-402
 * §6.5 sends to `"UTC"` itself, which needs no time zone data, and asks the host's own `Temporal`
 * for any other pair. With no host `Temporal` (Safari 27) the polyfill's answer stands for the
 * IANA links such as `Asia/Calcutta`: no Intl API there names their primary identifier
 * (temporalCompat README, D19).
 *
 * @param one a zoned value
 * @param two a zoned value
 * @returns true when the two time zones are one
 */
export function timeZoneEquals(
  one: Temporal.ZonedDateTime,
  two: Temporal.ZonedDateTime,
): boolean {
  const { timeZoneId: a } = one;
  const { timeZoneId: b } = two;
  if (a === b) return true;
  const byPolyfill = (): boolean =>
    new Temporal.ZonedDateTime(0n, a).equals(new Temporal.ZonedDateTime(0n, b));
  if (!isTimeZoneEqualsCompatNeeded()) return byPolyfill();
  if (utcByName(a) === utcByName(b)) return true;
  return timeZoneEqualsByHost(hostTemporal(), a, b) ?? byPolyfill();
}
