/**
 * The inline head script that frames the landing's entrance.
 *
 * It runs while the head is parsed, before first paint, so the page never flashes:
 *
 * - On the landing it sets `data-entrance="wait"` on `<html>`. The copy (the eyebrow, the title
 *   and the tagline) starts its freeze at once and is on screen from the first paint; the sky,
 *   the buttons and the pager hold at opacity 0 until the sequencer (`hero-entrance.ts`) writes
 *   `run`. If nothing has by `ARRIVAL_FAILSAFE_MS` the script writes `static`, which shows
 *   everything, so a module that never loads cannot hide the buttons.
 * - On the landing it also sets `data-home-carousel="wait"`, so the paged layout is the first
 *   layout. `home-carousel.ts` writes `on` once it has wired the pages. At `DOMContentLoaded` it
 *   removes a `wait` nothing has replaced. That is not a timer: the carousel is a deferred module
 *   script, and every deferred module has run (or failed) by then, so a slow load keeps the paged
 *   layout and only a carousel that never ran falls back to the pages in order. A timer fired
 *   mid-load on a cold cache, while the carousel was still queued behind the globe's modules, and
 *   switched the landing to the fallback layout.
 * - On every page it listens for `pagereveal`. An arrival through a view transition sets
 *   `data-arrival="transition"`, which keeps the header still; any other load sets `load`, so the
 *   sequencer can tell that the reveal has happened and the header's state is known. A value set
 *   before the reveal stands.
 * - An arrival through a view transition from another page of the same origin that is outside this
 *   site (northguild.dev) adds the `from-landing` type to the transition, which the view-transition
 *   sheet reads to hold the shared mark still and cross-fade the rest. The page it came from is
 *   `navigation.activation.from`, or, where the Navigation API is missing, the same-origin
 *   referrer.
 *
 * The source is a string so one definition serves the `<script is:inline>` and the tests.
 */

/** How long a landing may wait for the sequencer before everything is shown as it is. */
export const ARRIVAL_FAILSAFE_MS = 2500;

/**
 * The page's opt-in to cross-document view transitions, inlined in the head. Chromium reads the
 * rule at the first reveal; where it sat in a linked stylesheet, a heavy page (the landing, with
 * its module scripts) was revealed before the rule counted and the transition aborted with
 * "invalid state" (Chrome 156 as well as headless). An inline rule is there when the head is parsed.
 * Reduced motion opts out.
 */
export const VIEW_TRANSITION_OPT_IN =
  "@view-transition{navigation:auto}@media(prefers-reduced-motion:reduce){@view-transition{navigation:none}}";

/** The view-transition type of an arrival from the sibling site that sits above this one. */
export const FROM_LANDING_TYPE = "from-landing";

/** The script source for a site served under `base` (Astro's `BASE_URL`, for example `/` or `/gmt/`). */
export function arrivalInlineSource(base: string): string {
  const site = JSON.stringify(base.replace(/\/+$/, ""));
  const type = JSON.stringify(FROM_LANDING_TYPE);
  return `(function(){
var d=document.documentElement;
window.addEventListener("pagereveal",function(e){
var t=e.viewTransition;
if(!d.dataset.arrival)d.dataset.arrival=t?"transition":"load";
if(!t||!t.types)return;
var n=window.navigation,f=n&&n.activation&&n.activation.from?n.activation.from.url:document.referrer;
if(!f)return;
try{var u=new URL(f);if(u.origin===location.origin&&u.pathname!==${site}&&u.pathname.indexOf(${site}+"/")!==0)t.types.add(${type})}catch(x){}
});
var p=location.pathname.replace(/\\/(index\\.html)?$/,"");
if(p!==${site})return;
d.dataset.entrance="wait";
d.dataset.homeCarousel="wait";
setTimeout(function(){if(d.dataset.entrance==="wait")d.dataset.entrance="static"},${ARRIVAL_FAILSAFE_MS});
window.addEventListener("DOMContentLoaded",function(){if(d.dataset.homeCarousel==="wait")delete d.dataset.homeCarousel});
})();`;
}
