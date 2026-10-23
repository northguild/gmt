/**
 * The worked example at the top of the saved-times check: a meeting booked for `wall` in one zone
 * before the change. Every value is derived from that zone's reference fact (its offset under the
 * current tz data and the offset it had before), so the page states no tz data of its own: the
 * new offset is the fact, the saved offset is the fact's `oldOffset`, and the time the saved value
 * now shows is the saved instant read at the new offset.
 */
import { cityOf, type ProbeFact } from "./facts";

const minutesOf = (offset: string): number =>
  (offset.startsWith("-") ? -1 : 1) *
  (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(4, 6)));
const pad = (n: number): string => String(n).padStart(2, "0");
const hmOf = (minutes: number): string => {
  const day = ((minutes % 1440) + 1440) % 1440;
  return `${pad(Math.floor(day / 60))}:${pad(day % 60)}`;
};

export interface SavedExample {
  zone: string;
  city: string;
  /** `09:00`, the local time the meeting was booked for. */
  wallHm: string;
  /** The offset that applied when it was saved. */
  savedOffset: string;
  /** The offset the place has now: the reference fact. */
  newOffset: string;
  /** What the saved value shows now: the old instant read at the new offset. */
  shownHm: string;
  /** The value as an app saved it. */
  saved: string;
  /** The value that keeps the booked local time. */
  fixed: string;
}

/** `wall` is a plain date-time such as `2026-11-15T09:00:00`. */
export function savedExample(fact: ProbeFact, wall: string): SavedExample {
  const wallMinutes =
    Number(wall.slice(11, 13)) * 60 + Number(wall.slice(14, 16));
  const newMinutes = minutesOf(fact.offset);
  const savedMinutes = minutesOf(fact.oldOffset);
  return {
    zone: fact.zone,
    city: cityOf(fact.zone),
    wallHm: hmOf(wallMinutes),
    savedOffset: fact.oldOffset,
    newOffset: fact.offset,
    shownHm: hmOf(wallMinutes - savedMinutes + newMinutes),
    saved: `${wall}${fact.oldOffset}[${fact.zone}]`,
    fixed: `${wall}${fact.offset}[${fact.zone}]`,
  };
}
