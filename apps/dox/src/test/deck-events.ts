/**
 * Fixtures for the slide deck's own events and its slides' markup. The deck announces where it is
 * (`gmt-deck-state`) and what a lapse shows (`gmt-lapse`) as events on its root, and its visuals are
 * read by the data they carry; none of that is a person's click, so the tests reach it here.
 */
import { writeDeckState } from "~/lib/slides/deck-state";

/** Moves the deck's recorded state and announces it, as `deck-mount` does. */
export function sendDeckState(
  root: HTMLElement,
  id: string,
  build: number,
): void {
  writeDeckState(root, { id, build });
  root.dispatchEvent(
    new CustomEvent("gmt-deck-state", { detail: { id, build } }),
  );
}

/** Marks the stage busy, or says it is idle again, as the stage does around its motion. */
export function sendStageBusy(root: HTMLElement, busy: boolean): void {
  if (busy) {
    root.setAttribute("data-stage-busy", "");
    return;
  }
  root.removeAttribute("data-stage-busy");
  root.dispatchEvent(new CustomEvent("gmt-stage-idle"));
}

/** Announces a lapse frame, as the stage does. */
export function sendLapse(root: HTMLElement, detail: object): void {
  root.dispatchEvent(new CustomEvent("gmt-lapse", { detail }));
}

/** The `detail` of every `name` event the root receives from now on. */
export function recordEvents<T>(root: HTMLElement, name: string): T[] {
  const seen: T[] = [];
  root.addEventListener(name, (event) =>
    seen.push((event as CustomEvent<T>).detail),
  );
  return seen;
}

export const pick = <T extends HTMLElement = HTMLElement>(
  root: ParentNode,
  selector: string,
): T | null => root.querySelector<T>(selector);

export const pickAll = <T extends HTMLElement = HTMLElement>(
  root: ParentNode,
  selector: string,
): T[] => Array.from(root.querySelectorAll<T>(selector));

export const textOf = (el: Element | null): string => el?.textContent ?? "";

export const dataOf = (
  el: HTMLElement | null,
  key: string,
): string | undefined => el?.dataset[key];

/** The deck's root element on the page. */
export const deckRoot = (): HTMLElement =>
  document.body.querySelector<HTMLElement>("[data-deck-root]")!;

export const recordLapses = (
  root: HTMLElement,
): Array<{ name: string; dates: Record<string, string> }> =>
  recordEvents(root, "gmt-lapse");

export const recordDeckStates = (
  root: HTMLElement,
): Array<{ id: string; build: number }> => recordEvents(root, "gmt-deck-state");
