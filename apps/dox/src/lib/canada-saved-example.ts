/**
 * The worked example at the top of the saved-times check: a 9:00 meeting in Vancouver on 15
 * November 2026, saved before the change. Every value is derived from the reference fact for
 * Vancouver in `PROBE_ZONES` (its offset under tzdb 2026e), so the page states no tz data of its
 * own: the new offset is the fact, the old offset is that fact less the hour the clocks used to
 * turn back, and the time the old value now shows is the old instant read at the new offset.
 */
import { PROBE_ZONES, cityOf } from "./canada-clock-change";

const ZONE = "America/Vancouver";
const WALL = "2026-11-15T09:00:00";
const fact = PROBE_ZONES.find((f) => f.zone === ZONE);
if (fact === undefined) throw new Error(`No reference fact for ${ZONE}.`);

const minutesOf = (offset: string): number =>
  (offset.startsWith("-") ? -1 : 1) *
  (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(4, 6)));
const pad = (n: number): string => String(n).padStart(2, "0");
const offsetOf = (minutes: number): string =>
  `${minutes < 0 ? "-" : "+"}${pad(Math.floor(Math.abs(minutes) / 60))}:${pad(Math.abs(minutes) % 60)}`;
const hmOf = (minutes: number): string =>
  `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

const wallMinutes = 9 * 60;
const newMinutes = minutesOf(fact.tzdb2026e);
const savedMinutes = newMinutes - 60;

export const SAVED_EXAMPLE = {
  zone: ZONE,
  city: cityOf(ZONE),
  /** `09:00`, the local time the meeting was booked for. */
  wallHm: hmOf(wallMinutes),
  /** The offset that applied when it was saved. */
  savedOffset: offsetOf(savedMinutes),
  /** The offset the place has now: the reference fact. */
  newOffset: fact.tzdb2026e,
  /** What the saved value shows now: the old instant read at the new offset. */
  shownHm: hmOf(wallMinutes - savedMinutes + newMinutes),
  /** The value as an app saved it. */
  saved: `${WALL}${offsetOf(savedMinutes)}[${ZONE}]`,
  /** The value that keeps 9:00 local. */
  fixed: `${WALL}${fact.tzdb2026e}[${ZONE}]`,
};
