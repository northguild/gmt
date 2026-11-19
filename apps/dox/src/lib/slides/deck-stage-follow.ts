/**
 * Tells the space stage (`stage.ts`) where the camera belongs on every change of state: the place
 * of the highest build reached that names one, else the slide's own; the time lapse and the filing
 * pins the same way. It also writes the deck's state for the slides' own visuals
 * (`deck-state.ts`).
 */
import { writeDeckState } from "./deck-state";
import type { DeckPart } from "./deck-parts";
import type { SpaceStage } from "./stage";

/** The value of `data-<name>` on the highest reached build that has one, else on the slide. */
function reached(
  part: DeckPart,
  build: number,
  name: string,
): string | undefined {
  let value = part.el.dataset[name];
  for (const b of part.builds)
    if (b.n <= build && b.el.dataset[name]) value = b.el.dataset[name];
  return value;
}

export function followStage(o: {
  root: HTMLElement;
  parts: readonly DeckPart[];
  space: SpaceStage;
  state: () => { slide: number; build: number };
}): (hop: boolean) => void {
  return (hop) => {
    const { slide, build } = o.state();
    const part = o.parts[slide];
    const place = reached(part, build, "place");
    if (place) o.space.goTo(place, { hop, at: { slide, build } });
    // Time moves inside a section: the highest reached build that names a lapse, else the slide's.
    o.space.lapse(reached(part, build, "lapse") || null);
    o.space.pinFilings(part.el.dataset["pins"] === "filings");
    // The slides' own visuals (`bug-visuals.ts`) play from this.
    writeDeckState(o.root, { id: part.id, build });
    o.root.dispatchEvent(
      new CustomEvent("gmt-deck-state", {
        detail: { slide, build, id: part.id },
      }),
    );
  };
}
