/**
 * What the presenter view shows of the deck: the current slide and its builds, what the next press
 * of Next shows, the notes and the position line. The slides are rendered on the page as a hidden
 * source (`[data-presenter-source]`, from `Deck.astro`); this copies a slide and its notes out of
 * it, without ids. A slide is shown as the room sees it: laid out on a 1920x1080 stage
 * (`PREVIEW_STAGE`) and scaled into its frame (`.gmt-stage-fit`, `slides.css`).
 */
import { mountBuildStacks } from "./build-stack";
import { createDeck, type Deck } from "./deck";
import { deckSlides, type DeckPart } from "./deck-parts";
import type { PresenterElements } from "./presenter-elements";

/** The room's stage, where no `rem` floor binds: every preview is laid out at this size. */
const PREVIEW_STAGE = { width: 1920, height: 1080 } as const;

/** Pieces a copy cannot draw: a canvas has no pixels, and the wall's figures sit over the space layer. */
const UNDRAWN = "[data-wall-figures], canvas, video, iframe";

/** The name a stand-in plate shows: the piece's own accessible name. */
function plateName(piece: Element): string {
  const named =
    piece.getAttribute("aria-label") ??
    piece.querySelector("figcaption")?.textContent;
  return named?.replace(/\s+/g, " ").trim() || "Live piece";
}

/**
 * A stand-in for a piece the copy cannot draw: the piece's own box (its element and class, and its
 * children as empty boxes) with its name over it, so the text around it lays out as on the stage.
 */
function plateFor(piece: Element): HTMLElement {
  const doc = piece.ownerDocument;
  const box = (like: Element): HTMLElement => {
    const el = doc.createElement("div");
    el.className = like.className;
    return el;
  };
  const plate = box(piece);
  plate.setAttribute("data-plate", "");
  for (const child of piece.children) plate.append(box(child));
  const name = doc.createElement("span");
  name.textContent = plateName(piece);
  plate.append(name);
  return plate;
}

/** Drops every id and the `aria-labelledby` that points at one: safe beside the source. */
function withoutIds(copy: HTMLElement): void {
  for (const el of [
    copy,
    ...copy.querySelectorAll<HTMLElement>("[id], [aria-labelledby]"),
  ]) {
    el.removeAttribute("id");
    el.removeAttribute("aria-labelledby");
  }
}

/** Shows the builds up to `build`: the stage's own rule hides the rest. */
function reachBuilds(copy: HTMLElement, part: DeckPart, build: number): void {
  copy.querySelectorAll<HTMLElement>("[data-build]").forEach((el, i) => {
    const reached = (part.builds[i]?.n ?? 1) <= build;
    el.dataset["reached"] = String(reached);
    el.inert = !reached;
  });
}

/**
 * One slide at one build, ready to drop into a frame: a fit box (`.gmt-stage-fit`, laid out at
 * `PREVIEW_STAGE`) that holds a copy with no ids, notes, scripts or islands, and a plate where a
 * piece cannot be drawn. `[data-slide-stage]` is what the stage's rules match. The preview is
 * hidden from assistive technology and inert: the position line names the slide and build.
 */
export function slidePreview(part: DeckPart, build: number): HTMLElement {
  const doc = part.el.ownerDocument;
  const copy = part.el.cloneNode(true) as HTMLElement;
  for (const gone of copy.querySelectorAll("[data-notes], script, link"))
    gone.remove();
  for (const island of copy.querySelectorAll("astro-island")) {
    island.querySelector("template")?.remove();
    // A box-less holder, so the room's island and its stand-in can both be left out of a measure.
    const live = doc.createElement("span");
    live.setAttribute("data-live", "");
    live.style.display = "contents";
    live.append(...island.childNodes);
    island.replaceWith(live);
  }
  for (const piece of copy.querySelectorAll(UNDRAWN))
    piece.replaceWith(plateFor(piece));
  withoutIds(copy);
  copy.setAttribute("data-shown", "");
  reachBuilds(copy, part, build);

  const fit = doc.createElement("div");
  fit.className = "gmt-stage-fit";
  fit.setAttribute("data-slide-stage", "");
  fit.setAttribute("aria-hidden", "true");
  fit.inert = true;
  fit.style.setProperty("--gmt-fit-w", `${PREVIEW_STAGE.width}px`);
  fit.style.setProperty("--gmt-fit-h", `${PREVIEW_STAGE.height}px`);
  fit.append(copy);
  return fit;
}

/** What one press of Next shows: a slide at a build, or the end. */
type NextState =
  | { part: DeckPart; build: number; label: string }
  | { part: null; label: string };

/**
 * The state after one press of Next from `slide` at `build`, and the label above it. The slide a
 * press reaches is the deck controller's own answer, so a spare and the last slide read as they act.
 */
export function nextState(
  parts: readonly DeckPart[],
  deck: Pick<Deck, "neighbour">,
  slide: number,
  build: number,
): NextState {
  const part = parts[slide];
  if (part && build < part.buildCount)
    return {
      part,
      build: build + 1,
      label: `Next: build ${build + 1} of ${part.buildCount}`,
    };
  const to = deck.neighbour(slide, 1);
  const after = to === null ? undefined : parts[to];
  if (to !== null && after)
    return {
      part: after,
      build: 0,
      label: `Next: slide ${to + 1} of ${parts.length}, ${after.title}`,
    };
  return { part: null, label: "End of the deck" };
}

/** The speaker notes as nodes: the notes' own heading is dropped, the page has one. */
function notesCopy(part: DeckPart): Node[] {
  const notes = part.el.querySelector<HTMLElement>("[data-notes]");
  if (!notes) return [];
  const copy = notes.cloneNode(true) as HTMLElement;
  copy.querySelector("h3")?.remove();
  for (const el of copy.querySelectorAll("[id]")) el.removeAttribute("id");
  return Array.from(copy.childNodes);
}

/**
 * Shows slide `slide` at `build`; the slide and notes are redrawn only when the slide changes. A
 * build stack in a preview slides as it does in the room (`build-stack.ts`) until `signal` aborts.
 */
export function createSlideView(
  parts: readonly DeckPart[],
  els: Pick<
    PresenterElements,
    "stage" | "position" | "notes" | "nextLabel" | "nextStage"
  >,
  signal?: AbortSignal,
): (shown: { slide: number; build: number; blanked: boolean }) => void {
  const { stage, position, notes, nextLabel, nextStage } = els;
  const deck = createDeck(deckSlides(parts));
  const stacks = new Map<HTMLElement, AbortController>();
  /** Puts `preview` in `host`, and has its stacks follow it until it is replaced. */
  const place = (host: HTMLElement, preview: HTMLElement): void => {
    stacks.get(host)?.abort();
    host.replaceChildren(preview);
    const own = new AbortController();
    stacks.set(host, own);
    const win = host.ownerDocument.defaultView;
    if (win)
      mountBuildStacks(preview, {
        signal: signal ? AbortSignal.any([signal, own.signal]) : own.signal,
        win,
      });
  };
  let shownSlide = -1;
  return ({ slide, build, blanked }) => {
    const part = parts[slide];
    if (!part) return;
    if (slide !== shownSlide) {
      shownSlide = slide;
      place(stage, slidePreview(part, build));
      notes.replaceChildren(...notesCopy(part));
      if (!notes.hasChildNodes())
        notes.textContent = "No notes for this slide.";
    } else {
      const copy = stage.querySelector<HTMLElement>("[data-slide]");
      if (copy) {
        reachBuilds(copy, part, build);
        stage.firstElementChild?.dispatchEvent(
          new CustomEvent("gmt-deck-state", { detail: { id: part.id, build } }),
        );
      }
    }
    const next = nextState(parts, deck, slide, build);
    nextLabel.textContent = next.label;
    if (next.part) place(nextStage, slidePreview(next.part, next.build));
    else {
      stacks.get(nextStage)?.abort();
      const end = nextStage.ownerDocument.createElement("p");
      end.setAttribute("data-plate", "");
      end.textContent = "No slide after this one";
      nextStage.replaceChildren(end);
    }
    position.textContent =
      `Slide ${slide + 1} of ${parts.length}: ${part.title}` +
      (part.buildCount > 0 ? `, build ${build} of ${part.buildCount}` : "") +
      (blanked ? ", screen blanked" : "");
  };
}
