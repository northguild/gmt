/**
 * Re-fire the shared sonar focus ping when an already-focused control is
 * activated again.
 *
 * The ping is a CSS animation on the `:focus` rule (`@keyframes gmt-focus-sonar`
 * / `gmt-tab-sonar`, gmt-primitives.css + gmt-content.css) and runs a single
 * iteration. That covers the common case — focus lands, the ring pings out once
 * — but a second click on a control that never lost focus produces no new
 * `:focus` transition, so the animation would not replay. This listener spots
 * that case and restarts it.
 *
 * The first ping is still the stylesheet's job; this only ever *re*-triggers.
 */

import { CODE_COPY_SELECTOR } from "~/lib/sound/code-copy";
import { cue } from "~/lib/sound/cue";
import { holdLink } from "~/lib/sound/link-hold";
import { watchSwitchCue } from "~/lib/sound/switch-cue";

const SONAR_SELECTOR = [
  ".gmt-sonar-focus",
  ".gmt-icon-button",
  ".expressive-code .copy button",
  ".sl-link-button",
  ".pagination-links a",
  '.sl-markdown-content .tab > [role="tab"]',
  // Streamdown's own controls inside the chat island (copy, fullscreen) — they
  // borrow .gmt-icon-button's look in gmt-primitives.css, so they get the
  // re-ping too. Copy is the one control on the page a reader plausibly clicks
  // twice in a row without ever moving focus.
  ".gmt-ask [data-streamdown] button",
].join(",");

/** What a press is, for the sound: every control that acts on the page, plus the ping's own set. */
const PRESS_SELECTOR = [
  "button",
  '[role="button"]',
  '[role="tab"]',
  "summary",
  "a[href]",
  '[role="link"]',
  SONAR_SELECTOR,
].join(",");

/**
 * A press that plays the Sonar ping: a link, which goes somewhere, and a button marked
 * `data-ping="sonar"` (the header's Settings gear, which sits among the header's links and sounds
 * like them). Every other press plays the Deep sonar.
 */
const LINK_SELECTOR = 'a[href], [role="link"], [data-ping="sonar"]';

/**
 * An `<a>` with no `href` is not a control: the header marks the page a reader is on that way (the
 * "gmt" mark on the home page, the Dox button on /dox). It keeps its look, so it can match
 * `SONAR_SELECTOR`, but a press on it plays nothing and re-pings nothing.
 */
const NOT_A_CONTROL = "a:not([href])";

function restartPing(el: HTMLElement): void {
  // Suppress the stylesheet animation, force the browser to register the
  // removal, then hand `animation` back to the `:focus` rule — the name flips
  // none -> gmt-focus-sonar and a fresh iteration starts.
  el.style.animation = "none";
  void el.offsetWidth;
  el.style.removeProperty("animation");
}

function onActivate(event: Event): void {
  const start = event.target as Element | null;
  const el = start?.closest<HTMLElement>(SONAR_SELECTOR);
  // Only replay for a control that is already focused — otherwise the incoming
  // `:focus` transition will ping on its own.
  if (el && el === document.activeElement && !el.matches(NOT_A_CONTROL)) {
    // A button that took focus quietly (the carousel hands it over) pings from its first press.
    el.removeAttribute("data-quiet-focus");
    restartPing(el);
  }
}

document.addEventListener("click", onActivate);

/**
 * A quiet focus hand-over that is still quiet. The re-ping above clears the mark on a focused
 * control it pings, so a real press on one of those counts; this runs before it, so it says so.
 */
function isQuietHandOver(el: HTMLElement): boolean {
  return (
    el.hasAttribute("data-quiet-focus") &&
    !(el === document.activeElement && el.matches(SONAR_SELECTOR))
  );
}

/**
 * The press cue. Focused or not, a press on a link plays the Sonar ping (`click`), and a press on
 * any other control the Deep sonar (`press`). A second press on a focused control, which re-pings
 * its ring, plays its kind's cue again. A link that goes to another page in this tab waits for
 * its ping before it goes (`sound/link-hold.ts`). Three presses stay silent: a control that fires
 * a cue of its own (`data-cue`, or a code block's copy button), a quiet focus hand-over, which is
 * focus and not a press, and an `<a>` with no `href`, which is not a control.
 */
function onPress(event: Event): void {
  // The dispatch path, not `target.closest`: a control that swaps its own icon in its handler
  // (the theme toggle) has detached the clicked node by the time a bubbling listener would run.
  const path = event
    .composedPath()
    .filter((node): node is HTMLElement => node instanceof HTMLElement);
  const el = path.find((node) => node.matches(PRESS_SELECTOR));
  if (!el || el.matches(NOT_A_CONTROL)) return;
  // A code block's copy button has its own cue (sound/code-copy.ts).
  if (path.some((node) => node.matches(CODE_COPY_SELECTOR))) return;
  if (
    path
      .slice(path.indexOf(el))
      .some((node) => node.hasAttribute("data-cue")) ||
    isQuietHandOver(el)
  )
    return;
  if (
    cue(el.matches(LINK_SELECTOR) ? "click" : "press") &&
    el instanceof HTMLAnchorElement &&
    event instanceof MouseEvent
  )
    holdLink(event, el);
}

// Capture phase: Starlight's Search button stops its click from bubbling, and a press on it is a
// press. Nothing here stops or changes the event, so the listeners after it see it as before.
document.addEventListener("click", onPress, { capture: true });

// A kit switch snaps on a reader's change; see switch-cue.ts.
watchSwitchCue();
