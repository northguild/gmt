/**
 * Eases height changes in a tool's result regions, through one primitive:
 * `.gmt-grow` (styles/gmt-primitives.css).
 *
 * A `.gmt-grow` element (the *outer*) has exactly one element child (the
 * *inner*). At rest the outer is `height: auto`, with no inline height and no
 * `data-growing`. When the inner's height changes, `smoothHeight` pins the outer
 * at its old height with `data-growing` on (which clips it), and a frame loop
 * walks the pinned height to the inner's height. Cleanup then puts the outer
 * back to `auto`. Only height moves: never opacity or transform, never a value
 * the reader is reading.
 *
 * Why a frame loop and not a CSS transition: a transition is a function of
 * time, so a frame that arrives late (a busy mount, a slow paint) moves the box
 * by the whole time it missed, and one dropped frame doubles the step. The loop
 * instead moves each box a fraction of what is left (an ease-out that needs no
 * duration, so a retarget never restarts it) and holds the *total* of all boxes
 * in motion to `STEP_BUDGET_PX` a frame, however late the frame is. The page
 * therefore never jumps by more than the budget, and a late frame only makes the
 * ease last longer.
 *
 * One `ResizeObserver` serves every attached element. Its callback runs after
 * layout and before paint, so a new height is never painted unclipped. Heights
 * are read live, deepest box first, after the boxes inside have been pinned: a
 * section whose slot is growing sees only the change the slot does not account
 * for, so the slot's own easing is never mistaken for a pop, and a pop beside it
 * is never hidden by it.
 *
 * No gmt import, no `dox-tools`, no `zod`, no `ai`.
 */

/** The most the boxes in motion move, in total, in one frame. The page-level
 *  gate is 48 px; the rest is room for a reflow that is not eased. */
export const STEP_BUDGET_PX = 40;
/** Time constant of the ease: each frame covers `1 - exp(-dt / tau)` of what is left. */
export const FOLLOW_TAU_MS = 50;
/** A box within this many px of its target is released. */
export const SETTLE_PX = 1;
/** Heights are whole px (`offsetHeight`), so a box's own easing can differ from
 *  the change it causes by about this much. */
export const EXPLAIN_TOLERANCE_PX = 2;
/** A box still pinned this long after its last retarget is released. */
export const MAX_GROW_MS = 4000;
/** The longest frame time the ease believes; a longer one is a stall, not a lag. */
const MAX_FRAME_MS = 100;
/** Assumed for the first frame of a run, which has no previous frame. */
const FIRST_FRAME_MS = 1000 / 60;

/** The fraction of the remaining distance a frame of `dtMs` covers. */
export function followFraction(dtMs: number): number {
  const dt = Number.isFinite(dtMs)
    ? Math.min(MAX_FRAME_MS, Math.max(0, dtMs))
    : FIRST_FRAME_MS;
  return 1 - Math.exp(-dt / FOLLOW_TAU_MS);
}

/**
 * The factor that brings boxes moving by `totalPx` in one frame down to at most
 * `budget`: 1 when they are already within it. Every box takes the same factor,
 * so a pair that were easing in step stay in step.
 */
export function budgetScale(totalPx: number, budget: number): number {
  const total = Math.abs(totalPx);
  return total > budget && total > 0 ? budget / total : 1;
}

interface GrowState {
  outer: HTMLElement;
  inner: HTMLElement;
  /** The inner's last measured width, and its last measured height: the
   *  height the outer is heading for while it moves. */
  width: number;
  height: number;
  /** `innerWidth` at the last observation: a scrollbar does not change it. */
  viewport: number;
  /** The inline height while the outer moves. */
  shown: number;
  /** What the last frame moved the outer by. */
  lastStep: number;
  /** When the outer was last pinned or retargeted. */
  since: number;
  moving: boolean;
  detach: () => void;
}

const attached = new WeakSet<HTMLElement>();
/** Observed inner → its state. Empty exactly when `observer` is unset. */
const states = new Map<Element, GrowState>();
/** The boxes in motion. */
const moving = new Set<GrowState>();
let observer: ResizeObserver | undefined;
let frameId: number | ReturnType<typeof setTimeout> | undefined;
let lastFrameAt: number | undefined;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function reducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia(REDUCED_MOTION).matches;
}

/** The clock `requestAnimationFrame` timestamps are on. */
function now(): number {
  return typeof performance !== "undefined" ? performance.now() : 0;
}

/**
 * The height the outer needs for its child: the child's layout height
 * (`offsetHeight` ignores the entrance's scale transform) plus its vertical
 * margins, which a flex container does not collapse and which `offsetHeight`
 * leaves out. Without them an outer released to `auto` would jump by the margins
 * (the Zone Planner's host has 24 px above and below it).
 */
function layoutHeight(el: HTMLElement): number {
  const box = el.offsetHeight || el.getBoundingClientRect().height;
  const style =
    typeof getComputedStyle === "function" ? getComputedStyle(el) : null;
  const margins = style
    ? (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0)
    : 0;
  return box + margins;
}

function layoutWidth(el: HTMLElement): number {
  return el.offsetWidth || el.getBoundingClientRect().width;
}

function viewportWidth(): number {
  return typeof innerWidth === "number" ? innerWidth : 0;
}

function depthOf(el: Element): number {
  let d = 0;
  for (let n = el.parentNode; n; n = n.parentNode) d += 1;
  return d;
}

/** Puts the outer back to `height: auto` and forgets any motion. Safe at rest. */
function release(s: GrowState): void {
  moving.delete(s);
  s.moving = false;
  s.lastStep = 0;
  s.outer.style.removeProperty("height");
  s.outer.removeAttribute("data-growing");
}

/** The motion of boxes inside `s.outer` that is visible from outside it: the
 *  step of each moving descendant with no moving box between it and `s.outer`. */
function explainedByInside(s: GrowState): number {
  let total = 0;
  for (const other of moving) {
    if (other === s || !s.outer.contains(other.outer)) continue;
    const owner = other.outer.parentElement?.closest(".gmt-grow[data-growing]");
    if (owner === s.outer || !s.outer.contains(owner ?? null)) {
      total += other.lastStep;
    }
  }
  return total;
}

/** True when no moving box contains `s`: only then does its step move the page. */
function isOutermost(s: GrowState): boolean {
  return !s.outer.parentElement?.closest(".gmt-grow[data-growing]");
}

function schedule(): void {
  if (frameId !== undefined || moving.size === 0) return;
  if (typeof requestAnimationFrame === "function") {
    frameId = requestAnimationFrame(frame);
  } else {
    frameId = setTimeout(() => frame(now()), 16);
  }
}

function frame(at: number): void {
  frameId = undefined;
  const dt = lastFrameAt === undefined ? FIRST_FRAME_MS : at - lastFrameAt;
  lastFrameAt = at;
  const k = followFraction(dt);

  const running: GrowState[] = [];
  for (const s of moving) {
    const remaining = s.height - s.shown;
    if (Math.abs(remaining) <= SETTLE_PX || at - s.since > MAX_GROW_MS) {
      release(s);
    } else running.push(s);
  }

  /* Only the outermost boxes move the page, so only they spend the budget; a
     box inside one is scaled with it so the pair stay in step. */
  const wanted = running.map((s) => (s.height - s.shown) * k);
  let pageStep = 0;
  running.forEach((s, i) => {
    if (isOutermost(s)) pageStep += Math.abs(wanted[i]!);
  });
  const scale = budgetScale(pageStep, STEP_BUDGET_PX);

  running.forEach((s, i) => {
    const step = wanted[i]! * scale;
    s.shown += step;
    s.lastStep = step;
    s.outer.style.height = `${s.shown}px`;
  });

  if (moving.size === 0) lastFrameAt = undefined;
  else schedule();
}

function onResize(entries: ResizeObserverEntry[]): void {
  const changed: { s: GrowState; w: number }[] = [];
  const seen = new Set<GrowState>();
  for (const entry of entries) {
    const s = states.get(entry.target);
    if (!s || seen.has(s)) continue;
    seen.add(s);
    const box = entry.borderBoxSize?.[0];
    changed.push({ s, w: box ? box.inlineSize : entry.contentRect.width });
  }
  /* Deepest first: a box inside is pinned before the box around it reads its
     height, so the outer sees only what the inner box does not account for. */
  changed.sort((a, b) => depthOf(b.s.outer) - depthOf(a.s.outer));

  const snap =
    reducedMotion() || (typeof document !== "undefined" && document.hidden);

  for (const { s, w } of changed) {
    const widthChanged = Math.abs(w - s.width) > 0.01;
    /* A resize snaps. A width change with the same viewport is a scrollbar
       appearing as the page fills, or a font arriving: the content below really
       did grow, so it eases like any other change. */
    const resized = widthChanged && viewportWidth() !== s.viewport;
    s.viewport = viewportWidth();
    s.width = w;

    const h = layoutHeight(s.inner);
    if (
      resized ||
      snap ||
      s.outer.querySelector('[aria-expanded="true"]') !== null
    ) {
      release(s);
      s.height = h;
      continue;
    }
    if (Math.abs(h - s.height) < SETTLE_PX) {
      if (s.moving) s.height = h;
      continue;
    }

    if (s.moving) {
      /* Already on its way: head for the new height from where it is. */
      s.height = h;
      s.since = now();
      continue;
    }
    const explained = explainedByInside(s);
    if (Math.abs(h - s.height - explained) < EXPLAIN_TOLERANCE_PX) {
      /* Everything that changed is a box inside easing on its own: this outer
         is already the right height, and follows it. */
      s.height = h;
      continue;
    }
    /* Pin at the height the reader last saw, plus what the boxes inside have
       already shown, and head for the new one. */
    s.shown = s.height + explained;
    s.height = h;
    s.since = now();
    s.moving = true;
    s.lastStep = 0;
    s.outer.setAttribute("data-growing", "");
    s.outer.style.height = `${s.shown}px`;
    moving.add(s);
  }
  schedule();
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
  const state: GrowState = {
    outer,
    inner,
    width: layoutWidth(inner),
    height: layoutHeight(inner),
    viewport: viewportWidth(),
    shown: 0,
    lastStep: 0,
    since: 0,
    moving: false,
    detach: () => {},
  };

  state.detach = () => {
    signal?.removeEventListener("abort", state.detach);
    observer?.unobserve(inner);
    states.delete(inner);
    release(state);
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
