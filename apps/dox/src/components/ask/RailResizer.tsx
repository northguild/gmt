/**
 * The handle on the widget rail's left edge. Drag it, or focus it and use the
 * arrow keys, to make the rail wider; double-click it to reset the width.
 *
 * The width lives in one CSS custom property on `.gmt-hive-body`
 * (`--gmt-hive-rail-width`), so a widget swap, which remounts the rail, keeps
 * it. The reader's last width is remembered in this browser only.
 *
 * Desktop only: below 60rem the rail is a bottom sheet and the handle is
 * hidden (`gmt-hive.css`).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  clampRailWidth,
  railBounds,
  railWidthForKey,
  type RailBounds,
} from "./rail-width";

const WIDTH_PROPERTY = "--gmt-hive-rail-width";
const STORAGE_KEY = "gmt-dox-rail-width";

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

interface Measured {
  width: number;
  bounds: RailBounds;
  bodyWidth: number;
}

export function RailResizer({ railId }: { railId: string }) {
  const handleRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<Measured | null>(null);
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);
  const frame = useRef(0);

  const elements = useCallback(() => {
    const body = handleRef.current?.parentElement ?? null;
    const rail = document.getElementById(railId);
    return body && rail ? { body, rail } : null;
  }, [railId]);

  const measure = useCallback((): Measured | null => {
    const found = elements();
    if (!found) return null;
    const bodyWidth = found.body.getBoundingClientRect().width;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    return {
      width: found.rail.getBoundingClientRect().width,
      bounds: railBounds({ viewportWidth: window.innerWidth, bodyWidth, rem }),
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
  useEffect(() => {
    const stored = readStoredWidth();
    apply(stored);
    const onResize = () => setMeasured(measure());
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(frame.current);
    };
  }, [apply, measure]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const current = measure();
    if (!current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startWidth: current.width };
    elements()?.body.setAttribute("data-resizing", "");
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start) return;
    // The rail is on the right: moving the pointer left widens it.
    const width = start.startWidth + (start.startX - event.clientX);
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => apply(width));
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    elements()?.body.removeAttribute("data-resizing");
    const width = measure()?.width;
    if (width !== undefined) storeWidth(width);
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
    storeWidth(width);
  };

  const onDoubleClick = () => {
    apply(undefined);
    storeWidth(undefined);
  };

  return (
    <div
      ref={handleRef}
      className="gmt-hive-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-controls={railId}
      aria-label="Resize the widget panel"
      tabIndex={0}
      title="Drag to resize. Double-click to reset."
      {...(measured && {
        "aria-valuemin": Math.round(measured.bounds.min),
        "aria-valuemax": Math.round(measured.bounds.max),
        "aria-valuenow": Math.round(measured.width),
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
