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

const SONAR_SELECTOR = [
  ".gmt-sonar-focus",
  ".gmt-icon-button",
  ".expressive-code .copy button",
  ".sl-link-button",
  ".pagination-links a",
  ".gmt-input",
  ".gmt-select",
  '.sl-markdown-content .tab > [role="tab"]',
].join(",");

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
  if (el && el === document.activeElement) restartPing(el);
}

document.addEventListener("click", onActivate);
