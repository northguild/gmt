/**
 * The shared readout vocabulary for a zone reading — one set of rules for the
 * globe's on-canvas tooltip and the zone-clock list beside it.
 *
 * The two surfaces show the same four facts (zone, local time, UTC offset, DST
 * state) and used to agree on none of them: the list rendered time in cyan and
 * the offset in spring, the tooltip did the exact opposite, only the tooltip
 * mentioned DST at all, and neither showed the date. They drifted because
 * nothing held them together. This module is that thing, so the colour roles
 * and the day-shift call-out live in one place:
 *
 *   time    -> --gmt-cyan-ink     (blue)
 *   offset  -> --gmt-spring-ink   (green)
 *   DST     -> --gmt-dst-gold-ink (yellow, a "DST" badge)
 *
 * Every one of those is an `-ink` token, and that is not a style preference:
 * the bright base tokens are tuned to read as a *fill* or *border* (a 3:1 bar)
 * and their light-theme re-tints fall to ~2.5-3.7:1 once painted as `color:`,
 * under this site's 7:1 text floor. See design-system.md "Tokens".
 *
 * Amber (`--gmt-signal`) is deliberately absent. It is reserved site-wide for
 * the "no signal" sentinel state — its rarity is what makes it communicate —
 * so the DST yellow is `--gmt-dst-gold`, which already exists for exactly this
 * job in the DST inspector's gap badge.
 *
 * Pure: no DOM, no clock, and no `@js-temporal/polyfill`. Live values reach it
 * as a `ZoneReading` from `./zone-clock`, which is the only module allowed to
 * touch the polyfill.
 */

import { escapeHtml } from "./widget-ui";
import type { SkyState } from "./zone-sky";
import { SKY_ICON_PATHS, skyLabel } from "./zone-sky";
import type { ZoneReading } from "./zone-clock";

/** Where a zone's local day sits relative to the viewer's own local day. */
export type DayShift = "prev" | "same" | "next";

/** What daylight saving is doing in a zone right now. */
export type DstState = "dst" | "standard" | "none";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Day number for a proleptic Gregorian civil date, days since 1970-01-01.
 *
 * Hinnant's `days_from_civil`: shift the year to start in March so the leap day
 * lands at the end of it, then count 400-year eras, which are exactly 146097
 * days each. Integer arithmetic throughout, exact for every year this site will
 * ever render.
 *
 * Deliberately not `Date.UTC`. This repo bans the native `Date` outright
 * (`date-ban.test.ts`) and the ban is right here of all places: `Date.UTC`
 * takes a 0-based month, so the obvious `Date.UTC(y, m - 1, d)` is one
 * transcription slip away from reading May and meaning June — the exact
 * confusion GMT exists to remove, on the site that argues for removing it.
 */
function daysFromCivil(year: number, month: number, day: number): number {
  const y = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400;
  const dayOfYear =
    Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 +
    Math.floor(yearOfEra / 4) -
    Math.floor(yearOfEra / 100) +
    dayOfYear;
  return era * 146_097 + dayOfEra - 719_468;
}

/**
 * Signed whole-day difference between two `YYYY-MM-DD` **wall** dates.
 *
 * Both arguments are already-localized wall dates, so there is no zone
 * arithmetic to do here — this is pure calendar counting, and it never sees an
 * instant. Returns 0 for anything unparseable, which is the quiet answer: a
 * malformed date should not paint a row as day-shifted.
 */
export function dayDelta(zoneDate: string, viewerDate: string): number {
  const dayNumber = (value: string): number | null => {
    const match = DATE_PATTERN.exec(value);
    if (!match) return null;
    const [, year, month, day] = match;
    return daysFromCivil(Number(year), Number(month), Number(day));
  };
  const a = dayNumber(zoneDate);
  const b = dayNumber(viewerDate);
  if (a === null || b === null) return 0;
  return a - b;
}

/**
 * `dayDelta` clamped to the three states a card can paint.
 *
 * Clamped rather than assumed: the IANA offset range runs from UTC-12 to
 * UTC+14, a 26-hour spread, so a viewer just past midnight at UTC+14 and a zone
 * at UTC-12 are *two* calendar days apart, not one. A naive ±1 check would fall
 * through to "same day" for precisely the pair that differs most.
 */
export function dayShift(zoneDate: string, viewerDate: string): DayShift {
  const delta = dayDelta(zoneDate, viewerDate);
  if (delta <= -1) return "prev";
  if (delta >= 1) return "next";
  return "same";
}

/** The three-way DST state of a reading. A zone that never observes DST is
 *  `"none"` and draws no glyph at all — the absence is the signal, and it keeps
 *  roughly half the list free of icon noise. */
export function dstState(reading: ZoneReading): DstState {
  if (!reading.observesDst) return "none";
  return reading.inDst ? "dst" : "standard";
}

/**
 * Long-form label for a day difference, for the tooltip and for assistive tech.
 *
 * Takes the signed `dayDelta`, not the clamped `DayShift`, because the two are
 * not the same number. Three buckets is the right model for *filtering* — you
 * either want the days that are not yours or you don't — but it is the wrong
 * thing to read out: at the extremes of the offset range a zone really is two
 * calendar days away, and "Yesterday" printed beside a date two days back is
 * simply false. Kiritimati (UTC+14) and Midway (UTC−11) are 25 hours apart, so
 * this is reachable for about an hour a day, and the label is the only channel
 * a screen-reader user gets.
 */
export function dayShiftLabel(delta: number): string {
  if (delta === 0) return "Today";
  if (delta === -1) return "Yesterday";
  if (delta === 1) return "Tomorrow";
  return `${Math.abs(delta)} days ${delta < 0 ? "behind" : "ahead"}`;
}

/** Compact label for a day difference, for the dense clock list. Zero has none
 *  — the overwhelmingly common case earns no ink. */
export function dayShiftChip(delta: number): string {
  if (delta === 0) return "";
  return `${delta < 0 ? "−" : "+"}${Math.abs(delta)}d`;
}

/**
 * The mark a row carries when a zone is on daylight saving: the three letters,
 * not a glyph.
 *
 * It was a sun, and a sun was wrong here in a way worth recording. DST is a
 * property of the *clock* — this zone's offset is currently shifted ahead of
 * its own standard offset — and says nothing about the sky: a zone is in DST at
 * midnight just as much as at noon. Worse, this list sits beside a globe that
 * draws a real day/night terminator and turns its markers `--gmt-globe-gold` on
 * the dark side, "like the city lights in an Earth-at-night photograph". So
 * gold already meant *night* on the canvas while a gold sun meant *DST* in the
 * panel beside it, and the sun read as "it is daytime here" before it read as
 * anything else.
 *
 * Text instead, matching the vocabulary the site already settled on: the DST
 * Inspector marks transitions with `Gap` / `Overlap` badges (`.gmt-dst-badge`),
 * not icons. `standard` and `none` draw nothing — whether a zone is on summer
 * time *now* is what earns room in a dense row; whether it ever could is what
 * the filter is for.
 *
 * Sun and moon are left free for daylight, the one thing they honestly mean,
 * and which the globe already computes.
 */
export function dstBadge(state: DstState): string {
  return state === "dst" ? "DST" : "";
}

/** Long-form DST wording, for the tooltip's meta line. */
export function dstLabel(state: DstState): string {
  if (state === "dst") return "in DST";
  if (state === "standard") return "standard time";
  return "no DST";
}

/**
 * The globe tooltip's full inner HTML.
 *
 * Built here rather than in `globe.ts` so it can be tested at all: the globe
 * cannot mount under jsdom (no canvas, no WebGPU), so every assertion about
 * what the tooltip says has to run against a pure string builder.
 *
 * `viewerDate` is the viewer's own local `YYYY-MM-DD`; pass `""` to suppress
 * the day-shift line entirely.
 */
export function renderZoneTooltip(
  reading: ZoneReading,
  viewerDate: string,
  sky?: SkyState,
): string {
  const zone = `<span class="gmt-globe-tooltip-zone">${escapeHtml(reading.id)}</span>`;
  if (!reading.ok) {
    return (
      zone +
      `<span class="gmt-signal-lost">⟨ NO SIGNAL — zone unavailable ⟩</span>`
    );
  }
  const delta = viewerDate ? dayDelta(reading.date, viewerDate) : 0;
  const shift = viewerDate ? dayShift(reading.date, viewerDate) : "same";
  const state = dstState(reading);
  /* Whether the sun is up where this zone is — the globe is already drawing it
     as the terminator behind the tooltip, and both read the same subsolar
     point, so the words and the picture cannot disagree. Omitted when the
     caller has no coordinate for the zone. */
  const skyLine = sky
    ? `<span class="gmt-globe-tooltip-sky" data-sky="${sky}">` +
      `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">${SKY_ICON_PATHS[sky]}</svg>` +
      `<span>${skyLabel(sky)}</span></span>`
    : "";
  /* `data-shift` rather than a modifier class: the direction is a state hook
     for tests and future styling, not something this sheet paints by itself —
     the colour lives on the word inside. Same shape as `data-dst` below. */
  const dateLine =
    shift === "same"
      ? `<span class="gmt-globe-tooltip-date">${reading.date}</span>`
      : `<span class="gmt-globe-tooltip-date" data-shift="${shift}">` +
        `<span class="gmt-globe-tooltip-shift">${dayShiftLabel(delta)}</span>` +
        ` · ${reading.date}</span>`;
  return (
    zone +
    `<span class="gmt-globe-tooltip-time">${reading.time}</span>` +
    dateLine +
    skyLine +
    `<span class="gmt-globe-tooltip-meta" data-dst="${state}">` +
    `<span class="gmt-globe-tooltip-offset">UTC${reading.offset}</span>` +
    ` · <span class="gmt-globe-tooltip-dst">${dstLabel(state)}</span></span>`
  );
}
