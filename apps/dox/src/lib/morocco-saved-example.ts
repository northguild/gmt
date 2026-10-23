/**
 * The worked example at the top of the saved-times check: a 9:00 appointment in Casablanca on 16
 * November 2026, saved before the change as `+01:00`. The new offset is the page's reference fact
 * (`MOROCCO_EXPECTED`, tzdb 2026c or later); the old offset is that fact plus the hour the clocks
 * used to be ahead; the time the old value now shows is the old instant read at the new offset.
 * The page states no tz data of its own.
 */
import { cityOf } from "./clock-change-common";
import type { StoredConfig } from "./clock-change-stored";
import {
  MOROCCO_EXPECTED,
  MOROCCO_PRESET,
  MOROCCO_STORED_ZONES,
} from "./morocco-clock-change";
import { withBase } from "./site";

const ZONE = "Africa/Casablanca";
const WALL = "2026-11-16T09:00:00";

const minutesOf = (offset: string): number =>
  (offset.startsWith("-") ? -1 : 1) *
  (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(4, 6)));
const pad = (n: number): string => String(n).padStart(2, "0");
const offsetOf = (minutes: number): string =>
  `${minutes < 0 ? "-" : "+"}${pad(Math.floor(Math.abs(minutes) / 60))}:${pad(Math.abs(minutes) % 60)}`;
const hmOf = (minutes: number): string =>
  `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

const wallMinutes = 9 * 60;
const newMinutes = minutesOf(MOROCCO_EXPECTED);
const savedMinutes = newMinutes + 60;

export const SAVED_EXAMPLE = {
  zone: ZONE,
  city: cityOf(ZONE),
  /** `09:00`, the local time the appointment was booked for. */
  wallHm: hmOf(wallMinutes),
  /** The date as the step says it. */
  dateText: "16 Nov",
  /** The offset that applied when it was saved. */
  savedOffset: offsetOf(savedMinutes),
  /** The offset the place has now: the reference fact. */
  newOffset: MOROCCO_EXPECTED,
  /** What the saved value shows now: the old instant read at the new offset. */
  shownHm: hmOf(wallMinutes - savedMinutes + newMinutes),
  /** The value as an app saved it. */
  saved: `${WALL}${offsetOf(savedMinutes)}[${ZONE}]`,
  /** The value that keeps 9:00 local. */
  fixed: `${WALL}${MOROCCO_EXPECTED}[${ZONE}]`,
};

/** What the textarea holds on load and after "Reset example". */
export const STORED_EXAMPLE: string = MOROCCO_PRESET;

/** The saved-events section's settings for Morocco; the page and the chat add their `idPrefix`. */
export const MOROCCO_STORED: Omit<StoredConfig, "idPrefix"> = {
  endpoint: withBase("/api/morocco-clock-change"),
  zones: MOROCCO_STORED_ZONES,
  preset: STORED_EXAMPLE,
  example: SAVED_EXAMPLE,
};
