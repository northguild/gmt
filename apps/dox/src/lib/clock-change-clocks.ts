/**
 * The live clocks of a dated tz-change checker: one crystal clock and one readout per zone. Plain
 * DOM. Every wall time is the library reading the client's now at the offset the Worker gave the
 * zone (switching to the next offset once the next change has passed), so no named zone reaches
 * the browser's own time zone data.
 */
import { SIGNAL_LOST, msToNextSecond, wallHms } from "./clock-change-common";
import type { Change } from "./clock-change-common";
import { spokenOffset } from "./crossing-clock";
import { updateCrystalClock } from "./crystal-clock";
import { setHtml } from "~/widgets/builders/html";
import type { FoundWidget } from "~/widgets/root";
import {
  CLOCK_PARTS,
  clockNoSignal,
  clockSlug,
  clockTime,
} from "~/widgets/families/clockcheck/clocks";

/** A zone's row, as much of it as a clock needs. `MapZone` fits. */
export interface ClockZone {
  zone: string;
  offset: string;
  next: Change | null;
}

/** The two library functions the clocks call. */
export interface ClockLib {
  convertUtcToPlainDateTime(
    value: string,
    options: { timeZone: string },
  ): string;
  isBeforeUtc(value1: string, value2: string): boolean;
}

interface ClocksOptions {
  /** Namespaces the crystal clocks' ids. */
  idPrefix: string;
  lib: ClockLib;
  /** The client's now as a UTC instant. */
  now: () => string;
  signal: AbortSignal;
  /** The zones' rows, or `null` until the answer arrives. */
  read: () => readonly ClockZone[] | null;
}

interface ClocksHandle {
  /** Draws every clock now and schedules the next second. Call it when the answer arrives. */
  tick(): void;
}

/** The offset in force at `at`: the next change's offset once `at` has reached it. */
function offsetAt(lib: ClockLib, zone: ClockZone, at: string): string {
  const next = zone.next;
  if (next !== null && !lib.isBeforeUtc(at, next.instant))
    return next.offsetAfter;
  return zone.offset;
}

interface WireClocksOptions extends ClocksOptions {
  /** The zones the list was built with, in order. */
  zones: readonly string[];
  /** The zone list whose pressed button picks a clock, or `null` when the page has none. */
  zoneList: HTMLElement | null;
}

/**
 * Wires the clocks `clocks()` built inside `widget`: the one-second tick, and the highlight of the
 * clock whose zone the list has pressed. A tick sets the face's hands and the time line's text
 * only, so no box moves.
 */
export function wireClocks(
  widget: FoundWidget,
  options: WireClocksOptions,
): ClocksHandle {
  const { signal, zones: ids, zoneList } = options;
  const items = ids.map((zone) => ({
    zone,
    item: widget.part(CLOCK_PARTS.item(zone)),
    face: widget.part(CLOCK_PARTS.face(zone)),
    time: widget.part(CLOCK_PARTS.time(zone)),
  }));
  let timer: ReturnType<typeof setTimeout> | undefined;

  function draw(
    entry: (typeof items)[number],
    zone: ClockZone | undefined,
    at: string,
  ): void {
    const offset = zone ? offsetAt(options.lib, zone, at) : "";
    const wall =
      offset === ""
        ? ""
        : options.lib.convertUtcToPlainDateTime(at, { timeZone: offset });
    if (wall === "") {
      setHtml(entry.time, clockNoSignal());
      entry.time.title = SIGNAL_LOST;
      return;
    }
    entry.time.removeAttribute("title");
    const hms = wallHms(wall);
    setHtml(entry.time, clockTime(hms, offset));
    updateCrystalClock(entry.face, {
      id: `${options.idPrefix}-${clockSlug(entry.zone)}`,
      hour: Number(wall.slice(11, 13)),
      minute: Number(wall.slice(14, 16)),
      second: Number(hms.slice(6, 8)),
      label: entry.zone,
      sublabel: `${wall.slice(11, 16)}, ${spokenOffset(offset)}`,
    });
  }

  function tick(): void {
    clearTimeout(timer);
    const rows = options.read();
    if (signal.aborted || rows === null) return;
    const at = options.now();
    for (const entry of items)
      draw(
        entry,
        rows.find((z) => z.zone === entry.zone),
        at,
      );
    timer = setTimeout(tick, msToNextSecond(at));
  }
  signal.addEventListener("abort", () => clearTimeout(timer), { once: true });

  // The clock of the zone picked in the list takes a full highlight; the others stay as they are.
  const markPicked = (): void => {
    const picked = zoneList?.querySelector<HTMLElement>('[aria-pressed="true"]')
      ?.dataset["tzId"];
    for (const { zone, item } of items) {
      if (picked !== undefined && zone === picked)
        item.dataset["picked"] = "true";
      else delete item.dataset["picked"];
    }
  };
  if (zoneList) {
    const watcher = new MutationObserver(markPicked);
    watcher.observe(zoneList, {
      attributes: true,
      attributeFilter: ["aria-pressed"],
      subtree: true,
    });
    signal.addEventListener("abort", () => watcher.disconnect(), {
      once: true,
    });
    markPicked();
  }

  return { tick };
}
