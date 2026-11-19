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
import { rollText, showText, typeOut, type Frames } from "./type-out";

export type PageState = "past" | "current" | "dropped" | "future";

/** The state of a page when the zone's local date is `now`. ISO dates compare as text. */
export function pageState(
  page: { date: string; gap: boolean },
  now: string,
): PageState {
  if (page.date === now) return "current";
  if (page.date > now) return "future";
  return page.gap ? "dropped" : "past";
}

type Win = Frames & {
  matchMedia?: (query: string) => { matches: boolean };
};

export function mountBugVisuals(
  root: HTMLElement,
  o: { signal: AbortSignal; win: Win },
): void {
  const reduced = (): boolean =>
    o.win.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const stops = new Map<HTMLElement, () => void>();
  const visuals = Array.from(
    root.querySelectorAll<HTMLElement>("[data-visual]"),
  );

  const reset = (el: HTMLElement): void => {
    stops.get(el)?.();
    stops.delete(el);
    delete el.dataset["active"];
    el.dataset["armed"] = "true";
    for (const t of el.querySelectorAll<HTMLElement>("[data-type]"))
      t.textContent = "";
    for (const a of el.querySelectorAll<HTMLElement>("[data-after]"))
      a.hidden = true;
    for (const r of el.querySelectorAll<HTMLElement>("[data-roll]")) {
      showText(r, "");
      delete r.dataset["landed"];
    }
    for (const p of el.querySelectorAll<HTMLElement>("[data-page]"))
      p.dataset["state"] = "future";
    for (const row of el.querySelectorAll<HTMLElement>("[data-row]"))
      row.dataset["state"] = "hidden";
  };

  const play = (el: HTMLElement): void => {
    const kind = el.dataset["visual"];
    el.dataset["active"] = "true";
    const isReduced = reduced();
    if (kind === "terminal") {
      const line = el.querySelector<HTMLElement>("[data-type]");
      const finish = (): void => {
        for (const a of el.querySelectorAll<HTMLElement>("[data-after]"))
          a.hidden = false;
        el.dataset["ended"] = "true";
      };
      delete el.dataset["ended"];
      if (line)
        stops.set(
          el,
          typeOut({
            el: line,
            text: line.dataset["text"] ?? "",
            win: o.win,
            reduced: isReduced,
            done: finish,
          }),
        );
      else finish();
    } else if (kind === "roll") {
      const rolls = Array.from(el.querySelectorAll<HTMLElement>("[data-roll]"));
      let stop = (): void => {};
      stops.set(el, () => stop());
      const next = (i: number): void => {
        const r = rolls[i];
        if (!r) return;
        stop = rollText({
          el: r,
          end: r.dataset["end"] ?? "",
          win: o.win,
          reduced: isReduced,
          done: () => {
            r.dataset["landed"] = "true";
            next(i + 1);
          },
        });
      };
      next(0);
    } else if (kind === "rows") {
      const typing = Array.from(
        el.querySelectorAll<HTMLElement>("[data-row]"),
        (row) => {
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
            win: o.win,
            reduced: isReduced,
            done,
          });
        },
      );
      stops.set(el, () => {
        for (const stop of typing) stop();
      });
    }
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
