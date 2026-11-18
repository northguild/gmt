/**
 * A step through a list, the one sound every list in the site shares: `listNext` going down the
 * list (or along a row), `listPrev` going back, pitched by how far down the list the step lands,
 * the way the globe's zoom is pitched by distance (`listServo` in `voices.ts`).
 *
 * The keys of a listbox, a combobox and a roving row step by row (`stepTo`), down or up as the key
 * goes, so a wrap from the last row to the first still sounds like the key pressed; a reader's own
 * scroll steps by the scroll's place (`scrollTicks`). A slider's step and a handle's arrow are not
 * lists: they keep `detent`.
 */

import { cue } from "./cue";

/**
 * Play one step, down when `down` is true, landing at `place` (0 at the top, 1 at the bottom).
 * A place outside 0..1, or none (a list with no length to scroll), is clamped to it.
 */
export function listStep(down: boolean, place: number): void {
  cue(down ? "listNext" : "listPrev", Math.min(1, Math.max(0, place)) || 0);
}

/** Play a key's step onto row `to` of `count`, down when the key goes down (or along a row). */
export function stepTo(down: boolean, to: number, count: number): void {
  listStep(down, count > 1 ? to / (count - 1) : 0);
}
