/**
 * The bug slides' own visuals, played as the deck reaches them: a recorded run whose code types out
 * before its answer shows (a split-flap board's rows land in it), calendar pages a day apart, and the
 * pages of a calendar jump that drop out as a zone's clock crosses them. Each is plain markup that reads whole
 * without script; here it is reset when its slide is left and played when its slide and build are
 * reached. Under reduced motion each shows its end state at once.
 *
 * Kinds, by `data-visual`:
 * - `run`: plays its `[data-after]`, `[data-type]` and `[data-roll]` parts in document order: shows,
 *   types (from `data-text`) or rolls (to `data-end`, one character per `[data-tile]` child when it
 *   has tiles), each after the one before it.
 * - `pages`: `data-active` while shown, so CSS plays the flip. With `data-zone`, each `[data-page]`
 *   (`data-date`, and `data-gap` for a date the zone never had) takes a `data-state` of `past`,
 *   `current`, `dropped` or `future` from that zone's local date in the `gmt-lapse` events.
 */
import { isActive, onDeckState, type DeckState } from "./deck-state";
import type { Frames } from "./frames";
import { prefersReducedMotion } from "~/lib/reduced-motion";
import { rollText, showText, typeOut } from "./type-out";

type PageState = "past" | "current" | "dropped" | "future";

/** The state of a page when the zone's local date is `now`. ISO dates compare as text. */
function pageState(
  page: { date: string; gap: boolean },
  now: string,
): PageState {
  if (page.date === now) return "current";
  if (page.date > now) return "future";
  return page.gap ? "dropped" : "past";
}

type Win = Frames & Partial<Pick<Window, "matchMedia">>;

/** What a visual's `play` is given. */
interface PlayContext {
  win: Win;
  reduced: boolean;
}

/** One kind of visual: how it goes back to its start, and how it plays (returns what stops it). */
interface VisualKind {
  reset(el: HTMLElement): void;
  play(el: HTMLElement, ctx: PlayContext): () => void;
}

const all = <T extends HTMLElement>(el: HTMLElement, selector: string): T[] =>
  Array.from(el.querySelectorAll<T>(selector));

/**
 * A run plays its parts in the order they are written: a `[data-after]` appears, a `[data-type]`
 * types its line out (`data-typing` while it does), and a `[data-roll]` rolls to its `data-end` and
 * is marked `data-landed`. A part waits for the one before it, so the code types before its answer
 * shows, and a split-flap board's rows land in turn. `data-ended` marks the run once it is through.
 */
const PARTS = "[data-after], [data-type], [data-roll]";

const run: VisualKind = {
  reset(el) {
    delete el.dataset["ended"];
    for (const part of all(el, PARTS)) {
      if (part.hasAttribute("data-after")) part.hidden = true;
      if (part.hasAttribute("data-type")) {
        part.textContent = "";
        delete part.dataset["typing"];
      }
      if (part.hasAttribute("data-roll")) {
        showText(part, "");
        delete part.dataset["landed"];
      }
    }
  },
  play(el, ctx) {
    const parts = all(el, PARTS);
    let stop = (): void => {};
    const next = (i: number): void => {
      const part = parts[i];
      if (!part) {
        el.dataset["ended"] = "true";
        return;
      }
      if (part.hasAttribute("data-after")) part.hidden = false;
      if (part.hasAttribute("data-type")) {
        part.dataset["typing"] = "true";
        stop = typeOut({
          el: part,
          text: part.dataset["text"] ?? "",
          win: ctx.win,
          reduced: ctx.reduced,
          done: () => {
            delete part.dataset["typing"];
            next(i + 1);
          },
        });
      } else if (part.hasAttribute("data-roll")) {
        stop = rollText({
          el: part,
          end: part.dataset["end"] ?? "",
          win: ctx.win,
          reduced: ctx.reduced,
          done: () => {
            part.dataset["landed"] = "true";
            next(i + 1);
          },
        });
      } else next(i + 1);
    };
    next(0);
    return () => stop();
  },
};

/** Pages flip in CSS on `data-active`; with a zone, the lapse's dates set each page's state. */
const pages: VisualKind = {
  reset(el) {
    for (const p of all(el, "[data-page]")) p.dataset["state"] = "future";
  },
  play: () => () => {},
};

/** The kinds, by `data-visual`. A kind not listed is armed and marked active and does nothing more. */
const KINDS: Readonly<Record<string, VisualKind>> = {
  run,
  pages,
};

const NONE: VisualKind = { reset: () => {}, play: () => () => {} };

const kindOf = (el: HTMLElement): VisualKind =>
  Object.hasOwn(KINDS, el.dataset["visual"] ?? "")
    ? KINDS[el.dataset["visual"]!]!
    : NONE;

export function mountBugVisuals(
  root: HTMLElement,
  o: { signal: AbortSignal; win: Win },
): void {
  const stops = new Map<HTMLElement, () => void>();
  const visuals = Array.from(
    root.querySelectorAll<HTMLElement>("[data-visual]"),
  );

  const reset = (el: HTMLElement): void => {
    stops.get(el)?.();
    stops.delete(el);
    delete el.dataset["active"];
    el.dataset["armed"] = "true";
    kindOf(el).reset(el);
  };

  const play = (el: HTMLElement): void => {
    el.dataset["active"] = "true";
    stops.set(
      el,
      kindOf(el).play(el, {
        win: o.win,
        reduced: prefersReducedMotion(o.win),
      }),
    );
  };

  const setActive = (el: HTMLElement, on: boolean): void => {
    const was = el.dataset["active"] === "true";
    if (on === was) return;
    if (on) play(el);
    else reset(el);
  };

  for (const el of visuals) reset(el);
  let last: DeckState | null = null;
  // While the stage's motion crosses the slides, a visual that arrives waits; the slide's text
  // waits too (`slides.css`), so the type-out starts when the words appear, not behind the motion.
  const busy = (): boolean => root.hasAttribute("data-stage-busy");
  const apply = (state: DeckState): void => {
    last = state;
    for (const el of visuals) {
      const on = isActive(el, state);
      if (on && el.dataset["active"] !== "true" && busy()) continue;
      setActive(el, on);
    }
  };
  onDeckState(root, o.signal, apply);
  root.addEventListener(
    "gmt-stage-idle",
    () => {
      if (last) apply(last);
    },
    { signal: o.signal },
  );

  root.addEventListener(
    "gmt-lapse",
    (event) => {
      const dates = (event as CustomEvent<{ dates?: Record<string, string> }>)
        .detail?.dates;
      if (!dates) return;
      for (const el of visuals) {
        const zone = el.dataset["zone"];
        const now = zone ? dates[zone] : undefined;
        if (!now || el.dataset["active"] !== "true") continue;
        for (const p of el.querySelectorAll<HTMLElement>("[data-page]"))
          p.dataset["state"] = pageState(
            { date: p.dataset["date"] ?? "", gap: p.dataset["gap"] === "true" },
            now,
          );
      }
    },
    { signal: o.signal },
  );
  o.signal.addEventListener("abort", () => {
    for (const stop of stops.values()) stop();
    stops.clear();
  });
}
