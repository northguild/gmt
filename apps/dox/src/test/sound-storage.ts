/**
 * Sound records for tests, saved the way `writeSound` saves them. Sound is opt-in, so a test that
 * needs to hear anything stands for a reader who has turned it on: `saveSound()` is unmuted
 * unless `fields` says otherwise.
 */
import { SOUND_KEY, SOUND_VERSION } from "../lib/sound/settings";

export function saveSound(fields: Record<string, unknown> = {}): void {
  localStorage.setItem(
    SOUND_KEY,
    JSON.stringify({ v: SOUND_VERSION, muted: false, ...fields }),
  );
}
