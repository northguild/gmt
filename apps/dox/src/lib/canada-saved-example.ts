/**
 * The worked example at the top of the saved-times check: a 9:00 meeting in Vancouver on 15
 * November 2026, saved before the change. The new offset is the reference fact for Vancouver in
 * `PROBE_ZONES` (its offset under tzdb 2026e); the old offset is that fact less the hour the
 * clocks used to turn back. `savedExample` does the rest, so the page states no tz data of its
 * own.
 */
import { PROBE_ZONES, STORED_ZONES } from "./canada-clock-change";
import { savedExample } from "./clock-change-stored";
import type { StoredConfig } from "./clock-change-stored";
import { withBase } from "./site";

const ZONE = "America/Vancouver";
const fact = PROBE_ZONES.find((f) => f.zone === ZONE);
if (fact === undefined) throw new Error(`No reference fact for ${ZONE}.`);

export const SAVED_EXAMPLE = savedExample(
  { zone: ZONE, offset: fact.offset, savedShiftMinutes: -60 },
  "2026-11-15T09:00:00",
);

/** What the textarea holds on load and after "Reset example": one moved, three that are fine or moved by a different zone. */
export const STORED_EXAMPLE = [
  "2026-11-15T09:00:00-08:00[America/Vancouver]",
  "2026-11-15T09:00:00-07:00[America/Vancouver]",
  "2026-11-15T09:00:00-05:00[America/Toronto]",
  "2026-12-01T18:00:00-06:00[America/Winnipeg]",
].join("\n");

/** The saved-events section's settings for Canada; the page and the chat add their `idPrefix`. */
export const CANADA_STORED: Omit<StoredConfig, "idPrefix"> = {
  endpoint: withBase("/api/canada-clock-change"),
  zones: STORED_ZONES,
  preset: STORED_EXAMPLE,
  example: SAVED_EXAMPLE,
};
