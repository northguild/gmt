/**
 * The worked example at the top of the saved-times check: a 9:00 appointment in Casablanca on 16
 * November 2026, saved before the change as `+01:00`. The new offset is the page's reference fact
 * (`MOROCCO_FACTS`, tzdb 2026c or later); the old offset is that fact plus the hour the clocks
 * used to be ahead. `savedExample` does the rest, so the page states no tz data of its own.
 */
import { savedExample } from "./clock-change-stored";
import type { StoredConfig } from "./clock-change-stored";
import {
  MOROCCO_PRESET,
  MOROCCO_STORED_ZONES,
  expectedOffset,
} from "./morocco-clock-change";
import { withBase } from "./site";

const ZONE = "Africa/Casablanca";

export const SAVED_EXAMPLE = savedExample(
  { zone: ZONE, offset: expectedOffset(ZONE), savedShiftMinutes: 60 },
  "2026-11-16T09:00:00",
);

/** What the textarea holds on load and after "Reset example". */
export const STORED_EXAMPLE: string = MOROCCO_PRESET;

/** The saved-events section's settings for Morocco; the page and the chat add their `idPrefix`. */
export const MOROCCO_STORED: Omit<StoredConfig, "idPrefix"> = {
  endpoint: withBase("/api/morocco-clock-change"),
  zones: MOROCCO_STORED_ZONES,
  preset: STORED_EXAMPLE,
  example: SAVED_EXAMPLE,
};
