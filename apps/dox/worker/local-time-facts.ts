/**
 * What the library says about one wall-clock time in one zone, in words the model can repeat.
 *
 * The documentation cannot answer "does 03:30 exist on that date in that zone?": it names a few
 * example zones, and whether a zone skips or repeats a time depends on its rules for that year.
 * A model asked from memory guessed, and told readers that a time which never happens was an
 * ordinary one. So the DST tool's server step asks the library (`classifyLocal`, `resolveLocal`,
 * `getTimeZoneOffset`) and hands the verdict back as the tool result, where the model's next
 * step reads it before it writes the answer.
 *
 * Pure, no I/O. A zone or date-time the library cannot read gives `null`, never a guess.
 */
import { classifyLocal, resolveLocal } from "@northguild/gmt/instant/convert";
import {
  convertUtcToPlainDateTime,
  convertUtcToUnix,
} from "@northguild/gmt/utc/convert";
import {
  getDstTransitions,
  getTimeZoneOffset,
} from "@northguild/gmt/zoned/get";

interface LocalTimeFacts {
  /** The library's word for the wall time: it happens once, twice, or not at all. */
  kind: "unique" | "ambiguous" | "nonexistent";
  /** One plain sentence per fact, each safe to repeat to the reader. */
  facts: string[];
}

/** One reading of the wall time: the UTC instant and the offset it carries. */
function reading(zone: string, instant: string): string {
  return `${instant} (offset ${getTimeZoneOffset(zone, instant)})`;
}

/**
 * What the zone's clocks show at an instant, as a person reads it, with the date first when it is
 * not the date of the wall time asked about (a skipped day).
 */
function shown(zone: string, instant: string, local: string): string {
  const plain = convertUtcToPlainDateTime(instant, { timeZone: zone });
  return clockReading(plain, plain.slice(0, 10) !== local.slice(0, 10));
}

const ONE_DAY_MS = 86_400_000;

/**
 * A plain date-time as a person reads it: `HH:MM`, or `HH:MM:SS` when the seconds are not zero
 * (a change away from local mean time lands on odd seconds), with the date first when `withDate`.
 */
function clockReading(plain: string, withDate: boolean): string {
  const [date, time] = plain.split("T");
  const hms = time!.slice(0, 8);
  const shown = hms.endsWith(":00") ? hms.slice(0, 5) : hms;
  return withDate ? `${date} ${shown}` : shown;
}

/**
 * The clock change that makes a wall time skipped or repeated, in the words a person says it:
 * "when the clock reads 03:00 it moves to 04:00". It is the change within a day of the time's
 * earlier reading, found by the library; empty when none is, so the sentence is never invented.
 * The years either side are searched too, because a change on 31 December UTC can skip or repeat
 * a wall time on 1 January, and the reverse. When the change crosses a date (a skipped or repeated
 * day), both readings carry their dates, so "00:00 moves to 00:00" is never said.
 */
function clockChangeFact(
  zone: string,
  local: string,
  earlier: string,
): string[] {
  const year = Number(local.slice(0, 4));
  const anchor = convertUtcToUnix(earlier);
  if (anchor === null) return [];
  const near = [year - 1, year, year + 1]
    .flatMap((y) => getDstTransitions(zone, y))
    .find((t) => {
      const at = convertUtcToUnix(t.instant);
      return at !== null && Math.abs(at - anchor) <= ONE_DAY_MS;
    });
  if (!near) return [];
  const beforePlain = convertUtcToPlainDateTime(near.instant, {
    timeZone: near.offsetBefore,
  });
  const afterPlain = convertUtcToPlainDateTime(near.instant, {
    timeZone: near.offsetAfter,
  });
  const [date] = beforePlain.split("T");
  const crossesDate = date !== afterPlain.split("T")[0];
  return [
    `On ${date} the clocks in ${zone} change from ${near.offsetBefore} to ${near.offsetAfter}: when the clock reads ${clockReading(beforePlain, crossesDate)} it moves to ${clockReading(afterPlain, crossesDate)}.`,
  ];
}

/**
 * @param local A zoneless ISO date-time, for example `2027-03-28T03:30:00`.
 * @param zone The IANA zone the wall time is read in.
 */
export function localTimeFacts(
  local: string,
  zone: string,
): LocalTimeFacts | null {
  const kind = classifyLocal(local, zone);
  if (kind === null) return null;

  const earlier = resolveLocal(local, zone, { disambiguation: "earlier" });
  const later = resolveLocal(local, zone, { disambiguation: "later" });
  // `reject` returns "" for a time that is not unique, so a "" here for a unique
  // time would mean the library could not place it: say nothing rather than guess.
  if (earlier === "" || later === "") return null;

  if (kind === "unique") {
    return {
      kind,
      facts: [
        `${local} in ${zone} happens once, at ${reading(zone, earlier)}.`,
      ],
    };
  }
  if (kind === "nonexistent") {
    // Read with the offset in force before the change, the wall time lands after the gap (the
    // later instant); read with the offset after it, before the gap (the earlier instant). So the
    // earlier instant carries the before-change offset, and the later one the after-change offset.
    const before = getTimeZoneOffset(zone, earlier);
    const after = getTimeZoneOffset(zone, later);
    return {
      kind,
      facts: [
        `${local} does not exist in ${zone}: the clocks skip it, so no instant has that wall time.`,
        ...clockChangeFact(zone, local, earlier),
        `Read with the offset from before the change (${before}), it is ${later}, when the clocks there show ${shown(zone, later, local)}; read with the offset from after the change (${after}), it is ${earlier}, when they show ${shown(zone, earlier, local)}.`,
        `GMT's default disambiguation, "compatible", gives the later instant, ${later}, as Temporal does; "later" gives the same, "earlier" gives ${earlier}, and "reject" gives "".`,
      ],
    };
  }
  return {
    kind,
    facts: [
      `${local} in ${zone} happens twice: the clocks go back over it, so the wall time is shown two times.`,
      ...clockChangeFact(zone, local, earlier),
      `The first time is ${reading(zone, earlier)}; the second time is ${reading(zone, later)}.`,
      `GMT's default disambiguation, "compatible", gives the first, ${earlier}, as Temporal does; "earlier" gives the same, "later" gives ${later}, and "reject" gives "".`,
    ],
  };
}
