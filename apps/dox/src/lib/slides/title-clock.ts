/**
 * Reads a zone's wall time with gmt (imported after first paint), for the Earth clock: now
 * (`getZonedNow`) while it ticks the venue's time on the title slide and the close, or at a held
 * instant (`convertUtcToZoned`) on a build that stops it, as the GMT slide does either side of a
 * skipped hour.
 */
import { loadDeckGmt } from "./gmt-loader";

/** A wall time as hour, minute and second, with gmt's zoned string it was read from. */
export interface WallTime {
  hour: number;
  minute: number;
  second: number;
  /** Its date and offset are the zone's too. */
  zoned: string;
}

export interface Clock {
  /** The zone's wall time now, or `null` for a zone gmt rejects. */
  read(): WallTime | null;
  /** The zone's wall time at a UTC instant (`…Z`), or `null` for an instant or zone gmt rejects. */
  at(utc: string): WallTime | null;
  /** Milliseconds from now to just after the next whole second. */
  untilNextSecond(): number;
}

/** The wall time in a zoned string, or `null` for gmt's empty-string sentinel. */
function wallTime(zoned: string): WallTime | null {
  const m = /T(\d{2}):(\d{2}):(\d{2})/.exec(zoned);
  if (m === null) return null;
  return {
    hour: Number(m[1]),
    minute: Number(m[2]),
    second: Number(m[3]),
    zoned,
  };
}

/** The zone's clock once gmt has loaded, or `null` when it cannot load. */
export async function loadClock(zone: string): Promise<Clock | null> {
  try {
    const { unixGet, zonedGet, utcConvert } = await loadDeckGmt();
    return {
      read: () =>
        wallTime(zonedGet.getZonedNow(zone, { smallestUnit: "second" })),
      at: (instant) => wallTime(utcConvert.convertUtcToZoned(instant, zone)),
      untilNextSecond: () => 1000 - (unixGet.getUnixNow() % 1000) + 20,
    };
  } catch {
    return null;
  }
}
