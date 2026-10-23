/**
 * The live clocks of a dated tz-change checker: one crystal clock and one readout per zone. Plain
 * DOM. Every wall time is the library reading the client's now at the offset the Worker gave the
 * zone (switching to the next offset once the next change has passed), so no named zone reaches
 * the browser's own time zone data.
 */
import {
  NO_SIGNAL,
  SIGNAL_LOST,
  msToNextSecond,
  wallHms,
} from "./clock-change-common";
import type { Change } from "./clock-change-common";
import { spokenOffset } from "./crossing-clock";
import { updateCrystalClock } from "./crystal-clock";
import { escapeAttr, escapeHtml, zoneIdHtml } from "./widget-ui";

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

function clockHtml(zone: string, stopped: ReadonlySet<string>): string {
  return (
    `<li class="gmt-clockcheck-clock" data-zone="${escapeAttr(zone)}" data-state="${stopped.has(zone) ? "stopped" : "changes"}">` +
    `<div class="gmt-clockcheck-face" data-role="clock"></div>` +
    `<p class="gmt-clockcheck-clock-zone"><code>${zoneIdHtml(zone)}</code></p>` +
    `<p class="gmt-clockcheck-clock-time" data-role="clock-time">${NO_SIGNAL}</p>` +
    `</li>`
  );
}

/** The list of clocks, server-rendered with a NO SIGNAL readout each. `stopped` marks the zones that stop changing. */
export function clocksHtml(
  zones: readonly string[],
  stopped: ReadonlySet<string>,
): string {
  return `<ul class="gmt-clockcheck-clocks" data-role="clocks">${zones.map((zone) => clockHtml(zone, stopped)).join("")}</ul>`;
}

export interface ClocksOptions {
  /** Namespaces the crystal clocks' ids. */
  idPrefix: string;
  lib: ClockLib;
  /** The client's now as a UTC instant. */
  now: () => string;
  signal: AbortSignal;
  /** The zones' rows, or `null` until the answer arrives. */
  read: () => readonly ClockZone[] | null;
}

export interface ClocksHandle {
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

function drawClock(
  options: ClocksOptions,
  item: HTMLElement,
  zone: ClockZone | undefined,
  at: string,
): void {
  const host = item.querySelector<HTMLElement>('[data-role="clock"]')!;
  const readout = item.querySelector<HTMLElement>('[data-role="clock-time"]')!;
  const id = item.dataset.zone ?? "";
  const offset = zone ? offsetAt(options.lib, zone, at) : "";
  const wall =
    offset === ""
      ? ""
      : options.lib.convertUtcToPlainDateTime(at, { timeZone: offset });
  if (wall === "") {
    readout.innerHTML = NO_SIGNAL;
    readout.title = SIGNAL_LOST;
    return;
  }
  readout.removeAttribute("title");
  const hour = Number(wall.slice(11, 13));
  const minute = Number(wall.slice(14, 16));
  // Two spans for the readout's two voices: "HH:MM:SS" and the offset. The readout is plain text
  // (no live region), so the second ticking never reaches a screen reader.
  readout.innerHTML = `<span class="gmt-clockcheck-clock-hm">${escapeHtml(wallHms(wall))}</span> <span class="gmt-clockcheck-clock-off">${escapeHtml(offset)}</span>`;
  updateCrystalClock(host, {
    id: `${options.idPrefix}-${id.replace(/[^A-Za-z0-9]/g, "-")}`,
    hour,
    minute,
    second: Number(wallHms(wall).slice(6, 8)),
    label: id,
    sublabel: `${wall.slice(11, 16)}, ${spokenOffset(offset)}`,
  });
}

/** Wires the clocks under `root`: the one-second tick, and the highlight of the clock whose zone the list has pressed. */
export function mountClocks(
  root: HTMLElement,
  options: ClocksOptions,
): ClocksHandle {
  const { signal } = options;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function tick(): void {
    clearTimeout(timer);
    const zones = options.read();
    if (signal.aborted || zones === null) return;
    const at = options.now();
    root
      .querySelectorAll<HTMLElement>(".gmt-clockcheck-clock")
      .forEach((item) => {
        drawClock(
          options,
          item,
          zones.find((z) => z.zone === item.dataset.zone),
          at,
        );
      });
    timer = setTimeout(tick, msToNextSecond(at));
  }
  signal.addEventListener("abort", () => clearTimeout(timer), { once: true });

  // The clock of the zone picked in the list takes a full highlight; the others stay as they are.
  const zoneList = root.querySelector<HTMLElement>('[data-role="zone-list"]');
  const markPicked = (): void => {
    const picked = zoneList?.querySelector<HTMLElement>('[aria-pressed="true"]')
      ?.dataset.tzId;
    root
      .querySelectorAll<HTMLElement>(".gmt-clockcheck-clock")
      .forEach((item) => {
        if (picked !== undefined && item.dataset.zone === picked)
          item.dataset.picked = "true";
        else delete item.dataset.picked;
      });
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
