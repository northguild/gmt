/**
 * The inline script in a deck page's head: it marks `html[data-deck]` before first paint. `wait`
 * shows the first slide while the mount loads; `wait-hash` is for an address that names a slide, so
 * the stage stays empty until the mount jumps there and no wrong slide flashes. The mount then sets
 * `stage`. Without scripts the mark is never set and the page is the stacked article.
 */
export const DECK_HEAD_SCRIPT =
  "document.documentElement.setAttribute('data-deck',location.hash.length>1?'wait-hash':'wait')";
