/**
 * Eases height changes in a tool's result regions, through one CSS-backed
 * primitive: `.gmt-grow` (styles/gmt-primitives.css).
 *
 * A `.gmt-grow` element (the *outer*) has exactly one element child (the
 * *inner*). At rest the outer is `height: auto`, with no inline height and no
 * `data-growing`. When the inner's height changes, `smoothHeight` pins the outer
 * at its old height, forces layout, then sets the new height with `data-growing`
 * on; the CSS transition does the rest and cleanup puts the outer back to
 * `auto`. Only height moves: never opacity or transform, never a value the
 * reader is reading.
 *
 * One `ResizeObserver` serves every attached element. Its callback runs after
 * layout and before paint, so a new height is never painted unclipped, and every
 * box that changes in a frame arrives together. That is what lets sections that
 * grow at the same time share one speed budget: they get one duration, computed
 * from the sum of their distances, so the page's per-frame step stays bounded.
 *
 * No gmt import, no `dox-tools`, no `zod`, no `ai`.
 */

/** The shortest a height change takes: the value of `--gmt-duration-fast`. */
export const MIN_GROW_MS = 120;
/** ms per px of distance. The steepest frame of the easing then stays near 48 px. */
export const GROW_MS_PER_PX = 0.6;
/** Used when `--gmt-grow-max` is missing or unreadable. */
export const DEFAULT_GROW_MAX_MS = 1250;

/**
 * How long a change of `deltaPx` takes: linear in distance, clamped to
 * [`MIN_GROW_MS`, `maxMs`]. A cap below the floor wins.
 */
export function growDuration(deltaPx: number, maxMs: number): number {
  const raw = Number.isFinite(deltaPx)
    ? GROW_MS_PER_PX * Math.abs(deltaPx)
    : MIN_GROW_MS;
  return Math.min(maxMs, Math.max(MIN_GROW_MS, raw));
}

interface GrowState {
  outer: HTMLElement;
  inner: HTMLElement;
  /** The inner's last observed border-box size. */
  width: number;
  height: number;
  /** `innerWidth` at the last observation: a scrollbar does not change it. */
  viewport: number;
  growing: boolean;
  timer: ReturnType<typeof setTimeout> | undefined;
  onEnd: (event: Event) => void;
  detach: () => void;
}

const attached = new WeakSet<HTMLElement>();
/** Observed inner → its state. Empty exactly when `observer` is unset. */
const states = new Map<Element, GrowState>();
let observer: ResizeObserver | undefined;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function reducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia(REDUCED_MOTION).matches;
}

/** `--gmt-grow-max` in ms ("700ms" or "0.7s"), or the default. */
function readMaxMs(el: HTMLElement): number {
  const raw = getComputedStyle(el).getPropertyValue("--gmt-grow-max").trim();
  const m = /^(-?\d*\.?\d+)(ms|s)$/.exec(raw);
  if (!m) return DEFAULT_GROW_MAX_MS;
  const n = Number(m[1]);
  return m[2] === "s" ? n * 1000 : n;
}

function sizeOf(entry: ResizeObserverEntry): { w: number; h: number } {
  const box = entry.borderBoxSize?.[0];
  return box
    ? { w: box.inlineSize, h: box.blockSize }
    : { w: entry.contentRect.width, h: entry.contentRect.height };
}

function viewportWidth(): number {
  return typeof innerWidth === "number" ? innerWidth : 0;
}

function depthOf(el: Element): number {
  let d = 0;
  for (let n = el.parentNode; n; n = n.parentNode) d += 1;
  return d;
}

/** The height the outer is showing right now. */
function renderedHeight(s: GrowState): number {
  if (!s.growing) return s.height;
  const px = parseFloat(getComputedStyle(s.outer).height);
  return Number.isFinite(px) ? px : s.height;
}

/** Clears everything an animation leaves behind. Safe to call at rest. */
function cleanup(s: GrowState): void {
  if (s.timer !== undefined) clearTimeout(s.timer);
  s.timer = undefined;
  s.growing = false;
  s.outer.style.removeProperty("height");
  s.outer.style.removeProperty("--gmt-grow-duration");
  s.outer.removeAttribute("data-growing");
}

/** True while a height transition on the outer is still in flight. */
function heightTransitionRunning(outer: HTMLElement): boolean {
  if (typeof outer.getAnimations !== "function") return false;
  return outer.getAnimations().some((a) => {
    const t = a as CSSTransition;
    return (
      t.transitionProperty === "height" &&
      (a.playState === "running" || a.pending)
    );
  });
}

function onResize(entries: ResizeObserverEntry[]): void {
  const changed: { s: GrowState; w: number; h: number }[] = [];
  for (const entry of entries) {
    const s = states.get(entry.target);
    if (!s) continue;
    const { w, h } = sizeOf(entry);
    changed.push({ s, w, h });
  }
  /* Deepest first: a slot is decided before the section around it, so the
     section meets "a descendant is growing" and follows it. */
  changed.sort((a, b) => depthOf(b.s.outer) - depthOf(a.s.outer));

  const reduced = reducedMotion();
  const animating: { s: GrowState; target: number }[] = [];

  for (const { s, w, h } of changed) {
    const widthChanged = Math.abs(w - s.width) > 0.01;
    const heightChanged = Math.abs(h - s.height) > 0.01;
    /* A resize snaps. A width change with the same viewport is a scrollbar
       appearing as the page fills, or a font arriving: the content below really
       did grow, so it eases like any other change. */
    const resized = widthChanged && viewportWidth() !== s.viewport;
    s.viewport = viewportWidth();
    s.width = w;
    if (resized) {
      cleanup(s);
      s.height = h;
      continue;
    }
    if (!heightChanged) continue;

    const nestedGrowing =
      s.outer.querySelector(".gmt-grow[data-growing]") !== null ||
      animating.some((a) => a.s !== s && s.outer.contains(a.s.outer));
    if (
      reduced ||
      s.outer.querySelector('[aria-expanded="true"]') !== null ||
      nestedGrowing
    ) {
      cleanup(s);
      s.height = h;
      continue;
    }
    animating.push({ s, target: h });
  }
  if (animating.length === 0) return;

  /* Every box in motion shares one speed budget, across callbacks too: boxes
     already easing are retargeted with the new ones, and the duration comes from
     the total distance still to travel. */
  const movers: { s: GrowState; target: number; from: number }[] = [];
  for (const { s, target } of animating) {
    movers.push({ s, target, from: renderedHeight(s) });
  }
  for (const s of states.values()) {
    if (!s.growing || animating.some((a) => a.s === s)) continue;
    movers.push({ s, target: s.height, from: renderedHeight(s) });
  }
  let total = 0;
  for (const m of movers) total += Math.abs(m.target - m.from);
  const duration = growDuration(total, readMaxMs(movers[0]!.s.outer));

  /* Pin every box where it is now, with the transition already switched on,
     force layout once, then release them all toward their targets so each
     transition starts from the pinned value. */
  for (const { s, from } of movers) {
    s.outer.setAttribute("data-growing", "");
    s.outer.style.setProperty("--gmt-grow-duration", `${duration}ms`);
    s.outer.style.height = `${from}px`;
  }
  void movers[0]!.s.outer.offsetHeight;
  for (const { s, target } of movers) {
    s.growing = true;
    s.outer.style.height = `${target}px`;
    s.height = target;
    if (s.timer !== undefined) clearTimeout(s.timer);
    /* No transitionend fires when the computed height does not change. */
    s.timer = setTimeout(() => cleanup(s), duration + 100);
  }
}

/**
 * Makes `outer` ease whenever its single child's height changes. A second call
 * for the same element does nothing. Without `ResizeObserver` it changes
 * nothing, so the element keeps today's behaviour.
 */
export function smoothHeight(outer: HTMLElement, signal?: AbortSignal): void {
  if (typeof ResizeObserver === "undefined") return;
  if (attached.has(outer) || signal?.aborted) return;
  const inner = outer.firstElementChild;
  if (!(inner instanceof HTMLElement)) return;
  attached.add(outer);

  /* Seeded now, not at the first callback: "never animate from nothing at
     attach" must hold even when the mount renders before the observer's first
     delivery. The first callback compares against this like any other. */
  const rect = inner.getBoundingClientRect();
  const state: GrowState = {
    outer,
    inner,
    width: rect.width,
    height: rect.height,
    viewport: viewportWidth(),
    growing: false,
    timer: undefined,
    onEnd: () => {},
    detach: () => {},
  };

  /* A nested grow's events bubble up, and a retarget cancels the old
     transition just as it starts the new one; neither is this element's end. */
  state.onEnd = (event: Event) => {
    if (event.target !== outer) return;
    if ((event as TransitionEvent).propertyName !== "height") return;
    if (heightTransitionRunning(outer)) return;
    cleanup(state);
  };
  outer.addEventListener("transitionend", state.onEnd);
  outer.addEventListener("transitioncancel", state.onEnd);

  state.detach = () => {
    signal?.removeEventListener("abort", state.detach);
    outer.removeEventListener("transitionend", state.onEnd);
    outer.removeEventListener("transitioncancel", state.onEnd);
    observer?.unobserve(inner);
    states.delete(inner);
    cleanup(state);
    attached.delete(outer);
    if (states.size === 0) {
      observer?.disconnect();
      observer = undefined;
    }
  };
  signal?.addEventListener("abort", state.detach, { once: true });

  observer ??= new ResizeObserver(onResize);
  states.set(inner, state);
  observer.observe(inner);
}

function wrapSection(section: HTMLElement): void {
  const inner = document.createElement("div");
  inner.className = "gmt-grow-inner";
  inner.append(...section.childNodes);
  section.append(inner);
  section.classList.add("gmt-grow");
}

/**
 * Wraps and attaches every growable region under `scope`:
 *
 * - each widget section after the first (section 1 holds the controls, whose
 *   popovers must not clip), unless `data-grow="off"`;
 * - each `[data-grow="slot"]` inside a widget card, in any section;
 * - each other `.gmt-grow` already in the markup (a static host).
 *
 * Idempotent, keeps node identity, and does nothing without `ResizeObserver`,
 * so a reader without it sees the page as it was.
 */
export function smoothHeights(scope: ParentNode, signal?: AbortSignal): void {
  if (typeof ResizeObserver === "undefined") return;

  for (const card of scope.querySelectorAll<HTMLElement>(".gmt-widget-card")) {
    const sections = card.querySelectorAll<HTMLElement>(
      ":scope > .gmt-widget-section",
    );
    sections.forEach((section, i) => {
      if (i === 0 || section.dataset["grow"] === "off") return;
      if (section.classList.contains("gmt-grow")) return;
      wrapSection(section);
      smoothHeight(section, signal);
    });
  }

  /* After the sections, so a slot in a wrapped section lands in its inner box. */
  for (const slot of scope.querySelectorAll<HTMLElement>(
    '.gmt-widget-card [data-grow="slot"]',
  )) {
    if (slot.parentElement?.classList.contains("gmt-grow-slot")) continue;
    const wrapper = document.createElement("div");
    wrapper.className = "gmt-grow gmt-grow-slot";
    slot.before(wrapper);
    wrapper.append(slot);
    smoothHeight(wrapper, signal);
  }

  for (const host of scope.querySelectorAll<HTMLElement>(".gmt-grow")) {
    if (attached.has(host) || host.matches(".gmt-widget-section")) continue;
    smoothHeight(host, signal);
  }
}
