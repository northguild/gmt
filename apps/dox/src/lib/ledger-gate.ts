/**
 * placeGate: puts a ledger gate (`ledgerGate`) at a percent of its track and writes its chip, then
 * lays out every visible gate of that track (`layoutGates`).
 *
 * A chip sits on the start side of its line and flips to the end side when it would run past the
 * track's far edge. Two chips that would touch go on separate rows, and a chip that still does not
 * fit is moved to stay inside the track. The track's width is read when this runs: a caller that
 * wants the chips re-placed on a width change draws again (`onWidthChange`), as the Free Time
 * Ledger and the Opening Hours Board do.
 */
import { layoutWidth, stackChips } from "./label-fit";

/** The gap between the gate's line and its chip, in pixels. */
const CHIP_OFFSET_PX = 10;

/** Most chip rows the ledger's stylesheet reserves. */
const MAX_ROWS = 3;

/** Every gate the track holds: the ledger's gate element carries `data-edge`. */
function gatesOf(track: HTMLElement): HTMLElement[] {
  return [...track.querySelectorAll<HTMLElement>("[data-edge]")];
}

/**
 * Sets each visible gate's side, row and shift. The track keeps one row for every gate it can
 * hold, however many are shown, so the chip strip never changes height while a reader drags.
 */
export function layoutGates(track: HTMLElement): void {
  const all = gatesOf(track);
  const gates = all.filter((g) => !g.hidden);
  const width = track.clientWidth;
  const rows = Math.min(MAX_ROWS, Math.max(1, all.length));
  if (width > 0 && gates.length > 0) {
    const placed = stackChips(
      gates.map((g) => ({
        atPx:
          (Number(g.style.getPropertyValue("--gmt-gate-at") || 0) / 100) *
          width,
        widthPx: layoutWidth(g.firstElementChild as HTMLElement),
      })),
      width,
      CHIP_OFFSET_PX,
    );
    gates.forEach((g, i) => {
      const p = placed[i]!;
      const row = Math.min(p.row, rows - 1);
      g.dataset["edge"] = p.edge;
      g.dataset["row"] = String(row);
      g.style.setProperty("--gmt-chip-shift", String(p.shiftPx));
    });
  } else {
    for (const g of gates) {
      g.dataset["edge"] = "start";
      g.dataset["row"] = "0";
      g.style.setProperty("--gmt-chip-shift", "0");
    }
  }
  track.dataset["gateRows"] = String(rows);
}

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
  layoutGates(track);
}
