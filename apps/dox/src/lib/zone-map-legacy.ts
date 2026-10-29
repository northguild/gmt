/**
 * The old zone map markup and mount, for the three mounts that still write `data-role` markup
 * (`canada-clock-change-mount.ts`, `morocco-clock-change-mount.ts`, `clock-change-mount.ts`).
 *
 * Old markup: L15e removes this file once the mounts use `zoneMap` and `wireZoneMap`. The
 * behaviour is the shared one in `zone-map.ts` (`runZoneMap`); only the way the parts are found
 * differs.
 */
import { NO_SIGNAL } from "./clock-change-common";
import { escapeAttr, zoneIdHtml } from "./widget-ui";
import { runZoneMap } from "./zone-map";
import type {
  MapZone,
  ZoneMapConfig,
  ZoneMapDeps,
  ZoneMapHandle,
  ZoneMapParts,
} from "./zone-map";
import { PIN_PLACEHOLDER } from "~/widgets/families/clockcheck/zone-map";

/** What an empty row shows before a zone is pinned: a dash, never a blank. */
const EMPTY = "—";

/** Old markup: L15e removes this once the mount uses `zoneMap`. */
export function renderPinPanelHtml(): string {
  const row = (role: string, label: string, text = EMPTY, extra = "") =>
    `<div class="gmt-zonemap-pin-row${extra}"><dt>${label}</dt><dd data-role="${role}" data-gate="pin-cell">${text}</dd></div>`;
  const title = (role: string, label: string, text: string) =>
    `<div class="gmt-zonemap-pin-titlerow"><dt class="gmt-zonemap-sr">${label}</dt><dd data-role="${role}" data-gate="pin-cell${role === "pin-zone" ? " pin-zone" : ""}">${text}</dd></div>`;
  return (
    `<p class="gmt-zonemap-sr" data-role="pin-announce" role="status"></p>` +
    `<div class="gmt-zonemap-pin-head">` +
    `<div class="gmt-zonemap-pin-clock" data-role="pin-clock" aria-hidden="true"></div>` +
    `<dl class="gmt-zonemap-pin-title">` +
    title("pin-zone", "Zone", PIN_PLACEHOLDER) +
    title("pin-class", "Class", EMPTY) +
    `</dl></div>` +
    `<dl class="gmt-zonemap-pin-rows">` +
    row("pin-time", "Local time") +
    row("pin-offset", "UTC offset") +
    row("pin-last", "Last change", EMPTY, " gmt-zonemap-pin-row--wide") +
    row("pin-next", "Next change", EMPTY, " gmt-zonemap-pin-row--wide") +
    row("pin-release", "Recorded in", EMPTY, " gmt-zonemap-pin-row--wide") +
    `</dl>`
  );
}

/** Old markup: L15e removes this once the mount uses `zoneMap`. */
export function zoneListItemHtml(zone: string): string {
  const id = escapeAttr(zone);
  return (
    `<li class="gmt-zonemap-zone"><button type="button" class="gmt-zonemap-zone-btn" data-tz-id="${id}" aria-pressed="false">` +
    `<span class="gmt-zonemap-zone-id"><code>${zoneIdHtml(zone)}</code></span>` +
    `<span class="gmt-zonemap-zone-kind"><span class="gmt-zonemap-swatch gmt-theme-dark" data-role="swatch" data-kind="no-data" aria-hidden="true"></span><span data-role="kind">no answer yet</span></span>` +
    `<span class="gmt-zonemap-zone-offset" data-role="offset">${NO_SIGNAL}</span>` +
    `</button></li>`
  );
}

/** Old markup: L15e removes this once the mount calls `wireZoneMap`. */
export function mountZoneMap(
  root: HTMLElement,
  zones: MapZone[],
  signal: AbortSignal,
  deps: ZoneMapDeps,
  config: ZoneMapConfig,
): ZoneMapHandle {
  const q = <T extends HTMLElement>(
    selector: string,
    within: ParentNode = root,
  ) => within.querySelector<T>(selector);
  const list = q<HTMLElement>('[data-role="zone-list"]');
  const frame = q<HTMLElement>('[data-role="map"]');
  const parts: ZoneMapParts = {
    section: q<HTMLElement>('[data-role="map-section"]') ?? root,
    frame,
    list,
    scroller: q<HTMLElement>('[data-role="zone-scroll"]'),
    panel: q<HTMLElement>('[data-role="pin"]'),
    notice: q<HTMLElement>('[data-role="clocks-notice"]'),
    creditsId: frame?.dataset["creditsId"] ?? `${config.idPrefix}-data-credits`,
    clockId: `${config.idPrefix}-pin`,
    buttons: list
      ? [...list.querySelectorAll<HTMLButtonElement>("button[data-tz-id]")]
      : [],
    fields: (button) => ({
      kind: q<HTMLElement>('[data-role="kind"]', button),
      offset: q<HTMLElement>('[data-role="offset"]', button),
      swatch: q<HTMLElement>('[data-role="swatch"]', button),
    }),
    pin: (part) =>
      q<HTMLElement>(`[data-role="pin-${part}"]`, parts.panel ?? root),
    legendCounts: (kind) => [
      ...root.querySelectorAll<HTMLElement>(
        `[data-role="legend-count"][data-kind="${kind}"]`,
      ),
    ],
    svgId: `${config.idPrefix}-map-svg`,
    labelsId: `${config.idPrefix}-map-labels`,
  };
  return runZoneMap(parts, zones, signal, deps, config);
}
