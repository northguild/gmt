/** Helpers every adapter shares. None of them is under test: they only print what an adapter read. */
import { Temporal } from "@js-temporal/polyfill";

/** An adapter throws this when the library has no way to say the question. It is not a break. */
export class Unsupported extends Error {}

export const pad = (n, width = 2) => String(Math.abs(n)).padStart(width, "0");

/** "YYYY-MM-DDTHH:mm:ss" from fields the library gave. */
export const wallText = (y, mo, d, h, mi, s) =>
  `${y < 0 ? "-" : ""}${pad(y, 4)}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:${pad(s)}`;

/** "+HH:MM" or "+HH:MM:SS" from an offset in seconds. */
export const offsetText = (seconds) => {
  const sign = seconds < 0 ? "-" : "+";
  const a = Math.abs(seconds);
  const hms = [Math.floor(a / 3600), Math.floor((a % 3600) / 60), a % 60];
  return `${sign}${pad(hms[0])}:${pad(hms[1])}${hms[2] ? `:${pad(hms[2])}` : ""}`;
};

/** The wall fields and the offset (seconds) a library gave, as the shared answer. */
export const localText = (y, mo, d, h, mi, s, offsetSeconds) =>
  `${wallText(y, mo, d, h, mi, s)}${offsetText(offsetSeconds)}`;

/** Epoch milliseconds as "YYYY-MM-DDTHH:mm:ssZ". */
export const instantText = (ms) => {
  if (!Number.isFinite(ms)) return `not an instant: ${ms}`;
  return Temporal.Instant.fromEpochMilliseconds(ms).toString({
    smallestUnit: "second",
  });
};

/** Hours between two epoch milliseconds, as text. */
export const hoursText = (fromMs, toMs) => String((toMs - fromMs) / 3_600_000);

/** The date one calendar day after "YYYY-MM-DD", for adapters that need the next midnight. */
export const nextDate = (date) =>
  Temporal.PlainDate.from(date).add({ days: 1 }).toString();
