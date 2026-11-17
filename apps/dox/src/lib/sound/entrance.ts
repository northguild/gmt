/**
 * The landing's entrance sounds: a Steel whisper (`paint`) as each piece freezes in, and a Steel
 * shing (`glint`) as the light crosses each metal sheet, each shing a touch higher than the last.
 *
 * The timing lives in the stylesheet (`gmt-entrance-freeze.css`) and is not restated here: each
 * sound plays on its animation's own `animationstart`. That covers the pieces that arm later than
 * `t0` (the globe's control stack once the globe is ready, the location card) and leaves out what
 * the CSS leaves out: a view-transition arrival's header, which does not freeze, and a page whose
 * entrance has ended. The copy is not heard: its freeze started at the first paint, before `t0`.
 * Reduced motion swaps every freeze for a plain fade and drops the glints; the sounds double the
 * freeze, so the whole entrance is silent then.
 *
 * Pieces that start in the same frame (a button's pane and its frost) make one sound: the events
 * of a frame are gathered and played from its animation-frame callback, which runs after them.
 *
 * Nothing plays unless the engine is running: a first visit (no gesture yet) is silent, and a
 * reader whose first press comes mid-entrance hears the rest of it from there.
 */
import { cue } from "./cue";

/** The animations that freeze, sweep or pop a piece in. */
const PAINTS = new Set([
  "ng-freeze",
  "ng-freeze-pane",
  "ng-freeze-text",
  "ng-frost",
  "ng-pop",
  "ng-sweep",
  "ng-sweep-text",
]);

/**
 * Pieces that come in on a motion shared with things that are not pieces: the pager fades as the
 * sky's layers do, and the carousel's first panel flies in as a later page turn does.
 */
const PAINTED_BY: Record<string, string> = {
  "ng-fade": ".gmt-hero-pager",
  "ng-freeze-fly-left": '[data-page][data-motion="load"]',
};

/** The light crossing a chip or a button. */
const GLINT = "ng-glint";

function kind(event: AnimationEvent): "paint" | "glint" | null {
  const name = event.animationName;
  if (name === GLINT) return "glint";
  if (PAINTS.has(name)) return "paint";
  const selector = PAINTED_BY[name];
  return selector !== undefined &&
    event.target instanceof Element &&
    event.target.matches(selector)
    ? "paint"
    : null;
}

/**
 * Listen for the entrance's animations while `root` is `data-entrance="run"`. Call it as `run` is
 * set; it returns the stop function, for when the entrance ends.
 */
export function entranceSounds(root: HTMLElement): () => void {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
    return () => {};
  const doc = root.ownerDocument;
  let paint = false;
  let glint = false;
  let rank = 0;
  let frame: number | undefined;
  const flush = () => {
    frame = undefined;
    if (paint) cue("paint");
    if (glint) cue("glint", rank++);
    paint = false;
    glint = false;
  };
  const onStart = (event: Event) => {
    if (root.dataset["entrance"] !== "run") return;
    const heard = kind(event as AnimationEvent);
    if (heard === "paint") paint = true;
    else if (heard === "glint") glint = true;
    else return;
    frame ??= requestAnimationFrame(flush);
  };
  doc.addEventListener("animationstart", onStart);
  return () => {
    doc.removeEventListener("animationstart", onStart);
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
  };
}
