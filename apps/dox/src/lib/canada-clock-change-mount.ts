/**
 * The Canada 2026 clock-change checker's page widget (CORE-88): whether a runtime has the 2026 tz
 * data, the clock changes in 2026 and 2027, and live clocks for five zones.
 *
 * Every value in the transitions and the clocks comes from one
 * `GET /gmt/api/canada-clock-change` answer, computed on the Worker with the library at request
 * time. The widget draws it. The only values it makes itself are the browser column, which is
 * the point of that column, and the wall time of each clock, which is the library reading the
 * client's now at the Worker's offset. No named zone reaches the browser's tz data for a clock.
 *
 * The cards a dated checker shares with the others are in `clock-change-*.ts` and `zone-map.ts`;
 * this file is Canada's page: its template, its words and its wiring.
 *
 * `renderCanadaClockChangeTemplate()` is pure markup, so the server renders every table with its
 * known rows and the page does not grow once the answer arrives.
 */
import type { CanadaCheck } from "./canada-clock-change";
import {
  CANADA_MOMENTS,
  CANADA_STOP_YEAR,
  canadaVerdict,
  CLOCK_ZONES,
  NODE_PROBE_COMMAND,
  STOPPED_ZONES,
  TABLE_ZONES,
  TRANSITION_ZONES,
  canadaClassText,
  canadaProbe,
  expectedProbeOutput,
} from "./canada-clock-change";
import { CANADA_MAP } from "./canada-map";
import zoneIds from "./canada-zones.json";
import { CANADA_MINIMUMS } from "../data/canada-runtime-minimums";
import { CANADA_STORED } from "./canada-saved-example";
import { HELP, canadaKeyPoints } from "../data/canada-key-points";
import { SERVERS_LINE, cityOf, msToNextSecond } from "./clock-change-common";
import { wireClocks } from "./clock-change-clocks";
import { defineElements } from "~/widgets/define";
import {
  findWidget,
  html,
  idScope,
  setHtml,
  type SafeHtml,
} from "~/widgets/builders";
import {
  changeEntries,
  changeGroups,
  changeListPart,
  listSection,
} from "~/widgets/families/clockcheck/change-list";
import {
  checkerPage,
  classLegend,
} from "~/widgets/families/clockcheck/checker-page";
import { helpCard } from "~/widgets/families/clockcheck/help-card";
import {
  minimumsCard,
  serversCard,
} from "~/widgets/families/clockcheck/info-card";
import { keyPoints } from "~/widgets/families/clockcheck/key-points";
import {
  fillProbe,
  placesChips,
  probeCard,
} from "~/widgets/families/clockcheck/probe-card";
import { PROBE_PARTS } from "~/widgets/families/clockcheck/probe-ids";
import { storedSection } from "~/widgets/families/clockcheck/stored-section";
import { tenseSlot } from "~/widgets/families/clockcheck/tense-slot";
import { wireStoredTimes } from "./clock-change-stored";
import type { StoredHandle } from "./clock-change-stored";
import {
  ask,
  clockChangeWidget,
  loadClockLib,
  loadTenseView,
  wallText,
  yearsOf,
} from "./clock-change-mount";
import type { ClockChangeChatArgs, ClockLib } from "./clock-change-mount";
import { withBase } from "./site";
import { REGION_KEY, bindTense, regionWhen } from "./clock-change-tense";
import type { TenseView } from "./clock-change-tense";
import { bindClockGlow } from "./crystal-clock";
import { showUnavailable } from "./widget-mount";
import { staleZoneIds, wireZoneMap } from "./zone-map";
import type { ZoneMapHandle } from "./zone-map";

const NAME = "canada-clock-change";
const YEARS = yearsOf(CANADA_STOP_YEAR);
const TABLE_CITIES = TABLE_ZONES.map((fact) => cityOf(fact.zone));
const CLOCKS_NOTICE = (): SafeHtml =>
  html`This browser has old rules for ${placesChips(TABLE_CITIES)}. From 1 November 2026 these clocks show them an hour off.`;

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

export interface CanadaTemplateOptions {
  /** Namespaces the heading ids, so the chat's copy cannot collide with a page's. */
  idPrefix?: string;
  /** Draws the Key points above the checker. The page does; the chat rail does not. */
  keyPoints?: boolean;
  /** Which tense is true now, and the dates in words: the page's server render and the chat read it from the library. */
  tense: TenseView;
}

/** Reads the tense of the Canada page's moments at the library's clock. */
export const loadCanadaTense = (): Promise<TenseView> =>
  loadTenseView(CANADA_MOMENTS);

/**
 * The hint under "Clock changes", written whole in both tenses. A tensed clause mid-sentence would
 * be one box that cannot break across lines, so the sentence is one block slot, like a Key point.
 */
function changesHint(view: TenseView): SafeHtml {
  const hint = (zones: string): string =>
    `tzdb also records an abbreviation change on 2026-11-01 for ${zones}, with no change of UTC offset, so it is not listed. Times are the clock as it read just before the change.`;
  return tenseSlot(
    REGION_KEY,
    hint("the four zones that will stop changing their clocks"),
    hint("the four zones that stopped changing their clocks"),
    view.tenseOf(REGION_KEY),
    true,
  );
}

export function renderCanadaClockChangeTemplate({
  idPrefix = "canada",
  keyPoints: withKeyPoints = false,
  tense,
}: CanadaTemplateOptions): SafeHtml {
  const id = idScope(idPrefix);
  return checkerPage({
    name: NAME,
    label: "Canada 2026 clock-change checker",
    idPrefix,
    keyPoints: withKeyPoints
      ? keyPoints(idPrefix, canadaKeyPoints(regionWhen(tense)), tense)
      : undefined,
    probe: probeCard(
      canadaProbe(idPrefix),
      canadaVerdict(withKeyPoints ? "page" : "chat"),
    ),
    map: {
      zones: zoneIds.zones,
      listLabel: "Canada time zones, scrollable list",
      mapHeight: CANADA_MAP.height,
      legend: classLegend(idPrefix, canadaClassText, tense),
      clockZones: CLOCK_ZONES,
      stopped: STOPPED_ZONES,
      clocksNotice: CLOCKS_NOTICE(),
    },
    servers: serversCard({
      idPrefix,
      command: NODE_PROBE_COMMAND,
      expected: expectedProbeOutput(),
      line: SERVERS_LINE,
    }),
    minimums: minimumsCard(idPrefix, CANADA_MINIMUMS),
    changes: listSection(
      {
        id: id("changes"),
        heading: "Clock changes in 2026 and 2027",
        gate: "changes",
        note: changesHint(tense),
      },
      changeGroups(idPrefix, TRANSITION_ZONES, YEARS),
    ),
    help: helpCard(idPrefix, HELP),
    stored: storedSection({ ...CANADA_STORED, idPrefix }),
  });
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

export interface CanadaMountOptions {
  /** The fetch to call the Worker with. Tests pass a fake. */
  fetch?: typeof fetch;
  /** The client's now as a UTC instant. Defaults to the library's `getUtcNow`. */
  now?: () => string;
  /** A zone id to pin on the map once it is drawn. An id not on the map is ignored. */
  pinZone?: string;
  /** Where the map reads and writes `?zone=`. The chat passes inert ones: its URL is not the checker's. */
  location?: Pick<Location, "href">;
  history?: Pick<History, "replaceState">;
}

export async function mountCanadaClockChange(
  root: HTMLElement,
  signal: AbortSignal,
  options: CanadaMountOptions = {},
): Promise<void> {
  defineElements();
  const w = findWidget(root, NAME);

  // Every id this mount makes (the clocks' clipPath, gradient and filter ids, the pin clock, the
  // credits button) comes from the scope the template was rendered with, so a page and a chat
  // widget, or two widgets, never share one.
  const idPrefix = w.el.dataset["scope"] ?? "canada";

  // The browser column needs no library and no answer: fill it first.
  fillProbe(w, canadaProbe(idPrefix));

  let lib: ClockLib;
  try {
    lib = await loadClockLib();
  } catch (error) {
    showUnavailable(root, error);
    return;
  }
  if (signal.aborted) return;

  const fetchFn = options.fetch ?? fetch;
  const now = options.now ?? lib.getUtcNow;
  const status = w.part(PROBE_PARTS.status);
  const recheck = w.part<HTMLButtonElement>(PROBE_PARTS.recheck);
  let check: CanadaCheck | null = null;
  let busy = false;
  let mapMounted = false;
  let stored: StoredHandle | undefined;
  let map: ZoneMapHandle | undefined;

  // --- the tense: the forms of every dated phrase follow the page's clock, and flip on their own ---
  const tense = bindTense(w.el, {
    lib,
    moments: CANADA_MOMENTS,
    now,
    signal,
    onChange: () => map?.retense(),
  });

  bindClockGlow(w.el, signal);

  // --- the transitions -----------------------------------------------------
  function drawTransitions(answer: CanadaCheck): void {
    for (const zone of TRANSITION_ZONES) {
      setHtml(
        w.part(changeListPart(zone)),
        changeEntries(
          YEARS.map((year) => ({
            year,
            lines: answer.transitions
              .filter((row) => row.zone === zone && row.year === year)
              .map((row) => ({
                when: row.wallBefore === "" ? "" : wallText(row.wallBefore),
                shift: `${row.offsetBefore} → ${row.offsetAfter}`,
                utc: row.instant,
              })),
          })),
        ),
      );
    }
  }

  // --- the clocks ----------------------------------------------------------
  const clocks = wireClocks(w, {
    idPrefix,
    lib,
    now,
    signal,
    read: () => check?.zones ?? null,
    zones: CLOCK_ZONES,
    zoneList: w.part<HTMLElement>("zone-list"),
  });

  // --- the fetch -----------------------------------------------------------
  async function load(): Promise<void> {
    if (busy) return;
    busy = true;
    recheck.setAttribute("aria-busy", "true");
    status.textContent = "Checking\u2026";
    const answer = await ask<CanadaCheck>(
      withBase("/api/canada-clock-change"),
      fetchFn,
      signal,
    );
    busy = false;
    recheck.removeAttribute("aria-busy");
    if (signal.aborted) return;
    if (answer.kind === "ok") {
      check = answer.check;
      stored?.setStaleZones(staleZoneIds(STOPPED_ZONES, check.zones));
      status.textContent = "";
      drawTransitions(check);
      clocks.tick();
      // The ready signal for the browser checks: the answer is drawn and the clocks have ticked.
      w.el.dataset["state"] = "ready";
      if (!mapMounted) {
        mapMounted = true;
        map = wireZoneMap(
          w,
          check.zones,
          signal,
          {
            tense: () => tense.view(),
            responseNow: check.now,
            now,
            wall: (at, offset) =>
              lib.convertUtcToPlainDateTime(at, { timeZone: offset }),
            isBefore: lib.isBeforeUtc,
            msToNextSecond,
            fetch: fetchFn,
            location: options.location,
            history: options.history,
          },
          { ...CANADA_MAP, idPrefix },
        );
        if (options.pinZone !== undefined) map.pin(options.pinZone);
      }
    } else if (answer.kind === "rate-limited") {
      stored?.browserUnchecked();
      w.el.dataset["state"] = "error";
      status.textContent =
        answer.seconds === null
          ? "Too many checks. Try again shortly."
          : `Try again in ${answer.seconds} s`;
    } else {
      stored?.browserUnchecked();
      w.el.dataset["state"] = "error";
      status.textContent = "The check could not finish.";
    }
  }

  recheck.addEventListener("click", () => void load(), { signal });
  stored = wireStoredTimes(w, { ...CANADA_STORED, idPrefix }, signal, fetchFn);
  await load();
  await stored.ready;
}

// ---------------------------------------------------------------------------
// The chat widget
// ---------------------------------------------------------------------------

/** The chat's markup: the page's sections, with ids namespaced by `idPrefix`. */
export function renderCanadaClockChangeWidgetTemplate(
  idPrefix: string,
  tense: TenseView,
): SafeHtml {
  return renderCanadaClockChangeTemplate({ idPrefix, tense });
}

/** Mounts the checker in the chat rail; the wrapper is shared (`clock-change-mount.ts`). */
export type CanadaClockChangeArgs = ClockChangeChatArgs;

export const mountCanadaClockChangeWidget = clockChangeWidget(
  mountCanadaClockChange,
);
