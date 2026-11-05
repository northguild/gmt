/**
 * carousel: pages that share one place, one shown at a time, with previous and next buttons and a
 * row of dots.
 *
 * Pattern: Carousel, tabbed https://www.w3.org/WAI/ARIA/apg/patterns/carousel/, without autoplay.
 * The page renders the pages, the two buttons, an empty element for the dots and a polite live
 * region; `wireCarousel` writes the rest: the roles, the dots, the shown page, the button names
 * and the ways to move.
 *
 * - **Roles.** The root is a `region` described as a carousel. The dots are a `tablist`, one `tab`
 *   per page, named by the page's `label`. Each page is a `tabpanel` described as a slide, named
 *   "<label>, <n> of <total>", and in the tab order, so a page that scrolls can be scrolled from
 *   the keyboard.
 * - **Shown and hidden.** The shown page carries `data-shown`. A page that closes is `inert` at
 *   once and loses `data-shown` when `leave` calls `hide` (at once without `leave`); the page's
 *   CSS hides what lacks it. The pages keep their boxes, so the place is as tall as the tallest.
 * - **Buttons.** Each is named "Previous: <label>" or "Next: <label>" after the page it opens. One
 *   with no page to open carries `data-off` and leaves the tab order; the page's CSS keeps its
 *   space. If it had focus, focus moves to the other button, quietly: the button carries
 *   `data-quiet-focus` until it loses focus or is pressed, so its focus ring shows without the
 *   sonar ping that a reader's own focus plays.
 * - **Keys.** On the dots, Left and Right move to the previous and next dot and Home and End to
 *   the first and last; the page follows the focus. Elsewhere inside `keyArea` Left and Right
 *   change the page, except in a text field or in something that scrolls sideways.
 * - **Focus.** When the page that holds focus closes, focus moves to the page that opens.
 * - **Wheel.** Over `wheelArea`, while `wheel()` is true, a page that scrolls scrolls first. A
 *   gesture that starts at the page's end steps to the next page and one that starts at its top to
 *   the previous. One gesture moves one page: after a step the wheel is held until it has been
 *   quiet for 220 ms and 650 ms have passed, and a held gesture is cancelled so momentum never
 *   scrolls the new page. Stepping back by the wheel opens the page at its end.
 *
 * Time comes from `now` (default `performance.now`) and nothing here sets a timer, so the wheel
 * is exact under a stubbed clock and a destroyed carousel leaves nothing behind.
 */
import { html, setHtml, type SafeHtml } from "./html";
import styles from "./carousel.module.css";

export interface CarouselPage {
  el: HTMLElement;
  /** The page's name: its dot's name, the buttons' and what the live region says. */
  label: string;
}

/** What moved the carousel. */
export type CarouselBy = "api" | "control" | "key" | "wheel";

export interface CarouselWire {
  signal: AbortSignal;
  pages: CarouselPage[];
  prev: HTMLButtonElement;
  next: HTMLButtonElement;
  /** An empty element; the dots are rendered into it. */
  dots: HTMLElement;
  /** A polite live region; it says the page that opens. */
  live: HTMLElement;
  /** Where Left and Right change the page. */
  keyArea: HTMLElement;
  /** Where the wheel steps the pages. Without it the wheel does nothing. */
  wheelArea?: HTMLElement;
  /** Whether the wheel steps the pages now. Defaults to always. */
  wheel?: () => boolean;
  /** The region's name. */
  label: string;
  /** The prefix of the ids written on pages that have none. */
  idPrefix: string;
  /** The page shown first. Defaults to 0. */
  start?: number;
  /** The clock, in milliseconds. Defaults to `performance.now`. */
  now?: () => number;
  /** Called after the shown page changes, once the new one is shown. */
  onSelect?: (index: number, previous: number, by: CarouselBy) => void;
  /**
   * Called to hide the page that has just closed. Call `hide` when it is ready: after a fade, say.
   * Without it the page hides at once. `hide` does nothing if the page has opened again.
   */
  leave?: (el: HTMLElement, hide: () => void) => void;
}

export interface CarouselHandle {
  /** The shown page. */
  readonly index: number;
  select(index: number, by?: CarouselBy): void;
}

/** A wheel gesture needs this much movement, in pixels, to step. */
const STEP_PX = 40;
/** The wheel must have been quiet this long, in milliseconds, for a gesture to be fresh. */
const QUIET_MS = 220;
/** After a step the wheel stays held at least this long, in milliseconds. */
const HOLD_MS = 650;
/** A line is this many pixels. */
const LINE_PX = 16;
const PAGE_PX = 400;

const TEXT_FIELD = "input, textarea, select, [contenteditable]";

/** The dots: one tab per page, the `current` one selected. */
export function carouselDots(
  pages: readonly { id: string; label: string }[],
  current: number,
): SafeHtml {
  return html`${pages.map(
    (p, i) =>
      html`<button type="button" role="tab" class="${styles.dot}" data-dot="${String(i)}"
        aria-label="${p.label}" aria-controls="${p.id}" aria-selected="${String(i === current)}"
        tabindex="${i === current ? "0" : "-1"}"></button>`,
  )}`;
}

/** Whether `el`, or a box it sits in inside `area`, scrolls sideways. */
function scrollsSideways(el: Element, area: Element): boolean {
  for (let n: Element | null = el; n && n !== area; n = n.parentElement) {
    if (n.scrollWidth <= n.clientWidth) continue;
    const x = getComputedStyle(n).overflowX;
    if (x === "auto" || x === "scroll") return true;
  }
  return false;
}

export function wireCarousel(
  root: HTMLElement,
  o: CarouselWire,
): CarouselHandle {
  const { signal, pages, prev, next, dots, live, keyArea } = o;
  if (pages.length < 2) throw new Error("carousel needs at least two pages");
  const now = o.now ?? (() => performance.now());
  const doc = root.ownerDocument;
  const total = pages.length;

  // What the wire changes, so destroying it puts the page back as it was.
  const kept = pages.map((p) => ({
    id: p.el.getAttribute("id"),
    tabindex: p.el.getAttribute("tabindex"),
  }));
  const keptNames = [prev, next].map((b) => b.getAttribute("aria-label"));

  root.setAttribute("role", "region");
  root.setAttribute("aria-roledescription", "carousel");
  root.setAttribute("aria-label", o.label);
  pages.forEach((p, i) => {
    if (!p.el.id) p.el.id = `${o.idPrefix}-page-${i + 1}`;
    p.el.setAttribute("role", "tabpanel");
    p.el.setAttribute("aria-roledescription", "slide");
    p.el.setAttribute("aria-label", `${p.label}, ${i + 1} of ${total}`);
    p.el.tabIndex = 0;
  });

  let index = Math.max(0, Math.min(total - 1, o.start ?? 0));
  dots.setAttribute("role", "tablist");
  dots.setAttribute("aria-label", o.label);
  setHtml(
    dots,
    carouselDots(
      pages.map((p) => ({ id: p.el.id, label: p.label })),
      index,
    ),
  );
  const tabs = Array.from(
    dots.querySelectorAll<HTMLButtonElement>("button[data-dot]"),
  );

  // Which close is current for each page, so a page that opens again is not hidden late.
  const closing = pages.map(() => 0);
  const show = (el: HTMLElement): void => {
    el.inert = false;
    el.toggleAttribute("data-shown", true);
  };
  const hideNow = (el: HTMLElement): void => {
    el.inert = true;
    el.removeAttribute("data-shown");
  };
  pages.forEach((p, i) => (i === index ? show(p.el) : hideNow(p.el)));

  const refresh = (announce: boolean): void => {
    const focused = doc.activeElement;
    for (const [button, n, word] of [
      [prev, index - 1, "Previous"],
      [next, index + 1, "Next"],
    ] as const) {
      const target = pages[n];
      button.toggleAttribute("data-off", target === undefined);
      if (target === undefined) {
        button.tabIndex = -1;
        continue;
      }
      button.removeAttribute("tabindex");
      button.setAttribute("aria-label", `${word}: ${target.label}`);
      button.setAttribute("aria-controls", target.el.id);
    }
    tabs.forEach((tab, i) => {
      tab.setAttribute("aria-selected", String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
    });
    const lost = [prev, next].find(
      (b) => b === focused && b.hasAttribute("data-off"),
    );
    if (lost) {
      const to = lost === next ? prev : next;
      to.setAttribute("data-quiet-focus", "");
      to.addEventListener(
        "blur",
        () => to.removeAttribute("data-quiet-focus"),
        {
          once: true,
        },
      );
      to.focus();
    }
    if (announce)
      live.textContent = `${pages[index].label}, ${index + 1} of ${total}`;
  };

  const select = (target: number, by: CarouselBy = "api"): void => {
    const to = Math.max(0, Math.min(total - 1, target));
    if (to === index) return;
    const from = index;
    index = to;
    const leaving = pages[from].el;
    const held = leaving.contains(doc.activeElement);
    closing[to]++;
    show(pages[to].el);
    leaving.inert = true;
    const token = ++closing[from];
    const hide = (): void => {
      if (closing[from] === token) hideNow(leaving);
    };
    if (o.leave) o.leave(leaving, hide);
    else hide();
    refresh(true);
    if (held) pages[to].el.focus({ preventScroll: true });
    o.onSelect?.(to, from, by);
  };

  prev.addEventListener("click", () => select(index - 1, "control"), {
    signal,
  });
  next.addEventListener("click", () => select(index + 1, "control"), {
    signal,
  });
  tabs.forEach((tab, i) =>
    tab.addEventListener("click", () => select(i, "control"), { signal }),
  );

  dots.addEventListener(
    "keydown",
    (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const to =
        event.key === "ArrowLeft"
          ? index - 1
          : event.key === "ArrowRight"
            ? index + 1
            : event.key === "Home"
              ? 0
              : event.key === "End"
                ? total - 1
                : null;
      if (to === null) return;
      event.preventDefault();
      select(to, "key");
      tabs[index]?.focus();
    },
    { signal },
  );

  keyArea.addEventListener(
    "keydown",
    (event) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      )
        return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const t = event.target;
      if (t instanceof Element) {
        if (dots.contains(t) || t.closest(TEXT_FIELD)) return;
        if (scrollsSideways(t, keyArea)) return;
      }
      event.preventDefault();
      select(index + (event.key === "ArrowRight" ? 1 : -1), "key");
    },
    { signal },
  );

  if (o.wheelArea) {
    const active = o.wheel ?? (() => true);
    let acc = 0;
    let held = false;
    let stepAt = 0;
    let lastActivity = Number.NEGATIVE_INFINITY;
    // The direction a fresh gesture may step in: it began at that edge of the page.
    let armed = 0;
    const markActivity = (): void => {
      lastActivity = now();
    };
    for (const p of pages)
      p.el.addEventListener("scroll", markActivity, { signal, passive: true });
    o.wheelArea.addEventListener(
      "wheel",
      (event) => {
        if (!active()) return;
        const t = now();
        const raw =
          Math.abs(event.deltaY) >= Math.abs(event.deltaX)
            ? event.deltaY
            : event.deltaX;
        const d =
          raw *
          (event.deltaMode === 1
            ? LINE_PX
            : event.deltaMode === 2
              ? PAGE_PX
              : 1);
        if (held) {
          if (t - lastActivity >= QUIET_MS && t - stepAt >= HOLD_MS)
            held = false;
          else {
            lastActivity = t;
            event.preventDefault();
            return;
          }
        }
        const gap = t - lastActivity;
        lastActivity = t;
        if (d === 0) return;
        const dir = d > 0 ? 1 : -1;
        const el = pages[index].el;
        const atEdge =
          dir > 0
            ? el.scrollTop + el.clientHeight >= el.scrollHeight - 1
            : el.scrollTop <= 0;
        // A gesture counts only if it begins at the edge it leaves by, so momentum from a scroll
        // that reached the edge never turns the page.
        if (gap >= QUIET_MS) {
          acc = 0;
          armed = atEdge ? dir : 0;
        }
        const to = index + dir;
        if (armed !== dir || !atEdge || to < 0 || to >= total) {
          acc = 0;
          if (!atEdge || armed !== dir) armed = 0;
          return;
        }
        event.preventDefault();
        acc += d;
        if (Math.abs(acc) < STEP_PX) return;
        acc = 0;
        held = true;
        stepAt = t;
        select(to, "wheel");
        const opened = pages[index].el;
        opened.scrollTop = dir > 0 ? 0 : opened.scrollHeight;
      },
      { signal, passive: false },
    );
  }

  signal.addEventListener(
    "abort",
    () => {
      root.removeAttribute("role");
      root.removeAttribute("aria-roledescription");
      root.removeAttribute("aria-label");
      dots.removeAttribute("role");
      dots.removeAttribute("aria-label");
      dots.replaceChildren();
      live.textContent = "";
      [prev, next].forEach((b, i) => {
        b.removeAttribute("data-off");
        b.removeAttribute("tabindex");
        b.removeAttribute("aria-controls");
        const name = keptNames[i];
        if (typeof name === "string") b.setAttribute("aria-label", name);
        else b.removeAttribute("aria-label");
      });
      pages.forEach((p, i) => {
        const { id, tabindex } = kept[i];
        if (id === null) p.el.removeAttribute("id");
        if (tabindex === null) p.el.removeAttribute("tabindex");
        else p.el.setAttribute("tabindex", tabindex);
        p.el.removeAttribute("role");
        p.el.removeAttribute("aria-roledescription");
        p.el.removeAttribute("aria-label");
        p.el.removeAttribute("data-shown");
        p.el.inert = false;
        p.el.scrollTop = 0;
      });
    },
    { once: true },
  );

  refresh(false);
  return {
    get index() {
      return index;
    },
    select,
  };
}
