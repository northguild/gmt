/**
 * The bug slides' own visuals, played as the deck reaches them: a terminal that replays a crash, a
 * split-flap board whose rows land on different dates, calendar pages a day apart, and the pages of a
 * calendar jump that drop out as a zone's clock crosses them. Each is plain markup that reads whole
 * without script; here it is reset when its slide is left and played when its slide and build are
 * reached. Under reduced motion each shows its end state at once.
 *
 * Kinds, by `data-visual`:
 * - `terminal`: types the text of `[data-type]` (from its `data-text`), then reveals `[data-after]`.
 * - `roll`: rolls each `[data-roll]` (to its `data-end`) in turn, marking it `data-landed`. A roll
 *   with `[data-tile]` children (a split-flap row) keeps one character per tile.
 * - `pages`: `data-active` while shown, so CSS plays the flip. With `data-zone`, each `[data-page]`
 *   (`data-date`, and `data-gap` for a date the zone never had) takes a `data-state` of `past`,
 *   `current`, `dropped` or `future` from that zone's local date in the `gmt-lapse` events.
 * - `rows`: a table whose `tr[data-row]` all arrive with the slide. Each row is `hidden` until then,
 *   `typing` while its `[data-type]` code types out (every row at once), then `done` with its result
 *   showing.
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

const clearTyped = (el: HTMLElement): void => {
  for (const t of all(el, "[data-type]")) t.textContent = "";
};

/** A terminal types its line, then shows what comes after. */
const terminal: VisualKind = {
  reset(el) {
    clearTyped(el);
    for (const a of all(el, "[data-after]")) a.hidden = true;
  },
  play(el, ctx) {
    const line = el.querySelector<HTMLElement>("[data-type]");
    const finish = (): void => {
      for (const a of all(el, "[data-after]")) a.hidden = false;
      el.dataset["ended"] = "true";
    };
    delete el.dataset["ended"];
    if (!line) {
      finish();
      return () => {};
    }
    return typeOut({
      el: line,
      text: line.dataset["text"] ?? "",
      win: ctx.win,
      reduced: ctx.reduced,
      done: finish,
    });
  },
};

/** A roll lands each of its counters in turn. */
const roll: VisualKind = {
  reset(el) {
    for (const r of all(el, "[data-roll]")) {
      showText(r, "");
      delete r.dataset["landed"];
    }
  },
  play(el, ctx) {
    const rolls = all(el, "[data-roll]");
    let stop = (): void => {};
    const next = (i: number): void => {
      const r = rolls[i];
      if (!r) return;
      stop = rollText({
        el: r,
        end: r.dataset["end"] ?? "",
        win: ctx.win,
        reduced: ctx.reduced,
        done: () => {
          r.dataset["landed"] = "true";
          next(i + 1);
        },
      });
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

/** A table's rows all type their code at once, each marked done as it lands. */
const rows: VisualKind = {
  reset(el) {
    clearTyped(el);
    for (const row of all(el, "[data-row]")) row.dataset["state"] = "hidden";
  },
  play(el, ctx) {
    const typing = all(el, "[data-row]").map((row) => {
      row.dataset["state"] = "typing";
      const code = row.querySelector<HTMLElement>("[data-type]");
      const done = (): void => {
        row.dataset["state"] = "done";
      };
      if (!code) {
        done();
        return () => {};
      }
      return typeOut({
        el: code,
        text: code.dataset["text"] ?? "",
        win: ctx.win,
        reduced: ctx.reduced,
        done,
      });
    });
    return () => {
      for (const stop of typing) stop();
    };
  },
};

/** The kinds, by `data-visual`. A kind not listed is armed and marked active and does nothing more. */
const KINDS: Readonly<Record<string, VisualKind>> = {
  terminal,
  roll,
  pages,
  rows,
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
