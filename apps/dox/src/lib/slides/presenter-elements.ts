/** The presenter page's parts, found once: `null` when the page lacks any of them. */
import type { GmtReadout } from "~/widgets/primitives/readout/readout";

export interface PresenterElements {
  /** The hidden source the slides are rendered into (`Deck.astro`). */
  source: HTMLElement;
  stage: HTMLElement;
  position: HTMLElement;
  nextTitle: HTMLElement;
  nextBuild: HTMLElement;
  notes: HTMLElement;
  plan: HTMLElement;
  status: HTMLElement;
  rows: HTMLElement;
  elapsedOut: GmtReadout;
  paceOut: GmtReadout;
  timeOut: GmtReadout;
  demoOut: GmtReadout;
  paceCell: HTMLElement;
  startButton: HTMLButtonElement;
  resetButton: HTMLButtonElement;
  checkButton: HTMLButtonElement;
}

export function findPresenterElements(
  root: HTMLElement,
): PresenterElements | null {
  const find = <T extends Element>(selector: string): T | null =>
    root.querySelector<T>(selector);
  const readoutOf = (key: string): GmtReadout | null =>
    find<GmtReadout>(`[data-pv-cell="${key}"] gmt-readout`);
  const el = {
    source: root.ownerDocument.querySelector<HTMLElement>(
      "[data-presenter-source]",
    ),
    stage: find<HTMLElement>("[data-pv-stage]"),
    position: find<HTMLElement>("[data-pv-position]"),
    nextTitle: find<HTMLElement>("[data-pv-next-title]"),
    nextBuild: find<HTMLElement>("[data-pv-next-build]"),
    notes: find<HTMLElement>("[data-pv-notes]"),
    plan: find<HTMLElement>("[data-pv-plan]"),
    status: find<HTMLElement>("[data-pv-status]"),
    rows: find<HTMLElement>("[data-pv-readiness]"),
    elapsedOut: readoutOf("elapsed"),
    paceOut: readoutOf("pace"),
    timeOut: readoutOf("time"),
    demoOut: readoutOf("demo"),
    paceCell: find<HTMLElement>('[data-pv-cell="pace"]'),
    startButton: find<HTMLButtonElement>("#pv-start"),
    resetButton: find<HTMLButtonElement>("#pv-reset"),
    checkButton: find<HTMLButtonElement>("#pv-check"),
  };
  return Object.values(el).every((v) => v !== null)
    ? (el as PresenterElements)
    : null;
}
