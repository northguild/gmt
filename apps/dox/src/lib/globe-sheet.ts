/**
 * The phone's zone sheet follows the visual viewport. The sheet is `position: fixed`, which
 * anchors it to the layout viewport; when the iOS keyboard opens the visual viewport shrinks
 * and the layout viewport does not, so the sheet would sit behind the keys. `followViewport`
 * writes the gap between the two bottom edges as `--sheet-bottom` on the sheet's wrapper
 * (`globe-phone.module.css` lifts the sheet and its close by it). With no `visualViewport`
 * nothing is written and the CSS falls back to `0px`.
 */
import { play } from "./slides/frames";

/** The custom property the sheet's rules read. */
export const SHEET_BOTTOM = "--sheet-bottom";

export function followViewport(sheet: HTMLElement, signal: AbortSignal): void {
  const doc = sheet.ownerDocument;
  const win = doc.defaultView;
  const viewport = win?.visualViewport;
  if (!win || !viewport) return;
  const write = (): void => {
    /* A pinched-in page has a smaller visual viewport by design, not a keyboard. */
    const gap =
      viewport.scale > 1
        ? 0
        : doc.documentElement.clientHeight -
          (viewport.height + viewport.offsetTop);
    sheet.style.setProperty(SHEET_BOTTOM, `${Math.max(0, gap)}px`);
  };
  let stop: (() => void) | null = null;
  /* Many events in one frame are one read, on the frame. */
  const schedule = (): void => {
    stop ??= play(
      win,
      0,
      (t) => {
        if (t === 1) write();
      },
      () => {
        stop = null;
      },
    );
  };
  write();
  viewport.addEventListener("resize", schedule, { signal });
  viewport.addEventListener("scroll", schedule, { signal });
  signal.addEventListener("abort", () => stop?.(), { once: true });
}

/**
 * The band, in `host` pixels, the zone card keeps to on a stacked layout: from the stage's top, so
 * it never covers the intro above, to the open sheet's top, so a pin behind the sheet hides its
 * card rather than draw it over the zone list. `drawer` is the `[data-drawer]` wrapper.
 */
export function cardBand(
  stage: Element,
  drawer: HTMLElement | null,
  host: Element,
): { top: number; bottom: number | null } {
  const origin = host.getBoundingClientRect().top;
  const sheet =
    drawer?.dataset["open"] === "true"
      ? drawer.querySelector('[role="region"]')
      : null;
  return {
    top: stage.getBoundingClientRect().top - origin,
    bottom: sheet ? sheet.getBoundingClientRect().top - origin : null,
  };
}
