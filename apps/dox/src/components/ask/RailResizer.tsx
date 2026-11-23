/**
 * The handle on the widget rail's left edge. Drag it, or focus it and use the
 * arrow keys, to make the rail wider; double-click it to reset the width.
 *
 * The width lives in one CSS custom property on the container the parent passes
 * (`--gmt-hive-rail-width`), so a widget swap, which remounts the rail, keeps
 * it. On /dox/ the reader's last width is remembered in this browser only; a
 * host that sets its own starting width (the slide deck) passes
 * `remember={false}` and neither reads nor writes it.
 *
 * Desktop only: below 60rem the rail is a bottom sheet and the handle is
 * hidden (`gmt-hive.css`).
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import styles from "./RailResizer.module.css";
import {
  clampRailWidth,
  railBounds,
  railWidthForKey,
  type RailBounds,
} from "./rail-width";
import { STORAGE_KEY, WIDTH_PROPERTY } from "./rail-prepaint";

export { STORAGE_KEY, WIDTH_PROPERTY };

function readStoredWidth(): number | undefined {
  try {
    const value = Number(window.localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(value) && value > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

function storeWidth(width: number | undefined): void {
  try {
    if (width === undefined) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, String(Math.round(width)));
  } catch {
    // Storage blocked: the width still applies for this visit.
  }
}

/** What the server markup says before the browser has measured anything: the
 * rail's default (22rem) at its narrowest, up to a plausible half page. A
 * splitter must carry its value from the first render, and the measured one
 * replaces this as soon as the page mounts. */
const SERVER_VALUE = { min: 352, now: 352, max: 704 };

/** How much a transform scales `el` as drawn (a slide's fit box): 1 where nothing scales it. The
 * layout width is rounded to a pixel, so a drawn ratio within 1% of 1 is no scaling. */
const drawnScale = (el: HTMLElement) => {
  const ratio =
    el.offsetWidth > 0 ? el.getBoundingClientRect().width / el.offsetWidth : 1;
  return Math.abs(ratio - 1) < 0.01 ? 1 : ratio;
};

interface Measured {
  width: number;
  bounds: RailBounds;
  bodyWidth: number;
}

export function RailResizer({
  railId,
  container,
  remember = true,
  className,
}: {
  railId: string;
  /** The element that holds the transcript and the rail: it carries the width
   * property and the dragging flag. A ref from the parent that renders it. */
  container: RefObject<HTMLElement | null>;
  /** Whether the width is kept in this browser for the next visit (/dox/'s). */
  remember?: boolean;
  /** A host's own class, for hiding the handle where its rail is not beside the chat. */
  className?: string;
}) {
  const save = useCallback(
    (width: number | undefined) => {
      if (remember) storeWidth(width);
    },
    [remember],
  );
  const handleRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<Measured | null>(null);
  const drag = useRef<{
    startX: number;
    startWidth: number;
    scale: number;
  } | null>(null);
  const frame = useRef(0);
  /** The width the last pointer move asked for, until its frame is drawn. */
  const pending = useRef<number | undefined>(undefined);

  const elements = useCallback(() => {
    const body = container.current;
    const rail = document.getElementById(railId);
    return body && rail ? { body, rail } : null;
  }, [railId, container]);

  const measure = useCallback((): Measured | null => {
    const found = elements();
    if (!found) return null;
    // Layout pixels, the ones the width property is set in: a scaled host draws them larger or smaller.
    const scale = drawnScale(found.body);
    const bodyWidth = found.body.getBoundingClientRect().width / scale;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    // The CSS states the narrowest width (`--gmt-hive-rail-min`); the computed value is in pixels.
    const minWidth =
      parseFloat(getComputedStyle(found.rail).minInlineSize) || 0;
    return {
      width: found.rail.getBoundingClientRect().width / scale,
      bounds: railBounds({ minWidth, bodyWidth, rem }),
      bodyWidth,
    };
  }, [elements]);

  /** Sets the width, clamped, or clears it back to the default. */
  const apply = useCallback(
    (width: number | undefined) => {
      const found = elements();
      if (!found) return;
      const current = measure();
      if (width === undefined || !current) {
        found.body.style.removeProperty(WIDTH_PROPERTY);
      } else {
        const clamped = clampRailWidth(width, current.bounds);
        found.body.style.setProperty(WIDTH_PROPERTY, `${clamped}px`);
      }
      setMeasured(measure());
    },
    [elements, measure],
  );

  // After mount only: the server knows neither the window nor the reader's
  // stored width (#418). Re-measured on resize so the handle's value stays true.
  // The head script already painted the stored width on `<html>`
  // (`rail-prepaint.ts`); the body now carries the same value, so dropping
  // the root copy changes nothing on screen, and a later reset is not undone
  // by inheritance.
  useEffect(() => {
    const stored = remember ? readStoredWidth() : undefined;
    apply(stored);
    document.documentElement.style.removeProperty(WIDTH_PROPERTY);
    const onResize = () => setMeasured(measure());
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(frame.current);
    };
  }, [apply, measure, remember]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const current = measure();
    if (!current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const body = elements()?.body;
    drag.current = {
      startX: event.clientX,
      startWidth: current.width,
      scale: body ? drawnScale(body) : 1,
    };
    elements()?.body.setAttribute("data-resizing", "");
    event.currentTarget.setAttribute("data-resizing", "");
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start) return;
    // The rail is on the right: moving the pointer left widens it.
    const width =
      start.startWidth + (start.startX - event.clientX) / start.scale;
    pending.current = width;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      pending.current = undefined;
      apply(width);
    });
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    elements()?.body.removeAttribute("data-resizing");
    event.currentTarget.removeAttribute("data-resizing");
    // A move whose frame has not run yet would otherwise be lost, and the
    // width stored below would be one frame old.
    cancelAnimationFrame(frame.current);
    if (pending.current !== undefined) {
      apply(pending.current);
      pending.current = undefined;
    }
    const width = measure()?.width;
    if (width !== undefined) save(width);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const current = measure();
    if (!current) return;
    const width = railWidthForKey(
      event.key,
      event.shiftKey,
      current.width,
      current.bounds,
    );
    if (width === undefined) return;
    event.preventDefault();
    apply(width);
    save(width);
  };

  const onDoubleClick = () => {
    apply(undefined);
    save(undefined);
  };

  return (
    <div
      ref={handleRef}
      className={className ? `${styles.resizer} ${className}` : styles.resizer}
      // A focusable separator is the ARIA Authoring Practices window splitter,
      // an interactive widget. <hr> is non-interactive and cannot take focus
      // or key handlers.
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="separator"
      aria-orientation="vertical"
      aria-controls={railId}
      aria-label="Resize the widget panel"
      tabIndex={0}
      title="Drag to resize. Double-click to reset."
      aria-valuemin={Math.round(measured?.bounds.min ?? SERVER_VALUE.min)}
      aria-valuemax={Math.round(measured?.bounds.max ?? SERVER_VALUE.max)}
      aria-valuenow={Math.round(measured?.width ?? SERVER_VALUE.now)}
      {...(measured && {
        "aria-valuetext": `${Math.round((measured.width / measured.bodyWidth) * 100) || 0}% of the page`,
      })}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      onDoubleClick={onDoubleClick}
    />
  );
}
