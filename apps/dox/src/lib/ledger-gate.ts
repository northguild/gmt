/**
 * placeGate: puts a ledger gate (`ledgerGate`) at a percent of its track and writes its chip.
 *
 * The chip sits on the start side of the line and flips to the end side when it would run past
 * the track's far edge (`placeLabel`). The track's width is read once, when this runs: a caller
 * that wants the chip re-placed on a width change draws again, as the Free Time Ledger does.
 */
import { layoutWidth, placeLabel } from "./label-fit";

/** The gap between the gate's line and its chip, in pixels. */
const CHIP_OFFSET_PX = 10;

export function placeGate(
  gate: HTMLElement,
  chip: HTMLElement,
  track: HTMLElement,
  percent: number,
  text: string,
): void {
  gate.hidden = false;
  gate.style.setProperty("--gmt-gate-at", String(percent));
  chip.textContent = text;
  gate.dataset["edge"] = "start";
  if (track.clientWidth > 0) {
    gate.dataset["edge"] = placeLabel({
      atPx: (percent / 100) * track.clientWidth,
      labelPx: layoutWidth(chip),
      trackPx: track.clientWidth,
      offsetPx: CHIP_OFFSET_PX,
    });
  }
}
