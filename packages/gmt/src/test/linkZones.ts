/**
 * Whether two identifiers of an IANA link pair (`Asia/Calcutta` and `Asia/Kolkata`,
 * `Europe/Kiev` and `Europe/Kyiv`) are one time zone on this host. It is the host's own
 * TimeZoneEquals answer, read without importing GMT so a bug in GMT cannot make a test agree with
 * itself:
 * - a host with a native `Temporal.ZonedDateTime` answers with its `equals`; otherwise
 * - an engine whose `Intl.DateTimeFormat#resolvedOptions` returns the primary identifier (V8,
 *   SpiderMonkey) resolves both names to one identifier; and
 * - an engine that returns the name as written (Safari 27 without Temporal) has two zones, so the
 *   answer is `false` (temporalCompat D19 limit).
 * `UTC` and `Etc/UTC` need no such oracle: GMT resolves them by name on every host.
 *
 * @param one an IANA identifier
 * @param two another identifier of the same zone
 * @returns true when the host treats them as one time zone
 */
export function linkPairIsOneZone(one: string, two: string): boolean {
  const native = (
    globalThis as {
      Temporal?: {
        ZonedDateTime?: new (
          epochNanoseconds: bigint,
          timeZone: string,
        ) => { equals(other: unknown): unknown };
      };
    }
  ).Temporal?.ZonedDateTime;
  if (typeof native === "function") {
    try {
      const answer = new native(0n, one).equals(new native(0n, two));
      if (typeof answer === "boolean") return answer;
    } catch {
      // fall through to the Intl read
    }
  }
  const resolve = (zone: string): string =>
    new Intl.DateTimeFormat("en-US", { timeZone: zone }).resolvedOptions()
      .timeZone;
  return resolve(one) === resolve(two);
}
