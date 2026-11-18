/**
 * A link's press waits for its ping. Every route change on this site is a full page load, which
 * ends the page's audio, so a link that leaves the page in this tab would cut its Sonar ping short.
 * When the ping was heard, the navigation is held for the ping and its first echo, then made.
 *
 * Only a plain press is held: a link another handler has taken (`preventDefault`), a press with a
 * modifier key or another button, a link that opens a new tab or downloads, a jump within the same
 * page, and a link that asks for no referrer are left to the browser as they were. A link that
 * opens a new tab needs no hold: the engine lets a hidden tab's sound finish (`engine.ts`).
 */

import { SONAR_ECHO, SONAR_PING } from "./sonar-lock";

/**
 * How long a held link waits, in ms: the ping and the whole of its first echo, which starts one
 * echo delay in and rings for the ping's send to the echo. The later echoes are quieter by the
 * echo's feedback each time and are left to the page's end.
 */
export const LINK_HOLD_MS = Math.ceil(
  (SONAR_ECHO.seconds + SONAR_PING.attack + SONAR_PING.echoRelease) * 1000,
);

let waiting: (() => void) | undefined;
let pending: ReturnType<typeof setTimeout> | undefined;

/** Whether pressing `link` with `press` leaves this document for another one in this tab. */
function leavesInThisTab(press: MouseEvent, link: HTMLAnchorElement): boolean {
  if (press.button !== 0) return false;
  if (press.metaKey || press.ctrlKey || press.shiftKey || press.altKey)
    return false;
  if (link.target !== "" && link.target !== "_self") return false;
  if (link.hasAttribute("download")) return false;
  if (/\bnoreferrer\b/i.test(link.rel) || link.hasAttribute("referrerpolicy"))
    return false;
  const to = new URL(link.href, document.baseURI);
  if (to.protocol !== "http:" && to.protocol !== "https:") return false;
  const here = new URL(location.href);
  const samePage =
    to.origin === here.origin &&
    to.pathname === here.pathname &&
    to.search === here.search;
  return !(samePage && to.hash !== "");
}

/**
 * Hold the navigation of `link`'s press until its ping has played. Call it while the press is
 * being dispatched, once its ping is heard: it decides at the end of the dispatch, after every
 * handler on the page has had its turn. A newer held press replaces an older one.
 */
export function holdLink(
  press: MouseEvent,
  link: HTMLAnchorElement,
  go: (url: string) => void = (url) => location.assign(url),
): void {
  waiting?.();
  const decide = (event: Event) => {
    // A press that never reached the window (a handler stopped it) is not held; the next click
    // to arrive ends the wait all the same.
    stop();
    if (event !== press) return;
    if (press.defaultPrevented || !leavesInThisTab(press, link)) return;
    press.preventDefault();
    clearTimeout(pending);
    const url = link.href;
    pending = setTimeout(() => {
      pending = undefined;
      go(url);
    }, LINK_HOLD_MS);
  };
  const stop = () => {
    window.removeEventListener("click", decide);
    waiting = undefined;
  };
  window.addEventListener("click", decide);
  waiting = stop;
}
